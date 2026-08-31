"""Import flows: ESPHome-config YAML candidates, target listings, project bundle import."""

import os

from flask import Blueprint, jsonify, request

from ses import auth, config, projects
from ses.io import (
    is_same_filesystem_path,
    normalize_filename,
    normalize_yaml_filename,
    timestamp_to_utc,
    write_json_file_atomic,
    write_text_file_atomic,
)

bp = Blueprint("imports", __name__)


@bp.route("/api/import/yaml-candidates", methods=["GET", "OPTIONS"])
def import_yaml_candidates():
    access = auth.check_access()
    if access:
        return access

    if not os.path.isdir(config.ESPHOME_CONFIG_DIR):
        return jsonify({"status": "ok", "items": []})

    items = []
    for entry in os.listdir(config.ESPHOME_CONFIG_DIR):
        filename = normalize_yaml_filename(str(entry))
        if not filename or filename.lower() == config.SECRETS_FILENAME:
            continue
        path = os.path.join(config.ESPHOME_CONFIG_DIR, filename)
        if not os.path.isfile(path):
            continue
        project_name = normalize_filename(f"{filename[:-5]}.json", ".json")
        try:
            stat = os.stat(path)
            size = stat.st_size
            mtime = timestamp_to_utc(stat.st_mtime)
        except Exception:
            size = 0
            mtime = ""
        items.append(
            {
                "name": filename,
                "size": size,
                "mtime": mtime,
                "projectName": project_name,
                "projectExists": bool(project_name and os.path.isfile(os.path.join(config.PROJECT_DIR, project_name))),
            }
        )

    items.sort(key=lambda item: item["name"].lower())
    return jsonify({"status": "ok", "items": items})


@bp.route("/api/import/targets", methods=["GET", "OPTIONS"])
def import_targets():
    access = auth.check_access()
    if access:
        return access

    yaml_names = []
    if os.path.isdir(config.TARGET_DIR):
        for entry in os.listdir(config.TARGET_DIR):
            filename = normalize_yaml_filename(str(entry))
            if not filename or filename.lower() == config.SECRETS_FILENAME:
                continue
            if os.path.isfile(os.path.join(config.TARGET_DIR, filename)):
                yaml_names.append(filename)

    project_names = []
    if os.path.isdir(config.PROJECT_DIR):
        for entry in os.listdir(config.PROJECT_DIR):
            filename = normalize_filename(str(entry), ".json")
            if not filename or filename.lower() == "projects.json":
                continue
            if os.path.isfile(os.path.join(config.PROJECT_DIR, filename)):
                project_names.append(filename)

    return jsonify(
        {
            "status": "ok",
            "yamlNames": sorted(set(yaml_names), key=str.lower),
            "projectNames": sorted(set(project_names), key=str.lower),
        }
    )


@bp.route("/api/import/yaml", methods=["GET", "OPTIONS"])
def import_yaml_load():
    access = auth.check_access()
    if access:
        return access

    filename = normalize_yaml_filename(str(request.args.get("name") or request.args.get("filename") or ""))
    if not filename or filename.lower() == config.SECRETS_FILENAME:
        return jsonify({"status": "error", "message": "Invalid name"}), 400

    path = os.path.join(config.ESPHOME_CONFIG_DIR, filename)
    if not os.path.isfile(path):
        return jsonify({"status": "error", "message": "Not found"}), 404

    try:
        with open(path, "r", encoding="utf-8") as handle:
            yaml_text = handle.read()
    except Exception:
        return jsonify({"status": "error", "message": "Read failed"}), 500

    return jsonify({"status": "ok", "name": filename, "yaml": yaml_text})


@bp.route("/api/import/project", methods=["POST", "OPTIONS"])
def import_project_bundle():
    access = auth.check_access()
    if access:
        return access

    payload = request.get_json(silent=True) or {}
    project_name = normalize_filename(str(payload.get("projectName") or payload.get("name") or ""), ".json")
    yaml_name = normalize_yaml_filename(str(payload.get("yamlName") or payload.get("yamlFilename") or ""))
    if not project_name:
        return jsonify({"status": "error", "message": "Invalid projectName"}), 400
    if project_name.lower() == "projects.json":
        return jsonify({"status": "error", "message": "Reserved project index name"}), 400
    if not yaml_name or yaml_name.lower() == config.SECRETS_FILENAME:
        return jsonify({"status": "error", "message": "Invalid yamlName"}), 400

    project_data = payload.get("projectData")
    if not isinstance(project_data, dict):
        return jsonify({"status": "error", "message": "projectData must be an object"}), 400
    if project_data.get("schemaVersion") != 1:
        return jsonify({"status": "error", "message": "Unsupported projectData schemaVersion"}), 400

    yaml_text = payload.get("yaml")
    if not isinstance(yaml_text, str):
        return jsonify({"status": "error", "message": "yaml must be a string"}), 400

    source_yaml_name = ""
    if payload.get("sourceYamlName") is not None:
        source_yaml_name = normalize_yaml_filename(str(payload.get("sourceYamlName") or ""))
        if not source_yaml_name or source_yaml_name.lower() == config.SECRETS_FILENAME:
            return jsonify({"status": "error", "message": "Invalid sourceYamlName"}), 400

    import_report = payload.get("importReport")
    if import_report is not None and not isinstance(import_report, dict):
        return jsonify({"status": "error", "message": "importReport must be an object"}), 400

    overwrite = bool(payload.get("overwrite") is True)
    project_path = os.path.join(config.PROJECT_DIR, project_name)
    yaml_path = os.path.join(config.TARGET_DIR, yaml_name)
    allow_existing_source_yaml = False
    if source_yaml_name:
        source_yaml_path = os.path.join(config.ESPHOME_CONFIG_DIR, source_yaml_name)
        if not os.path.isfile(source_yaml_path):
            return jsonify(
                {
                    "status": "error",
                    "message": "Source YAML is no longer available",
                    "conflicts": {"project": os.path.exists(project_path), "yaml": source_yaml_name == yaml_name},
                }
            ), 409
        try:
            with open(source_yaml_path, "r", encoding="utf-8") as handle:
                existing_yaml_text = handle.read()
        except Exception:
            return jsonify({"status": "error", "message": "Source YAML read failed"}), 500
        source_yaml_matches_payload = existing_yaml_text == yaml_text
        source_is_target_yaml = source_yaml_name == yaml_name and is_same_filesystem_path(source_yaml_path, yaml_path)
        allow_existing_source_yaml = source_is_target_yaml and source_yaml_matches_payload
        if not source_yaml_matches_payload:
            return jsonify(
                {
                    "status": "error",
                    "message": "Source YAML changed before import save",
                    "conflicts": {"project": os.path.exists(project_path), "yaml": source_is_target_yaml},
                }
            ), 409
    conflicts = {
        "project": os.path.exists(project_path),
        "yaml": os.path.exists(yaml_path) and not allow_existing_source_yaml,
    }
    if not overwrite and (conflicts["project"] or conflicts["yaml"]):
        return jsonify({"status": "error", "message": "Import target already exists", "conflicts": conflicts}), 409

    project_payload = dict(project_data)
    project_payload["isSaved"] = True
    if import_report is not None:
        project_payload["importReport"] = import_report

    try:
        os.makedirs(config.PROJECT_DIR, exist_ok=True)
        os.makedirs(config.TARGET_DIR, exist_ok=True)
        write_json_file_atomic(project_path, project_payload)
        if not allow_existing_source_yaml:
            write_text_file_atomic(yaml_path, yaml_text)
        projects.save_projects_index(projects.add_project_to_index(project_name))
    except Exception as exc:
        return jsonify({"status": "error", "message": "Import save failed", "details": str(exc)}), 500

    return jsonify(
        {
            "status": "ok",
            "projectName": project_name,
            "yamlName": yaml_name,
            "projectPath": project_path,
            "yamlPath": yaml_path,
        }
    )
