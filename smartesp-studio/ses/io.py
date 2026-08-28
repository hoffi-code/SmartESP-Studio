"""Filesystem helpers: JSON/text reads and writes, atomic replace, seeding, log tails."""

import json
import os
import shutil
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import List, Optional

from ses import config


def utc_now() -> str:
    # tzinfo dropped so the serialized form stays "<iso>Z" as before
    return f"{datetime.now(timezone.utc).replace(tzinfo=None).isoformat()}Z"


def timestamp_to_utc(value: float) -> str:
    return f"{datetime.fromtimestamp(value, timezone.utc).replace(tzinfo=None).isoformat()}Z"


def normalize_filename(value: str, extension: str) -> str:
    name = value.strip()
    if not name:
        return ""
    if "/" in name or "\\" in name:
        return ""
    if not config.VALID_NAME.match(name):
        return ""
    if not name.lower().endswith(extension):
        name = f"{name}{extension}"
    return name


def normalize_yaml_filename(value: str) -> str:
    name = value.strip()
    if not name:
        return ""
    if "/" in name or "\\" in name:
        return ""
    if not config.VALID_YAML.match(name):
        return ""
    return name


def normalize_device(value: str) -> str:
    name = value.strip()
    if not name:
        return ""
    if " " in name or "\t" in name or "\n" in name:
        return ""
    if not config.VALID_DEVICE.match(name):
        return ""
    return name


def is_same_filesystem_path(first: str, second: str) -> bool:
    if not first or not second:
        return False
    return os.path.normcase(os.path.abspath(first)) == os.path.normcase(os.path.abspath(second))


def read_log_tail(path: str, limit: int = 2000) -> List[str]:
    if not os.path.isfile(path):
        return []
    buffer = deque(maxlen=limit)
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            buffer.append(line.rstrip("\n"))
    return list(buffer)


def sanitize_log_line(line: str) -> str:
    if not line:
        return ""
    return config.ANSI_ESCAPE.sub("", line)


def should_skip_log_line(job_action: str, line: str) -> bool:
    if job_action != "logs":
        return False
    normalized = line.lower()
    if "esphome.ota" not in normalized:
        return False
    return "handshake" in normalized or "read magic" in normalized


def read_json_file(path: str) -> Optional[dict]:
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            return data
    except Exception:
        return None
    return None


def write_json_file(path: str, data: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def write_text_file_atomic(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = f"{path}.{uuid.uuid4().hex}.tmp"
    try:
        with open(temp_path, "w", encoding="utf-8") as handle:
            handle.write(content)
            if not content.endswith("\n"):
                handle.write("\n")
        os.replace(temp_path, path)
    finally:
        if os.path.isfile(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


def write_json_file_atomic(path: str, data: dict) -> None:
    body = json.dumps(data, ensure_ascii=False, indent=2)
    write_text_file_atomic(path, body)


def copy_if_missing(source: str, target: str) -> bool:
    if not os.path.isfile(source):
        return False
    if os.path.isfile(target):
        return False
    os.makedirs(os.path.dirname(target), exist_ok=True)
    shutil.copy2(source, target)
    return True


def seed_tree(source_root: str, target_root: str) -> None:
    """Copy seed files into /config without overwriting user data."""
    if not source_root or not os.path.isdir(source_root):
        return
    for root, _, files in os.walk(source_root):
        rel = os.path.relpath(root, source_root)
        dest_root = target_root if rel == "." else os.path.join(target_root, rel)
        os.makedirs(dest_root, exist_ok=True)
        for filename in files:
            source = os.path.join(root, filename)
            if not os.path.isfile(source):
                continue
            target = os.path.join(dest_root, filename)
            copy_if_missing(source, target)


def seed_assets() -> None:
    os.makedirs(config.ASSET_FONTS_DIR, exist_ok=True)
    os.makedirs(config.ASSET_IMAGES_DIR, exist_ok=True)
    os.makedirs(config.ASSET_AUDIO_DIR, exist_ok=True)
    os.makedirs(config.PROJECT_DIR, exist_ok=True)

    if not os.path.isfile(config.ASSET_FONTS_JSON):
        write_json_file(config.ASSET_FONTS_JSON, {"fonts": []})
    if not os.path.isfile(config.ASSET_IMAGES_JSON):
        write_json_file(config.ASSET_IMAGES_JSON, {"images": []})
    if not os.path.isfile(config.ASSET_AUDIO_JSON):
        write_json_file(config.ASSET_AUDIO_JSON, {"audio": []})
    if not os.path.isfile(config.ASSET_GFONTS_JSON):
        write_json_file(config.ASSET_GFONTS_JSON, {"families": []})
