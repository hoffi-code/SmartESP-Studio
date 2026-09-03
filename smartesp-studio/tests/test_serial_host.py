import importlib.util
import pathlib
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

SERVER_PATH = pathlib.Path(__file__).resolve().parents[1] / "server.py"
sys.modules.setdefault(
    "pty", types.SimpleNamespace(openpty=lambda: (_ for _ in ()).throw(NotImplementedError()))
)
SPEC = importlib.util.spec_from_file_location("ses_server_serial", SERVER_PATH)
server = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(server)

import ses.config as config  # noqa: E402
from ses import serial_ports  # noqa: E402  (server import must run first)
from ses.esphome import Job, JobManager  # noqa: E402


class SerialHostTests(unittest.TestCase):
    def test_allowed_serial_port_paths_are_restricted(self):
        self.assertTrue(serial_ports.is_allowed_serial_port("/dev/ttyUSB0"))
        self.assertTrue(serial_ports.is_allowed_serial_port("/dev/ttyACM0"))
        self.assertTrue(serial_ports.is_allowed_serial_port("/dev/serial/by-id/usb-device"))
        self.assertFalse(serial_ports.is_allowed_serial_port("/dev/sda"))
        self.assertFalse(serial_ports.is_allowed_serial_port("/tmp/serial"))

    def test_validate_host_serial_port_requires_currently_enumerated_port(self):
        with patch.object(
            serial_ports,
            "list_host_serial_ports",
            return_value=[{"path": "/dev/ttyACM0"}],
        ):
            self.assertEqual(
                "/dev/ttyACM0", serial_ports.validate_host_serial_port("/dev/ttyACM0")
            )
            with self.assertRaises(ValueError):
                serial_ports.validate_host_serial_port("/dev/ttyUSB0")

    def test_serial_ports_endpoint_returns_backend_devices(self):
        original_mode = config.SES_MODE
        original_auth = config.SES_AUTH_MODE
        try:
            config.SES_MODE = "standalone"
            config.SES_AUTH_MODE = "none"
            ports = [{"path": "/dev/ttyUSB0", "description": "USB UART"}]
            with patch.object(serial_ports, "list_host_serial_ports", return_value=ports):
                response = server.app.test_client().get("/api/serial/ports")
            self.assertEqual(200, response.status_code)
            self.assertEqual(ports, response.json["ports"])
        finally:
            config.SES_MODE = original_mode
            config.SES_AUTH_MODE = original_auth

    def test_install_serial_requires_a_backend_enumerated_port(self):
        original_mode = config.SES_MODE
        original_auth = config.SES_AUTH_MODE
        try:
            config.SES_MODE = "standalone"
            config.SES_AUTH_MODE = "none"
            with patch.object(serial_ports, "list_host_serial_ports", return_value=[]):
                response = server.app.test_client().post(
                    "/api/install",
                    json={"yaml": "device.yaml", "action": "serial", "port": "/dev/ttyUSB0"},
                )
            self.assertEqual(400, response.status_code)
            self.assertEqual("Serial port is not available", response.json["message"])
        finally:
            config.SES_MODE = original_mode
            config.SES_AUTH_MODE = original_auth

    def test_serial_job_validates_compiles_and_uploads_to_selected_port(self):
        original_job_dir = config.JOB_DIR
        original_target_dir = config.TARGET_DIR
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                config.JOB_DIR = temp_dir
                config.TARGET_DIR = temp_dir
                manager = object.__new__(JobManager)
                job = Job(
                    "serial-test",
                    "device.yaml",
                    "serial",
                    "",
                    serial_port="/dev/ttyACM0",
                )
                commands = []
                manager._run_esphome = lambda current_job, args: commands.append(args) or 0
                with patch.object(serial_ports, "validate_host_serial_port", return_value="/dev/ttyACM0"):
                    manager._run_job(job)
                self.assertEqual(
                    [
                        ["config", str(pathlib.Path(temp_dir) / "device.yaml")],
                        ["compile", str(pathlib.Path(temp_dir) / "device.yaml")],
                        [
                            "upload",
                            str(pathlib.Path(temp_dir) / "device.yaml"),
                            "--device",
                            "/dev/ttyACM0",
                        ],
                    ],
                    commands,
                )
                self.assertEqual("success", job.state)
        finally:
            config.JOB_DIR = original_job_dir
            config.TARGET_DIR = original_target_dir

    def test_validate_job_also_compiles_to_catch_lambda_cpp_errors(self):
        original_job_dir = config.JOB_DIR
        original_target_dir = config.TARGET_DIR
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                config.JOB_DIR = temp_dir
                config.TARGET_DIR = temp_dir
                manager = object.__new__(JobManager)
                job = Job("validate-test", "device.yaml", "validate", "")
                commands = []
                manager._run_esphome = lambda current_job, args: commands.append(args) or 0
                manager._run_job(job)
                self.assertEqual(
                    [
                        ["config", str(pathlib.Path(temp_dir) / "device.yaml")],
                        ["compile", str(pathlib.Path(temp_dir) / "device.yaml")],
                    ],
                    commands,
                )
                self.assertEqual("success", job.state)
        finally:
            config.JOB_DIR = original_job_dir
            config.TARGET_DIR = original_target_dir

    def test_validate_job_skips_compile_when_config_fails(self):
        original_job_dir = config.JOB_DIR
        original_target_dir = config.TARGET_DIR
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                config.JOB_DIR = temp_dir
                config.TARGET_DIR = temp_dir
                manager = object.__new__(JobManager)
                job = Job("validate-fail-test", "device.yaml", "validate", "")
                commands = []

                def fake_run(current_job, args):
                    commands.append(args)
                    return 1

                manager._run_esphome = fake_run
                manager._run_job(job)
                self.assertEqual(
                    [["config", str(pathlib.Path(temp_dir) / "device.yaml")]],
                    commands,
                )
                self.assertEqual("failed", job.state)
        finally:
            config.JOB_DIR = original_job_dir
            config.TARGET_DIR = original_target_dir


if __name__ == "__main__":
    unittest.main()
