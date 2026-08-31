"""Project index: save/list/load/delete/rename, purge project+yaml+device bundle."""

import json
import os

from flask import Blueprint, jsonify, request

from ses import auth, config, projects
from ses import devices as dev
from ses.io import normalize_filename, normalize_yaml_filename

bp = Blueprint("projects", __name__)


@bp.route("/projects/save", methods=["POST", "OPTIONS"])
def save_project():
    access = auth.check_access()
    if access:
        return access

    payload = request.get_json(silent=True) or {}
    name_value = payload.get("name") or payload.get("filename") or ""
    filename = normalize_filename(str(name_value), ".json")
    if not filename:
        return jsonify({"status": "error", "message": "Invalid name"}), 400

    data = payload.get("data", None)
    if data is None:
        return jsonify({"status": "error", "message": "Missing data"}), 400

    try:
        if isinstance(data, str):
            parsed = json.loads(data)
        else:
            parsed = data
        body = json.dumps(parsed, ensure_ascii=False, indent=2)
    except Exception:
        return jsonify({"status": "error", "message": "Invalid JSON"}), 400

    os.makedirs(config.PROJECT_DIR, exist_ok=True)
    path = os.path.join(config.PROJECT_DIR, filename)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(body)
        if not body.endswith("\n"):
            handle.write("\n")

    return jsonify({"status": "ok", "path": path})


@bp.route("/projects/list", methods=["GET", "OPTIONS"])
def list_projects():
    access = auth.check_access()
    if access:
        return access

    if not os.path.isdir(config.PROJECT_DIR):
        return jsonify({"status": "ok", "projects": []})

    files = [
        entry
        for entry in os.listdir(config.PROJECT_DIR)
        if entry.lower().endswith(".json")
        and os.path.isfile(os.path.join(config.PROJECT_DIR, entry))
    ]
    files.sort()

    return jsonify({"status": "ok", "projects": files})


@bp.route("/projects/load", methods=["GET", "OPTIONS"])
def load_project():
    access = auth.check_access()
    if access:
        return access

    name_value = request.args.get("name") or request.args.get("filename") or ""
    filename = normalize_filename(str(name_value), ".json")
    if not filename:
        return jsonify({"status": "error", "message": "Invalid name"}), 400

    path = os.path.join(config.PROJECT_DIR, filename)
    if not os.path.isfile(path):
        return jsonify({"status": "error", "message": "Not found"}), 404

    try:
        with open(path, "r", encoding="utf-8") as handle:
            content = handle.read()
        data = json.loads(content)
    except Exception:
        return jsonify({"status": "error", "message": "Invalid JSON file"}), 500

    return jsonify({"status": "ok", "name": filename, "data": data})


@bp.route("/projects/delete", methods=["DELETE", "OPTIONS"])
def delete_project():
    access = auth.check_access()
    if access:
        return access

    name_value = request.args.get("name") or request.args.get("filename") or ""
    filename = normalize_filename(str(name_value), ".json")
    if not filename:
        return jsonify({"status": "error", "message": "Invalid name"}), 400

    path = os.path.join(config.PROJECT_DIR, filename)
    if not os.path.isfile(path):
        return jsonify({"status": "error", "message": "Not found"}), 404

    try:
        os.remove(path)
    except Exception:
        return jsonify({"status": "error", "message": "Delete failed"}), 500

    return jsonify({"status": "ok", "name": filename})


@bp.route("/api/projects/purge", methods=["DELETE", "OPTIONS"])
def purge_project_bundle():
    access = auth.check_access()
    if access:
        return access

    name_value = request.args.get("name") or request.args.get("filename") or ""
    project_filename = normalize_filename(str(name_value), ".json")
    if not project_filename:
        return jsonify({"status": "error", "message": "Invalid name"}), 400
    if project_filename.lower() == "projects.json":
        return jsonify({"status": "error", "message": "Reserved project index name"}), 400

    yaml_filename = normalize_yaml_filename(f"{project_filename[:-5]}.yaml")
    if not yaml_filename:
        return jsonify({"status": "error", "message": "Invalid derived yaml name"}), 400

    project_path = os.path.join(config.PROJECT_DIR, project_filename)
    yaml_path = os.path.join(config.TARGET_DIR, yaml_filename)

    placement_updated = projects.remove_project_from_index(project_filename)

    project_deleted = False
    if os.path.isfile(project_path):
        try:
            os.remove(project_path)
            project_deleted = True
        except Exception:
            return jsonify({"status": "error", "message": "Project delete failed"}), 500

    yaml_deleted = False
    if os.path.isfile(yaml_path):
        try:
            os.remove(yaml_path)
            yaml_deleted = True
        except Exception:
            return jsonify({"status": "error", "message": "YAML delete failed"}), 500

    unregistered, removed_count = dev.unregister_device_record(yaml_name=yaml_filename)

    return jsonify(
        {
            "status": "ok",
            "name": project_filename,
            "yaml": yaml_filename,
            "result": {
                "placement_updated": placement_updated,
                "project_deleted": project_deleted,
                "yaml_deleted": yaml_deleted,
                "device_unregistered": unregistered,
                "unregistered_count": removed_count,
            },
        }
    )


@bp.route("/projects/rename", methods=["POST", "OPTIONS"])
def rename_project():
    access = auth.check_access()
    if access:
        return access

    payload = request.get_json(silent=True) or {}
    old_value = payload.get("name") or payload.get("old_name") or payload.get("from") or ""
    new_value = payload.get("new_name") or payload.get("to") or ""

    old_name = normalize_filename(str(old_value), ".json")
    new_name = normalize_filename(str(new_value), ".json")
    if not old_name or not new_name:
        return jsonify({"status": "error", "message": "Invalid name"}), 400
    if old_name.lower() == "projects.json" or new_name.lower() == "projects.json":
        return jsonify({"status": "error", "message": "Reserved project index name"}), 400
    if old_name == new_name:
        return jsonify({"status": "ok", "name": old_name, "new_name": new_name})

    old_yaml = normalize_yaml_filename(f"{old_name[:-5]}.yaml")
    new_yaml = normalize_yaml_filename(f"{new_name[:-5]}.yaml")
    if not old_yaml or not new_yaml:
        return jsonify({"status": "error", "message": "Invalid derived yaml name"}), 400

    old_path = os.path.join(config.PROJECT_DIR, old_name)
    new_path = os.path.join(config.PROJECT_DIR, new_name)
    old_yaml_path = os.path.join(config.TARGET_DIR, old_yaml)
    new_yaml_path = os.path.join(config.TARGET_DIR, new_yaml)
    if not os.path.isfile(old_path):
        return jsonify({"status": "error", "message": "Source not found"}), 404
    if os.path.exists(new_path):
        return jsonify({"status": "error", "message": "Target already exists"}), 409
    if old_yaml != new_yaml and os.path.exists(new_yaml_path):
        return jsonify({"status": "error", "message": "Target YAML already exists"}), 409

    project_renamed = False
    yaml_renamed = False
    placement_updated = False
    try:
        if old_yaml != new_yaml and os.path.isfile(old_yaml_path):
            os.rename(old_yaml_path, new_yaml_path)
            yaml_renamed = True
        os.rename(old_path, new_path)
        project_renamed = True
        placement_updated = projects.rename_project_in_index(old_name, new_name)
    except Exception:
        if placement_updated:
            try:
                projects.rename_project_in_index(new_name, old_name)
            except Exception:
                pass
        if project_renamed and os.path.isfile(new_path) and not os.path.exists(old_path):
            try:
                os.rename(new_path, old_path)
            except Exception:
                pass
        if yaml_renamed and os.path.isfile(new_yaml_path) and not os.path.exists(old_yaml_path):
            try:
                os.rename(new_yaml_path, old_yaml_path)
            except Exception:
                pass
        return jsonify({"status": "error", "message": "Rename failed"}), 500

    return jsonify(
        {
            "status": "ok",
            "name": old_name,
            "new_name": new_name,
            "yaml": {"name": old_yaml, "new_name": new_yaml, "renamed": yaml_renamed},
            "result": {"project_renamed": project_renamed, "placement_updated": placement_updated},
        }
    )
