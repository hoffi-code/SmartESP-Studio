"""Test-run bootstrap.

The test modules import ``server.py`` directly, and importing it builds the
Flask app and its storage tree (``bootstrap_storage()``) at module load. The
defaults point at ``/config/esphome``, which isn't writable on a plain CI
runner or a non-root dev box, so collection would fail before any test runs.
Redirect every storage path at a throwaway temp dir unless the caller already
set one.
"""

import os
import tempfile

_ROOT = tempfile.mkdtemp(prefix="ses-tests-")

os.environ.setdefault("TARGET_DIR", os.path.join(_ROOT, "config"))
os.environ.setdefault("PROJECT_DIR", os.path.join(_ROOT, "config", "esp_projects"))
os.environ.setdefault("ASSET_ROOT", os.path.join(_ROOT, "config", "esp_assets"))
os.environ.setdefault("ESPHOME_CONFIG_DIR", os.path.join(_ROOT, "config"))
os.environ.setdefault("ESPHOME_DATA_DIR", os.path.join(_ROOT, "data"))
os.environ.setdefault("JOB_DIR", os.path.join(_ROOT, "jobs"))
os.environ.setdefault("DEVICES_PATH", os.path.join(_ROOT, "devices.json"))
