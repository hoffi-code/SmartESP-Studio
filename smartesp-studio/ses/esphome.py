"""Job queue and ESPHome CLI invocation (compile/upload/logs/validate/clean)."""

import json
import os
import pty
import queue
import select
import shlex
import subprocess
import threading
import uuid
from collections import deque
from typing import List, Optional

from ses import config, serial_ports
from ses.io import sanitize_log_line, should_skip_log_line, utc_now
from ses.logging import log


def format_sse(event: str, data: str) -> str:
    return f"event: {event}\ndata: {data}\n\n"


class Job:
    def __init__(
        self,
        job_id: str,
        yaml_name: str,
        action: str,
        device: str,
        serial_port: str = "",
        state: str = "queued",
        created_at: Optional[str] = None,
        started_at: Optional[str] = None,
        ended_at: Optional[str] = None,
        exit_code: Optional[int] = None,
        error_summary: str = "",
    ) -> None:
        self.id = job_id
        self.yaml_name = yaml_name
        self.action = action
        self.device = device
        self.serial_port = serial_port
        self.state = state
        self.created_at = created_at or utc_now()
        self.started_at = started_at
        self.ended_at = ended_at
        self.exit_code = exit_code
        self.error_summary = error_summary

        self.log_path = os.path.join(config.JOB_DIR, f"{self.id}.log")
        self.json_path = os.path.join(config.JOB_DIR, f"{self.id}.json")

        self.lock = threading.Lock()
        self.listeners = set()
        self.ring_buffer = deque(maxlen=2000)
        self.seq_buffer = deque(maxlen=2000)
        self.line_seq = 0
        self.process: Optional[subprocess.Popen] = None
        self.cancel_requested = False
        self.last_log_line = ""

    @classmethod
    def from_dict(cls, data: dict) -> "Job":
        return cls(
            job_id=data.get("id", ""),
            yaml_name=data.get("yaml", ""),
            action=data.get("action", ""),
            device=data.get("device", ""),
            serial_port=data.get("serial_port", ""),
            state=data.get("state", "queued"),
            created_at=data.get("created_at"),
            started_at=data.get("started_at"),
            ended_at=data.get("ended_at"),
            exit_code=data.get("exit_code"),
            error_summary=data.get("error_summary", ""),
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "state": self.state,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "exit_code": self.exit_code,
            "error_summary": self.error_summary,
            "yaml": self.yaml_name,
            "action": self.action,
            "device": self.device,
            "serial_port": self.serial_port,
        }

    def save_status(self) -> None:
        os.makedirs(config.JOB_DIR, exist_ok=True)
        with open(self.json_path, "w", encoding="utf-8") as handle:
            json.dump(self.to_dict(), handle, ensure_ascii=False, indent=2)
            handle.write("\n")

    def add_listener(self) -> queue.Queue:
        listener = queue.Queue()
        with self.lock:
            self.listeners.add(listener)
        return listener

    def remove_listener(self, listener: queue.Queue) -> None:
        with self.lock:
            self.listeners.discard(listener)

    def push_log(self, line: str) -> None:
        with self.lock:
            self.ring_buffer.append(line)
            self.line_seq += 1
            self.seq_buffer.append((self.line_seq, line))
            listeners = list(self.listeners)
        for listener in listeners:
            listener.put({"type": "log", "data": line})

    def notify_done(self) -> None:
        payload = self.to_dict()
        with self.lock:
            listeners = list(self.listeners)
        for listener in listeners:
            listener.put({"type": "done", "data": payload})

    def get_recent_lines(self) -> List[str]:
        with self.lock:
            return list(self.ring_buffer)

    def get_seq_lines(self, since: int = 0) -> List[str]:
        with self.lock:
            lines = [line for seq, line in self.seq_buffer if seq > since]
            return lines

    def get_seq_entries(self, since: int = 0, limit: Optional[int] = None) -> List[tuple]:
        with self.lock:
            entries = [(seq, line) for seq, line in self.seq_buffer if seq > since]
        if limit is not None:
            return entries[:limit]
        return entries

    def get_last_seq(self) -> int:
        with self.lock:
            return self.line_seq


class JobManager:
    def __init__(self) -> None:
        self.jobs = {}
        self.lock = threading.Lock()
        self.serial_locks = {}
        self.serial_locks_lock = threading.Lock()
        self.queue = queue.Queue()
        os.makedirs(config.JOB_DIR, exist_ok=True)
        self._load_jobs()
        self.worker = threading.Thread(target=self._worker, daemon=True)
        self.worker.start()

    def _load_jobs(self) -> None:
        for name in os.listdir(config.JOB_DIR):
            if not name.endswith(".json"):
                continue
            path = os.path.join(config.JOB_DIR, name)
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    data = json.load(handle)
                job = Job.from_dict(data)
                if job.id:
                    self.jobs[job.id] = job
            except Exception:
                continue

    def submit(self, yaml_name: str, action: str, device: str, serial_port: str = "") -> Job:
        job_id = uuid.uuid4().hex
        job = Job(job_id, yaml_name, action, device, serial_port=serial_port)
        with self.lock:
            self.jobs[job.id] = job
        os.makedirs(config.JOB_DIR, exist_ok=True)
        with open(job.log_path, "w", encoding="utf-8"):
            pass
        job.save_status()
        self.queue.put(job)
        return job

    def get(self, job_id: str) -> Optional[Job]:
        with self.lock:
            return self.jobs.get(job_id)

    def cancel(self, job_id: str) -> Optional[Job]:
        job = self.get(job_id)
        if not job:
            return None
        with job.lock:
            if job.state in ("success", "failed", "canceled"):
                return job
            job.cancel_requested = True
            if job.state == "queued":
                job.state = "canceled"
                job.ended_at = utc_now()
                job.exit_code = -1
                job.error_summary = "Canceled"
                job.save_status()
                job.notify_done()
                return job
            if job.state == "running" and job.process:
                job.process.terminate()
        return job

    def _worker(self) -> None:
        while True:
            job = self.queue.get()
            if job.state == "canceled":
                continue
            serial_lock = None
            if job.action == "serial" and job.serial_port:
                with self.serial_locks_lock:
                    serial_lock = self.serial_locks.setdefault(job.serial_port, threading.Lock())
                serial_lock.acquire()
            try:
                self._run_job(job)
            except Exception:
                # Keep the worker alive; a single failing job must not stall the queue.
                log.exception("job %s (%s) crashed", job.id, job.action)
                job.state = "failed"
                job.exit_code = 1
                job.error_summary = job.error_summary or "Internal error"
                job.ended_at = utc_now()
                job.save_status()
                job.notify_done()
            finally:
                if serial_lock is not None:
                    serial_lock.release()

    def _run_job(self, job: Job) -> None:
        job.state = "running"
        job.started_at = utc_now()
        job.save_status()

        yaml_path = os.path.join(config.TARGET_DIR, job.yaml_name)
        if job.action == "logs":
            exit_code = self._run_esphome(job, ["logs", yaml_path, "--device", job.device])
        elif job.action == "validate":
            exit_code = self._run_esphome(job, ["config", yaml_path])
        elif job.action == "clean":
            exit_code = self._run_esphome(job, ["clean", yaml_path])
        elif job.action == "serial":
            try:
                serial_port = serial_ports.validate_host_serial_port(job.serial_port)
            except (RuntimeError, ValueError) as exc:
                message = str(exc)
                job.push_log(f"ERROR {message}")
                job.last_log_line = message
                job.error_summary = message
                exit_code = 1
            else:
                exit_code = self._run_esphome(job, ["config", yaml_path])
                if exit_code == 0 and not job.cancel_requested:
                    exit_code = self._run_esphome(job, ["compile", yaml_path])
                if exit_code == 0 and not job.cancel_requested:
                    exit_code = self._run_esphome(
                        job, ["upload", yaml_path, "--device", serial_port]
                    )
        else:
            exit_code = self._run_esphome(job, ["config", yaml_path])

            if exit_code == 0 and not job.cancel_requested:
                compile_cmd = ["compile", yaml_path]
                exit_code = self._run_esphome(job, compile_cmd)

            if exit_code == 0 and job.action == "ota" and not job.cancel_requested:
                upload_cmd = ["upload", yaml_path, "--device", job.device]
                exit_code = self._run_esphome(job, upload_cmd)


        if job.cancel_requested:
            job.state = "canceled"
            job.exit_code = -1
            job.error_summary = "Canceled"
        elif exit_code == 0:
            job.state = "success"
            job.exit_code = 0
            job.error_summary = ""
        else:
            job.state = "failed"
            job.exit_code = exit_code
            job.error_summary = job.error_summary or job.last_log_line

        job.ended_at = utc_now()
        job.save_status()
        job.notify_done()

    def _run_esphome(self, job: Job, args: List[str]) -> int:
        try:
            cmd_prefix = shlex.split(config.ESPHOME_BIN)
        except ValueError as exc:
            message = f"Invalid config.ESPHOME_BIN: {exc}"
            job.push_log(message)
            job.last_log_line = message
            job.error_summary = message
            return 1

        if not cmd_prefix:
            message = "Invalid config.ESPHOME_BIN: empty command"
            job.push_log(message)
            job.last_log_line = message
            job.error_summary = message
            return 1

        return self._run_command(job, cmd_prefix + args)

    def _run_command(
        self,
        job: Job,
        cmd: List[str],
        extra_env: Optional[dict] = None,
    ) -> int:
        job.push_log("INFO CMD: " + " ".join(cmd))
        env = os.environ.copy()
        env.setdefault("PYTHONUNBUFFERED", "1")
        env.setdefault("PYTHONIOENCODING", "utf-8")
        if extra_env:
            env.update(extra_env)
        try:
            open_pty = getattr(pty, "openpty", None)
            use_pty = os.name == "posix" and open_pty is not None
            if use_pty:
                assert open_pty is not None
                master_fd, slave_fd = open_pty()
                process = subprocess.Popen(
                    cmd,
                    stdout=slave_fd,
                    stderr=slave_fd,
                    stdin=subprocess.DEVNULL,
                    env=env,
                    close_fds=True,
                    text=False,
                )
                os.close(slave_fd)
            else:
                master_fd = None
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    env=env,
                )
        except Exception as exc:
            message = f"Failed to start: {exc}"
            job.push_log(message)
            job.last_log_line = message
            job.error_summary = message
            return 1

        job.process = process
        with open(job.log_path, "a", encoding="utf-8") as log_handle:
            if use_pty and master_fd is not None:
                buffer = ""
                while True:
                    ready, _, _ = select.select([master_fd], [], [], 0.2)
                    if ready:
                        try:
                            chunk = os.read(master_fd, 4096)
                        except OSError:
                            chunk = b""
                        if not chunk:
                            break
                        text = chunk.decode("utf-8", errors="replace")
                        buffer += text
                        while True:
                            split_index = -1
                            for sep in ("\n", "\r"):
                                idx = buffer.find(sep)
                                if idx != -1 and (split_index == -1 or idx < split_index):
                                    split_index = idx
                            if split_index == -1:
                                break
                            line = buffer[:split_index]
                            buffer = buffer[split_index + 1 :]
                            clean_line = sanitize_log_line(line.strip("\r"))
                            if should_skip_log_line(job.action, clean_line):
                                continue
                            log_handle.write(clean_line + "\n")
                            log_handle.flush()
                            if clean_line:
                                job.last_log_line = clean_line
                            job.push_log(clean_line)
                        if job.cancel_requested:
                            process.terminate()
                            break
                    if process.poll() is not None:
                        break
                if buffer:
                    clean_line = sanitize_log_line(buffer.strip("\r\n"))
                    if clean_line and not should_skip_log_line(job.action, clean_line):
                        log_handle.write(clean_line + "\n")
                        log_handle.flush()
                        job.last_log_line = clean_line
                        job.push_log(clean_line)
                try:
                    os.close(master_fd)
                except OSError:
                    pass
            elif process.stdout:
                for line in process.stdout:
                    raw_line = (
                        line.rstrip("\n")
                        if isinstance(line, str)
                        else line.decode("utf-8", errors="replace").rstrip("\n")
                    )
                    clean_line = sanitize_log_line(raw_line)
                    if should_skip_log_line(job.action, clean_line):
                        continue
                    log_handle.write(clean_line + "\n")
                    log_handle.flush()
                    if clean_line:
                        job.last_log_line = clean_line
                    job.push_log(clean_line)
                    if job.cancel_requested:
                        process.terminate()
                        break

        process.wait()
        job.process = None
        if job.cancel_requested:
            return 1
        return process.returncode or 0
