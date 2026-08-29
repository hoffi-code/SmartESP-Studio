"""Raw YAML file read/write/delete under the target directory."""

import os

from flask import Blueprint, jsonify, request

from ses import auth, config
from ses.io import normalize_filename, normalize_yaml_filename

bp = Blueprint("yaml_files", __name__)


@bp.route("/save", methods=["POST", "OPTIONS"])
def save_yaml():
    access = auth.check_access()
    if access:
        return access

    payload = request.get_json(silent=True) or {}
    filename = normalize_filename(str(payload.get("filename", "")), ".yaml")
    if not filename:
        return jsonify({"status": "error", "message": "Invalid filename"}), 400

    yaml_text = payload.get("yaml", "")
    if not isinstance(yaml_text, str):
        return jsonify({"status": "error", "message": "Invalid yaml"}), 400

    os.makedirs(config.TARGET_DIR, exist_ok=True)
    path = os.path.join(config.TARGET_DIR, filename)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(yaml_text)
        if not yaml_text.endswith("\n"):
            handle.write("\n")

    return jsonify({"status": "ok", "path": path})


@bp.route("/yaml/load", methods=["GET", "OPTIONS"])
def load_yaml():
    access = auth.check_access()
    if access:
        return access

    name_value = request.args.get("name") or request.args.get("filename") or ""
    filename = normalize_yaml_filename(str(name_value))
    if not filename:
        return jsonify({"status": "error", "message": "Invalid name"}), 400

    path = os.path.join(config.TARGET_DIR, filename)
    if not os.path.isfile(path):
        return jsonify({"status": "error", "message": "Not found"}), 404

    try:
        with open(path, "r", encoding="utf-8") as handle:
            yaml_text = handle.read()
    except Exception:
        return jsonify({"status": "error", "message": "Read failed"}), 500

    return jsonify({"status": "ok", "name": filename, "yaml": yaml_text})


@bp.route("/yaml/delete", methods=["DELETE", "OPTIONS"])
def delete_yaml():
    access = auth.check_access()
    if access:
        return access

    name_value = request.args.get("name") or request.args.get("filename") or ""
    filename = normalize_yaml_filename(str(name_value))
    if not filename:
        return jsonify({"status": "error", "message": "Invalid name"}), 400

    path = os.path.join(config.TARGET_DIR, filename)
    if not os.path.isfile(path):
        return jsonify({"status": "error", "message": "Not found"}), 404

    try:
        os.remove(path)
    except Exception:
        return jsonify({"status": "error", "message": "Delete failed"}), 500

    return jsonify({"status": "ok", "name": filename})
