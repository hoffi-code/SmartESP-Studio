"""Runtime configuration read from the environment at import time.

Values are module attributes on purpose: tests override them with
`ecd.config.<NAME> = ...` (or patch.object) before exercising a route.
"""

import os
import re
import threading

TRUTHY_VALUES = {"1", "true", "yes", "on"}


def is_truthy(value: str) -> bool:
    return str(value or "").strip().lower() in TRUTHY_VALUES


def normalize_runtime_mode(value: str) -> str:
    mode = str(value or "").strip().lower()
    if mode in ("addon", "standalone"):
        return mode
    return "addon"


ECD_MODE = normalize_runtime_mode(os.environ.get("ECD_MODE", "addon"))
ESPHOME_IS_HA_ADDON = is_truthy(os.environ.get("ESPHOME_IS_HA_ADDON", "true" if ECD_MODE == "addon" else "false"))
ECD_STORAGE_MODE = os.environ.get("ECD_STORAGE_MODE", "").strip()
ECD_VERSION = os.environ.get("ECD_VERSION", "").strip()
ECD_AUTH_MODE = os.environ.get("ECD_AUTH_MODE", "none").strip().lower()
ECD_AUTH_USERNAME = os.environ.get("ECD_AUTH_USERNAME", "").strip()
ECD_AUTH_PASSWORD = os.environ.get("ECD_AUTH_PASSWORD", "")
ECD_AUTH_PASSWORD_FILE = os.environ.get("ECD_AUTH_PASSWORD_FILE", "").strip()
ECD_STATUS_USE_PING = is_truthy(os.environ.get("ECD_STATUS_USE_PING", "false"))

TARGET_DIR = os.environ.get("TARGET_DIR", "/config/esphome").strip()
PROJECT_DIR = os.environ.get("PROJECT_DIR", "/config/esphome/esp_projects").strip()
PORT = int(os.environ.get("PORT", "8099"))

JOB_DIR = os.environ.get("JOB_DIR", "/data/jobs").strip()
ESPHOME_BIN = os.environ.get("ESPHOME_BIN", "esphome").strip()
ESPHOME_CONFIG_DIR = os.environ.get("ESPHOME_CONFIG_DIR", "/config/esphome").strip()
ESPHOME_DATA_DIR = os.environ.get("ESPHOME_DATA_DIR", "/data/esphome").strip()
ESPHOME_BUILD_PATH = os.environ.get("ESPHOME_BUILD_PATH", "").strip()
WEB_ROOT = os.environ.get("WEB_ROOT", "/web").strip()
DEVICES_PATH = os.environ.get("DEVICES_PATH", "/data/devices.json").strip()
PING_PORT = int(os.environ.get("PING_PORT", "3232"))
PING_TIMEOUT = float(os.environ.get("PING_TIMEOUT", "0.8"))

ASSET_ROOT = os.environ.get("ASSET_ROOT", "/config/esphome/esp_assets").strip()
ASSET_FONTS_DIR = os.path.join(ASSET_ROOT, "fonts")
ASSET_IMAGES_DIR = os.path.join(ASSET_ROOT, "images")
ASSET_AUDIO_DIR = os.path.join(ASSET_ROOT, "audio")
ASSET_FONTS_JSON = os.path.join(ASSET_ROOT, "fonts.json")
ASSET_IMAGES_JSON = os.path.join(ASSET_ROOT, "images.json")
ASSET_AUDIO_JSON = os.path.join(ASSET_ROOT, "audio.json")
ASSET_GFONTS_JSON = os.path.join(ASSET_ROOT, "gfonts.json")
ASSET_GLYPH_SUBS = os.path.join(ASSET_ROOT, "mdi_glyph_substitutions.yaml")
SECRETS_FILENAME = "secrets.yaml"
SECRETS_RAW_MAX_BYTES = 256 * 1024

COMPONENTS_RUNTIME_ROOTNAME = "esp_components"
COMPONENTS_RUNTIME_FILENAME = "components_list.json"
COMPONENTS_BASE_LIST_PATH = os.path.join(WEB_ROOT, "components_list", "components_list.json")
COMPONENTS_BASE_SCHEMAS_ROOT = os.path.join(WEB_ROOT, "schemas", "components")
COMPONENTS_IMPORT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
COMPONENTS_IMPORT_MAX_FILES = 500
COMPONENTS_IMPORT_MAX_UNPACKED_BYTES = 30 * 1024 * 1024
COMPONENTS_IMPORT_MAX_ITEM_ERRORS = 100

ASSET_ALLOWED_EXTENSIONS = {
    "fonts": {".ttf", ".otf"},
    "images": {".png", ".bmp", ".gif"},
    "audio": {".mp3", ".wav", ".ogg"},
}
ASSET_MAX_SIZE_BYTES = {
    "fonts": 5 * 1024 * 1024,
    "images": 10 * 1024 * 1024,
    "audio": 10 * 1024 * 1024,
}
ASSET_ALLOWED_MIME = {
    "fonts": {
        "font/ttf",
        "application/x-font-ttf",
        "font/otf",
        "application/x-font-otf",
        "application/font-sfnt",
        "application/octet-stream",
    },
    "images": {
        "image/png",
        "image/bmp",
        "image/gif",
        "application/octet-stream",
    },
    "audio": {
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/ogg",
        "application/ogg",
        "application/octet-stream",
    },
}

ASSET_LOCK = threading.Lock()
COMPONENTS_LOCK = threading.Lock()

SEED_ROOT = os.environ.get("SEED_ROOT", "/seed_esphome").strip()

VALID_NAME = re.compile(r"^[A-Za-z0-9_.-]+$")
VALID_YAML = re.compile(r"^[A-Za-z0-9_.-]+\.yaml$")
VALID_DEVICE = re.compile(r"^[A-Za-z0-9._-]+$")
VALID_COMPONENT_TOKEN = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
ANSI_ESCAPE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
SERIAL_PORT_PREFIXES = ("/dev/ttyUSB", "/dev/ttyACM", "/dev/serial/by-id/")
