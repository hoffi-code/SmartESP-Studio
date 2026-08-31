"""ESPHome job lifecycle: submit, tail, stream, cancel, firmware download."""

import json
import os
import queue
import time
from typing import List, Tuple

from flask import Blueprint, Response, current_app, jsonify, request, send_file

from ses import auth, config, serial_ports
from ses.esphome import format_sse
from ses.io import normalize_device, normalize_yaml_filename, read_log_tail

bp = Blueprint("jobs", __name__)


def find_firmware_path(node_name: str, variant: str = "ota") -> str:
    build_roots = []
    for root in (
        config.ESPHOME_BUILD_PATH,
        "/data/build",
        os.path.join(config.ESPHOME_DATA_DIR, "build"),
    ):
        if root and root not in build_roots and os.path.isdir(root):
            build_roots.append(root)

    if not build_roots:
        return ""

    target_names = ["firmware.bin"]
    if variant == "factory":
        target_names = ["firmware.factory.bin"]

    def add_candidate(candidates: List[Tuple[float, str]], path: str) -> None:
        if not path or not os.path.isfile(path):
            return
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            return
        candidates.append((mtime, path))

    candidates = []
    for build_root in build_roots:
        build_dir = os.path.join(build_root, node_name)
        if not os.path.isdir(build_dir):
            continue

        # Fast path: known ESPHome/PlatformIO output locations.
        pioenvs_dir = os.path.join(build_dir, ".pioenvs")
        for filename in target_names:
            add_candidate(candidates, os.path.join(build_dir, filename))
            add_candidate(candidates, os.path.join(pioenvs_dir, node_name, filename))
            if os.path.isdir(pioenvs_dir):
                for env_name in os.listdir(pioenvs_dir):
                    add_candidate(candidates, os.path.join(pioenvs_dir, env_name, filename))

    if candidates:
        candidates.sort(key=lambda item: item[0], reverse=True)
        return candidates[0][1]

    # Fallback: deep scan for non-standard build layouts.
    for build_root in build_roots:
        build_dir = os.path.join(build_root, node_name)
        if not os.path.isdir(build_dir):
            continue
        for root, _, files in os.walk(build_dir):
            for filename in files:
                if filename not in target_names:
                    continue
                add_candidate(candidates, os.path.join(root, filename))

    if not candidates:
        return ""

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


@bp.route("/api/install", methods=["POST", "OPTIONS"])
def api_install():
    access = auth.check_access()
    if access:
        return access

    payload = request.get_json(silent=True) or {}
    yaml_name = normalize_yaml_filename(str(payload.get("yaml", "")))
    if not yaml_name:
        return jsonify({"status": "error", "message": "Invalid yaml"}), 400

    action = str(payload.get("action", "")).strip().lower()
    if action not in ("compile", "serial", "ota", "logs", "validate", "clean"):
        return jsonify({"status": "error", "message": "Invalid action"}), 400

    device = ""
    if action in ("ota", "logs"):
        device = normalize_device(str(payload.get("device", "")))
        if not device:
            return jsonify({"status": "error", "message": "Invalid device"}), 400

    serial_port = ""
    if action == "serial":
        try:
            serial_port = serial_ports.validate_host_serial_port(str(payload.get("port", "")))
        except (RuntimeError, ValueError) as exc:
            return jsonify({"status": "error", "message": str(exc)}), 400

    yaml_path = os.path.join(config.TARGET_DIR, yaml_name)
    if not os.path.isfile(yaml_path):
        return jsonify({"status": "error", "message": "YAML not found"}), 404

    job = current_app.extensions["job_manager"].submit(yaml_name, action, device, serial_port=serial_port)
    return jsonify({"status": "ok", "job_id": job.id, "job": job.to_dict()})


@bp.route("/api/jobs/<job_id>", methods=["GET"])
def api_job_status(job_id):
    access = auth.check_access()
    if access:
        return access

    job = current_app.extensions["job_manager"].get(job_id)
    if not job:
        return jsonify({"status": "error", "message": "Not found"}), 404

    return jsonify({"status": "ok", "job": job.to_dict()})


@bp.route("/api/jobs/<job_id>/tail", methods=["GET"])
def api_job_tail(job_id):
    access = auth.check_access()
    if access:
        return access

    job = current_app.extensions["job_manager"].get(job_id)
    if not job:
        return jsonify({"status": "error", "message": "Not found"}), 404

    try:
        limit = int(request.args.get("limit", "2000"))
    except ValueError:
        limit = 2000
    limit = max(1, min(5000, limit))

    try:
        since = int(request.args.get("since", "0"))
    except ValueError:
        since = 0

    entries = job.get_seq_entries(since=since, limit=limit)
    if entries:
        lines = [line for _, line in entries]
        next_seq = entries[-1][0]
    else:
        lines = read_log_tail(job.log_path, limit=limit)
        next_seq = job.get_last_seq()

    return jsonify(
        {
            "status": "ok",
            "job": job.to_dict(),
            "lines": lines,
            "next_seq": next_seq,
        }
    )


@bp.route("/api/jobs/<job_id>/tail-wait", methods=["GET"])
def api_job_tail_wait(job_id):
    access = auth.check_access()
    if access:
        return access

    job = current_app.extensions["job_manager"].get(job_id)
    if not job:
        return jsonify({"status": "error", "message": "Not found"}), 404

    try:
        since = int(request.args.get("since", "0"))
    except ValueError:
        since = 0
    if since < 0:
        since = 0

    try:
        timeout = float(request.args.get("timeout", "10"))
    except ValueError:
        timeout = 10.0
    timeout = max(1.0, min(20.0, timeout))

    try:
        limit = int(request.args.get("limit", "200"))
    except ValueError:
        limit = 200
    limit = max(1, min(1000, limit))

    entries = job.get_seq_entries(since=since, limit=limit)
    if entries:
        lines = [line for _, line in entries]
        next_seq = entries[-1][0]
        return jsonify(
            {
                "status": "ok",
                "job": job.to_dict(),
                "lines": lines,
                "next_seq": next_seq,
            }
        )

    listener = job.add_listener()
    done_payload = None
    deadline = time.time() + timeout
    try:
        while time.time() < deadline:
            remaining = max(0.1, deadline - time.time())
            try:
                item = listener.get(timeout=remaining)
            except queue.Empty:
                break
            if item["type"] == "log":
                break
            elif item["type"] == "done":
                done_payload = item["data"]
                break
    finally:
        job.remove_listener(listener)

    entries = job.get_seq_entries(since=since, limit=limit)
    lines = [line for _, line in entries]
    next_seq = entries[-1][0] if entries else job.get_last_seq()

    payload_job = done_payload if done_payload else job.to_dict()
    return jsonify(
        {
            "status": "ok",
            "job": payload_job,
            "lines": lines,
            "next_seq": next_seq,
        }
    )


@bp.route("/api/firmware", methods=["GET"])
def api_firmware():
    access = auth.check_access()
    if access:
        return access

    yaml_name = normalize_yaml_filename(str(request.args.get("yaml", "")))
    if not yaml_name:
        return jsonify({"status": "error", "message": "Invalid yaml"}), 400

    variant = str(request.args.get("variant", "ota")).strip().lower()
    if variant not in ("ota", "factory"):
        return jsonify({"status": "error", "message": "Invalid variant"}), 400

    node_name = yaml_name[:-5]
    firmware_path = find_firmware_path(node_name, variant)
    if not firmware_path or not os.path.isfile(firmware_path):
        if variant == "factory":
            return jsonify({"status": "error", "message": "Factory firmware not found"}), 404
        return jsonify({"status": "error", "message": "Firmware not found"}), 404

    download_name = f"{node_name}.bin"
    if variant == "factory":
        download_name = f"{node_name}.factory.bin"

    return send_file(
        firmware_path,
        mimetype="application/octet-stream",
        as_attachment=True,
        download_name=download_name,
    )


@bp.route("/api/jobs/<job_id>/stream", methods=["GET"])
def api_job_stream(job_id):
    access = auth.check_access()
    if access:
        return access

    job = current_app.extensions["job_manager"].get(job_id)
    if not job:
        return jsonify({"status": "error", "message": "Not found"}), 404

    def generate():
        yield ":" + (" " * 2048) + "\n\n"
        lines = job.get_recent_lines()
        if not lines:
            lines = read_log_tail(job.log_path)
        for line in lines:
            yield format_sse("log", line)

        if job.state in ("success", "failed", "canceled"):
            yield format_sse("done", json.dumps(job.to_dict()))
            return

        listener = job.add_listener()
        try:
            while True:
                try:
                    item = listener.get(timeout=1.0)
                except queue.Empty:
                    yield ": keepalive\n\n"
                    continue
                if item["type"] == "log":
                    yield format_sse("log", item["data"])
                elif item["type"] == "done":
                    yield format_sse("done", json.dumps(item["data"]))
                    break
        finally:
            job.remove_listener(listener)

    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }
    return Response(generate(), mimetype="text/event-stream", headers=headers)


@bp.route("/api/jobs/<job_id>/cancel", methods=["POST", "OPTIONS"])
def api_job_cancel(job_id):
    access = auth.check_access()
    if access:
        return access

    job = current_app.extensions["job_manager"].cancel(job_id)
    if not job:
        return jsonify({"status": "error", "message": "Not found"}), 404

    return jsonify({"status": "ok", "job": job.to_dict()})
