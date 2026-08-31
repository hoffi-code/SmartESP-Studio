"""SPA catch-all: serve the built frontend, falling back to index.html."""

import os

from flask import Blueprint, jsonify, send_from_directory

from ses import auth

bp = Blueprint("ui", __name__)


@bp.route("/", defaults={"path": "index.html"})
@bp.route("/<path:path>")
def serve_ui(path):
    if path.startswith("api/") or path in ("save", "projects", "projects/save", "projects/list", "projects/load"):
        return jsonify({"status": "error", "message": "Not found"}), 404

    web_root = auth.resolve_web_root()
    if not web_root:
        return jsonify({"status": "error", "message": "UI not configured"}), 404

    file_path = os.path.join(web_root, path)
    if os.path.isdir(file_path):
        path = os.path.join(path, "index.html")
        file_path = os.path.join(web_root, path)

    if os.path.isfile(file_path):
        return send_from_directory(web_root, path)

    index_path = os.path.join(web_root, "index.html")
    if os.path.isfile(index_path):
        return send_from_directory(web_root, "index.html")

    return jsonify({"status": "error", "message": "UI not found"}), 404
