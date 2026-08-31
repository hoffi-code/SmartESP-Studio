"""Asset store: folder/index sync, manifest, filename validation, MDI glyph map."""

import os
import re
from typing import List
from urllib.parse import quote

from ses import config
from ses.io import read_json_file, timestamp_to_utc, write_json_file

# The Material Design Icons webfont ships with the app and is referenced verbatim
# by the generated display YAML, so it must not be renamed or deleted through the
# API. The Asset Manager also surfaces this as a per-entry "protected" flag.
PROTECTED_ASSET_FILES = {
    "fonts": frozenset({"materialdesignicons-webfont.ttf"}),
}


def is_protected_asset(kind: str, filename: str) -> bool:
    name = str(filename or "").strip().lower()
    return name in PROTECTED_ASSET_FILES.get(kind, frozenset())


def normalize_asset_label(filename: str) -> str:
    base = os.path.splitext(filename)[0]
    label = base.replace("_", " ").replace("-", " ").strip()
    return label or filename


def sync_asset_index(key: str, folder: str, json_path: str) -> dict:
    """Build an index JSON from on-disk assets and preserve existing metadata."""
    os.makedirs(folder, exist_ok=True)
    existing = read_json_file(json_path) or {}
    existing_list = existing.get(key, [])
    if not isinstance(existing_list, list):
        existing_list = []
    existing_map = {
        entry.get("file"): entry
        for entry in existing_list
        if isinstance(entry, dict) and entry.get("file")
    }

    files = [
        name
        for name in os.listdir(folder)
        if os.path.isfile(os.path.join(folder, name))
    ]
    files.sort()

    entries = []
    for filename in files:
        entry = existing_map.get(filename)
        if entry:
            entries.append(entry)
        else:
            entries.append({"label": normalize_asset_label(filename), "file": filename})

    data = dict(existing) if isinstance(existing, dict) else {}
    data[key] = entries
    if data != existing:
        write_json_file(json_path, data)
    return data


def sync_assets(kind: str = "all") -> dict:
    result = {}
    if kind in ("all", "fonts"):
        result["fonts"] = sync_asset_index("fonts", config.ASSET_FONTS_DIR, config.ASSET_FONTS_JSON)
    if kind in ("all", "images"):
        result["images"] = sync_asset_index("images", config.ASSET_IMAGES_DIR, config.ASSET_IMAGES_JSON)
    if kind in ("all", "audio"):
        result["audio"] = sync_asset_index("audio", config.ASSET_AUDIO_DIR, config.ASSET_AUDIO_JSON)
    return result


def parse_asset_kind(value: str) -> str:
    kind = str(value or "").strip().lower()
    if kind in ("images", "fonts", "audio"):
        return kind
    return ""


def parse_asset_refresh_flag(value: str) -> bool:
    normalized = str(value or "0").strip().lower()
    return normalized in ("1", "true", "yes", "on")


def asset_meta_for_kind(kind: str) -> dict:
    if kind == "images":
        return {
            "key": "images",
            "folder": config.ASSET_IMAGES_DIR,
            "json_path": config.ASSET_IMAGES_JSON,
            "max_bytes": config.ASSET_MAX_SIZE_BYTES["images"],
            "extensions": config.ASSET_ALLOWED_EXTENSIONS["images"],
            "mime": config.ASSET_ALLOWED_MIME["images"],
        }
    if kind == "fonts":
        return {
            "key": "fonts",
            "folder": config.ASSET_FONTS_DIR,
            "json_path": config.ASSET_FONTS_JSON,
            "max_bytes": config.ASSET_MAX_SIZE_BYTES["fonts"],
            "extensions": config.ASSET_ALLOWED_EXTENSIONS["fonts"],
            "mime": config.ASSET_ALLOWED_MIME["fonts"],
        }
    if kind == "audio":
        return {
            "key": "audio",
            "folder": config.ASSET_AUDIO_DIR,
            "json_path": config.ASSET_AUDIO_JSON,
            "max_bytes": config.ASSET_MAX_SIZE_BYTES["audio"],
            "extensions": config.ASSET_ALLOWED_EXTENSIONS["audio"],
            "mime": config.ASSET_ALLOWED_MIME["audio"],
        }
    return {}


def validate_asset_filename(filename: str) -> str:
    name = str(filename or "").strip()
    if not name:
        return ""
    if "\x00" in name:
        return ""
    if "/" in name or "\\" in name:
        return ""
    if name in (".", ".."):
        return ""
    if os.path.basename(name) != name:
        return ""
    return name


def validate_asset_extension(filename: str, allowed_extensions: set) -> bool:
    _, ext = os.path.splitext(filename)
    return ext.lower() in allowed_extensions


def ensure_asset_filename_available(folder: str, filename: str) -> str:
    base, ext = os.path.splitext(filename)
    candidate = filename
    index = 1
    while os.path.isfile(os.path.join(folder, candidate)):
        candidate = f"{base}_{index}{ext}"
        index += 1
    return candidate


def build_asset_entries(kind: str) -> List[dict]:
    meta = asset_meta_for_kind(kind)
    if not meta:
        return []

    folder = meta["folder"]
    key = meta["key"]
    json_path = meta["json_path"]
    allowed_extensions = meta["extensions"]

    os.makedirs(folder, exist_ok=True)
    index_payload = read_json_file(json_path) or {}
    indexed = index_payload.get(key, [])
    indexed_map = {
        item.get("file"): item
        for item in indexed
        if isinstance(item, dict) and item.get("file")
    }

    filenames = []
    for name in os.listdir(folder):
        path = os.path.join(folder, name)
        if not os.path.isfile(path):
            continue
        if not validate_asset_extension(name, allowed_extensions):
            continue
        filenames.append(name)
    filenames.sort(key=lambda item: item.lower())

    entries = []
    for name in filenames:
        full_path = os.path.join(folder, name)
        stats = os.stat(full_path)
        indexed_item = indexed_map.get(name, {})
        label = indexed_item.get("label") if isinstance(indexed_item, dict) else ""
        if not label:
            label = normalize_asset_label(name)
        _, ext = os.path.splitext(name)
        is_animation = kind == "images" and ext.lower() == ".gif"
        entries.append(
            {
                "file": name,
                "label": label,
                "size": stats.st_size,
                "mtime": timestamp_to_utc(stats.st_mtime),
                "type": ext.lower().lstrip("."),
                "isAnimation": is_animation,
                "protected": is_protected_asset(kind, name),
                "url": f"/api/assets/{kind}/{quote(name)}",
            }
        )
    return entries


def build_assets_manifest(kind: str, refresh: bool) -> dict:
    result = {}
    kinds = ["images", "fonts", "audio"] if kind == "all" else [kind]
    with config.ASSET_LOCK:
        if refresh:
            sync_assets(kind if kind in ("images", "fonts", "audio") else "all")
        for current_kind in kinds:
            result[current_kind] = {
                "kind": current_kind,
                "maxBytes": config.ASSET_MAX_SIZE_BYTES[current_kind],
                "extensions": sorted(list(config.ASSET_ALLOWED_EXTENSIONS[current_kind])),
                "items": build_asset_entries(current_kind),
            }
        if kind in ("all", "fonts"):
            gfonts_payload = read_json_file(config.ASSET_GFONTS_JSON) or {}
            families = gfonts_payload.get("families", [])
            result["googleFonts"] = families if isinstance(families, list) else []
    return result


def load_mdi_glyph_substitutions() -> dict:
    if not os.path.isfile(config.ASSET_GLYPH_SUBS):
        return {}

    result = {}
    pattern = re.compile(r'^\s{2}([^:\s][^:]*):\s+"([^"]+)"\s*$')
    try:
        with open(config.ASSET_GLYPH_SUBS, "r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.rstrip("\r\n")
                match = pattern.match(line)
                if not match:
                    continue
                key = match.group(1).strip()
                value = match.group(2)
                if key and value:
                    result[key] = value
    except Exception:
        return {}
    return result
