"""Raw secrets.yaml read/write."""

import os
import uuid

from flask import Blueprint, jsonify, request

from ses import auth, config

bp = Blueprint("secrets", __name__)


@bp.route("/api/secrets/raw", methods=["GET", "OPTIONS"])
def api_secrets_raw_get():
    access = auth.check_access()
    if access:
        return access

    path = auth.resolve_secrets_path()
    if not os.path.isfile(path):
        return jsonify({"content": ""})

    try:
        with open(path, "r", encoding="utf-8", newline="") as handle:
            content = handle.read()
    except Exception as exc:
        return jsonify({"error": "Failed to read secrets file", "details": str(exc)}), 500

    return jsonify({"content": content})


@bp.route("/api/secrets/raw", methods=["POST", "OPTIONS"])
def api_secrets_raw_post():
    access = auth.check_access()
    if access:
        return access

    payload = request.get_json(silent=True) or {}
    content = payload.get("content")
    if not isinstance(content, str):
        return jsonify({"error": "Field 'content' must be a string"}), 400

    if len(content.encode("utf-8")) > config.SECRETS_RAW_MAX_BYTES:
        return jsonify({"error": "File too large"}), 400

    path = auth.resolve_secrets_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = f"{path}.{uuid.uuid4().hex}.tmp"

    try:
        with open(temp_path, "w", encoding="utf-8", newline="") as handle:
            handle.write(content)
        os.replace(temp_path, path)
    except Exception as exc:
        return jsonify({"error": "Failed to save secrets file", "details": str(exc)}), 500
    finally:
        if os.path.isfile(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

    return jsonify({"ok": True})
