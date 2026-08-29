"""Asset manager: manifest, upload, rename, delete, MDI substitutions."""

import mimetypes
import os

from flask import Blueprint, jsonify, request, send_from_directory

from ses import assets, auth, config
from ses.errors import json_error

bp = Blueprint("assets", __name__)


@bp.route("/api/assets/refresh", methods=["POST"])
def api_assets_refresh():
    access = auth.check_access()
    if access:
        return access

    kind = str(request.args.get("kind", "all")).strip().lower()
    if kind not in ("all", "fonts", "images", "audio"):
        return jsonify({"status": "error", "message": "Invalid kind"}), 400

    with config.ASSET_LOCK:
        payload = assets.sync_assets(kind)
    return jsonify({"status": "ok", **payload})


@bp.route("/api/assets/manifest", methods=["GET", "OPTIONS"])
def api_assets_manifest():
    access = auth.check_access()
    if access:
        return access

    kind = str(request.args.get("kind", "all")).strip().lower()
    if kind not in ("all", "images", "fonts", "audio"):
        return json_error("Invalid kind", "ASSET_INVALID_KIND", 400)

    refresh = assets.parse_asset_refresh_flag(request.args.get("refresh", "0"))
    payload = assets.build_assets_manifest(kind, refresh)
    return jsonify({"status": "ok", **payload})


@bp.route("/api/assets/mdi-substitutions", methods=["GET", "OPTIONS"])
def api_assets_mdi_substitutions():
    access = auth.check_access()
    if access:
        return access

    with config.ASSET_LOCK:
        substitutions = assets.load_mdi_glyph_substitutions()
    return jsonify({"status": "ok", "substitutions": substitutions})


@bp.route("/api/assets/upload", methods=["POST", "OPTIONS"])
def api_assets_upload():
    access = auth.check_access()
    if access:
        return access

    kind = assets.parse_asset_kind(request.args.get("kind", ""))
    if not kind:
        return json_error("Invalid kind", "ASSET_INVALID_KIND", 400)

    if "file" not in request.files:
        return json_error("Missing file", "ASSET_FILE_REQUIRED", 400)

    upload = request.files["file"]
    original_name = assets.validate_asset_filename(upload.filename)
    if not original_name:
        return json_error("Invalid filename", "ASSET_INVALID_FILENAME", 400)

    meta = assets.asset_meta_for_kind(kind)
    if not assets.validate_asset_extension(original_name, meta["extensions"]):
        return json_error("Unsupported extension", "ASSET_UNSUPPORTED_EXTENSION", 400)

    mime_type = str(upload.mimetype or "").lower().strip()
    if mime_type and mime_type not in meta["mime"]:
        return json_error("Unsupported mime type", "ASSET_UNSUPPORTED_MIME", 400)

    raw = upload.stream.read(meta["max_bytes"] + 1)
    if len(raw) > meta["max_bytes"]:
        return json_error("File too large", "ASSET_FILE_TOO_LARGE", 413)
    if not raw:
        return json_error("Empty file", "ASSET_EMPTY_FILE", 400)

    with config.ASSET_LOCK:
        os.makedirs(meta["folder"], exist_ok=True)
        filename = assets.ensure_asset_filename_available(meta["folder"], original_name)
        path = os.path.join(meta["folder"], filename)
        with open(path, "wb") as handle:
            handle.write(raw)
        assets.sync_assets(kind)
        entries = assets.build_asset_entries(kind)
        created = next((item for item in entries if item.get("file") == filename), None)

    return jsonify(
        {
            "status": "ok",
            "kind": kind,
            "file": filename,
            "renamed": filename != original_name,
            "item": created,
        }
    )


@bp.route("/api/assets/rename", methods=["POST", "OPTIONS"])
def api_assets_rename():
    access = auth.check_access()
    if access:
        return access

    payload = request.get_json(silent=True) or {}
    kind = assets.parse_asset_kind(payload.get("kind", ""))
    if not kind:
        return json_error("Invalid kind", "ASSET_INVALID_KIND", 400)

    source_name = assets.validate_asset_filename(payload.get("from", ""))
    target_name = assets.validate_asset_filename(payload.get("to", ""))
    if not source_name or not target_name:
        return json_error("Invalid filename", "ASSET_INVALID_FILENAME", 400)

    meta = assets.asset_meta_for_kind(kind)
    if not assets.validate_asset_extension(source_name, meta["extensions"]):
        return json_error("Unsupported source extension", "ASSET_UNSUPPORTED_EXTENSION", 400)
    if not assets.validate_asset_extension(target_name, meta["extensions"]):
        return json_error("Unsupported target extension", "ASSET_UNSUPPORTED_EXTENSION", 400)

    with config.ASSET_LOCK:
        source_path = os.path.join(meta["folder"], source_name)
        if not os.path.isfile(source_path):
            return json_error("Source not found", "ASSET_NOT_FOUND", 404)

        final_name = assets.ensure_asset_filename_available(meta["folder"], target_name)
        target_path = os.path.join(meta["folder"], final_name)
        os.rename(source_path, target_path)
        assets.sync_assets(kind)
        entries = assets.build_asset_entries(kind)
        item = next((entry for entry in entries if entry.get("file") == final_name), None)

    return jsonify(
        {
            "status": "ok",
            "kind": kind,
            "from": source_name,
            "to": final_name,
            "renamed": final_name != target_name,
            "item": item,
        }
    )


@bp.route("/api/assets/<kind>/<path:filename>", methods=["GET", "DELETE", "OPTIONS"])
def api_assets_file(kind, filename):
    access = auth.check_access()
    if access:
        return access

    parsed_kind = assets.parse_asset_kind(kind)
    if not parsed_kind:
        return json_error("Invalid kind", "ASSET_INVALID_KIND", 400)

    safe_name = assets.validate_asset_filename(filename)
    if not safe_name:
        return json_error("Invalid filename", "ASSET_INVALID_FILENAME", 400)

    meta = assets.asset_meta_for_kind(parsed_kind)
    if not assets.validate_asset_extension(safe_name, meta["extensions"]):
        return json_error("Unsupported extension", "ASSET_UNSUPPORTED_EXTENSION", 400)

    if request.method == "GET":
        target = os.path.join(meta["folder"], safe_name)
        if not os.path.isfile(target):
            return json_error("Not found", "ASSET_NOT_FOUND", 404)
        guessed, _ = mimetypes.guess_type(safe_name)
        if guessed:
            return send_from_directory(meta["folder"], safe_name, mimetype=guessed)
        return send_from_directory(meta["folder"], safe_name)

    with config.ASSET_LOCK:
        target = os.path.join(meta["folder"], safe_name)
        if not os.path.isfile(target):
            return json_error("Not found", "ASSET_NOT_FOUND", 404)
        os.remove(target)
        assets.sync_assets(parsed_kind)

    return jsonify({"status": "ok", "kind": parsed_kind, "file": safe_name})
