"""Component catalog: merged view, schema files, ZIP import, custom components."""

import io
import json
import os
import zipfile

from flask import Blueprint, jsonify, request, send_from_directory

from ses import auth, catalog, config
from ses.errors import json_error

bp = Blueprint("components", __name__)


@bp.route("/api/component-catalog", methods=["GET", "OPTIONS"])
def api_component_catalog():
    access = auth.check_access()
    if access:
        return access

    base_catalog = catalog.load_components_catalog(config.COMPONENTS_BASE_LIST_PATH)
    runtime_path = catalog.components_runtime_list_path()
    runtime_catalog = catalog.load_components_catalog(runtime_path) if os.path.isfile(runtime_path) else None
    merged = catalog.merge_component_catalogs(base_catalog, runtime_catalog)
    return jsonify({"status": "ok", "catalog": merged})


@bp.route("/api/component-schemas/<path:relpath>", methods=["GET", "OPTIONS"])
def api_component_schema(relpath):
    access = auth.check_access()
    if access:
        return access

    schema_relpath = catalog.normalize_component_schema_relpath(relpath)
    if not schema_relpath:
        return json_error("Invalid schema path", "COMPONENTS_SCHEMA_PATH_INVALID", 400)

    runtime_base = os.path.join(catalog.components_runtime_root(), "schemas")
    base_base = os.path.join(config.WEB_ROOT, "schemas")

    runtime_candidate = catalog.resolve_component_schema_path(runtime_base, schema_relpath)
    if runtime_candidate and os.path.isfile(runtime_candidate):
        return send_from_directory(runtime_base, schema_relpath.replace("/", os.sep), mimetype="application/json")

    base_candidate = catalog.resolve_component_schema_path(base_base, schema_relpath)
    if base_candidate and os.path.isfile(base_candidate):
        return send_from_directory(base_base, schema_relpath.replace("/", os.sep), mimetype="application/json")

    return json_error("Schema not found", "COMPONENTS_SCHEMA_NOT_FOUND", 404)


@bp.route("/api/components/import-zip", methods=["POST", "OPTIONS"])
def api_components_import_zip():
    access = auth.check_access()
    if access:
        return access

    if "file" not in request.files:
        return json_error("Missing file", "COMPONENTS_FILE_REQUIRED", 400)

    upload = request.files["file"]
    filename = str(upload.filename or "").strip().lower()
    if not filename.endswith(".zip"):
        return json_error("Only .zip imports are supported", "COMPONENTS_ZIP_REQUIRED", 400)

    raw = upload.stream.read(config.COMPONENTS_IMPORT_MAX_UPLOAD_BYTES + 1)
    if len(raw) > config.COMPONENTS_IMPORT_MAX_UPLOAD_BYTES:
        return json_error("Zip file too large", "COMPONENTS_ZIP_TOO_LARGE", 413)
    if not raw:
        return json_error("Empty zip file", "COMPONENTS_EMPTY_ZIP", 400)

    try:
        archive = zipfile.ZipFile(io.BytesIO(raw))
    except Exception:
        return json_error("Invalid zip archive", "COMPONENTS_INVALID_ZIP", 400)

    try:
        infos = archive.infolist()
    except Exception:
        archive.close()
        return json_error("Failed to read zip archive", "COMPONENTS_INVALID_ZIP", 400)

    total_unpacked = 0
    safe_members = {}
    schema_members = set()
    for info in infos:
        raw_member_name = str(info.filename or "")
        if info.is_dir() or raw_member_name.endswith("/") or raw_member_name.endswith("\\"):
            continue
        if len(safe_members) >= config.COMPONENTS_IMPORT_MAX_FILES:
            archive.close()
            return json_error("Too many files in zip", "COMPONENTS_ZIP_TOO_MANY_FILES", 400)

        safe_name = catalog.safe_zip_component_package_member_path(info.filename)
        if not safe_name:
            archive.close()
            return json_error("Invalid file in zip package", "COMPONENTS_ZIP_INVALID_FILE", 400)
        if safe_name in safe_members:
            archive.close()
            return json_error("Duplicate file path in zip package", "COMPONENTS_ZIP_DUPLICATE_PATH", 400)

        total_unpacked += max(0, int(info.file_size or 0))
        if total_unpacked > config.COMPONENTS_IMPORT_MAX_UNPACKED_BYTES:
            archive.close()
            return json_error("Zip unpacked size is too large", "COMPONENTS_ZIP_UNPACKED_TOO_LARGE", 400)

        safe_members[safe_name] = info
        if safe_name == "LICENSE.md":
            continue
        if safe_name.startswith("schemas/components/"):
            schema_members.add(safe_name)

    if "components_list.json" not in safe_members:
        archive.close()
        return json_error("Zip must include components_list.json", "COMPONENTS_ZIP_MISSING_CATALOG", 400)
    if not schema_members:
        archive.close()
        return json_error("Zip must include schemas/components/*.json", "COMPONENTS_ZIP_MISSING_SCHEMAS", 400)

    try:
        catalog_data = json.loads(archive.read("components_list.json").decode("utf-8"))
    except Exception:
        archive.close()
        return json_error("Invalid components_list.json", "COMPONENTS_INVALID_CATALOG", 400)

    zip_entries, entry_errors = catalog.parse_zip_components_catalog(catalog_data)
    if entry_errors and not zip_entries:
        archive.close()
        return jsonify(
            {
                "status": "error",
                "code": "COMPONENTS_INVALID_CATALOG",
                "message": "Invalid components_list.json",
                "summary": {
                    "imported": 0,
                    "updated": 0,
                    "skipped": 0,
                    "errors": entry_errors[:config.COMPONENTS_IMPORT_MAX_ITEM_ERRORS],
                },
            }
        ), 400

    imported = 0
    updated = 0
    skipped = 0
    errors = list(entry_errors[:config.COMPONENTS_IMPORT_MAX_ITEM_ERRORS])

    with config.COMPONENTS_LOCK:
        runtime_path = catalog.components_runtime_list_path()
        runtime_catalog = catalog.load_components_catalog(runtime_path) if os.path.isfile(runtime_path) else catalog.default_components_catalog()
        runtime_items = catalog.extract_catalog_items(runtime_catalog)
        runtime_by_key = {catalog.component_catalog_entry_key(item): item for item in runtime_items}
        existing_runtime_keys = set(runtime_by_key.keys())
        imported_keys = set()

        for zip_item in zip_entries:
            entry = zip_item["entry"]
            chain = zip_item["chain"]
            comp_id = str(entry["id"])
            entry_key = catalog.component_catalog_entry_key(entry)
            schema_member = f"schemas/{entry['schemaPath']}"
            member_info = safe_members.get(schema_member)
            if not member_info:
                skipped += 1
                if len(errors) < config.COMPONENTS_IMPORT_MAX_ITEM_ERRORS:
                    errors.append(f"Missing schema file for {comp_id}: {schema_member}")
                continue

            try:
                schema_raw = archive.read(member_info)
                schema_obj = json.loads(schema_raw.decode("utf-8"))
            except Exception:
                skipped += 1
                if len(errors) < config.COMPONENTS_IMPORT_MAX_ITEM_ERRORS:
                    errors.append(f"Invalid schema JSON for {comp_id}: {schema_member}")
                continue

            schema_target = catalog.runtime_schema_target_path(entry["schemaPath"])
            if not schema_target:
                skipped += 1
                if len(errors) < config.COMPONENTS_IMPORT_MAX_ITEM_ERRORS:
                    errors.append(f"Invalid schema path for {comp_id}")
                continue

            os.makedirs(os.path.dirname(schema_target), exist_ok=True)
            with open(schema_target, "w", encoding="utf-8") as handle:
                json.dump(schema_obj, handle, ensure_ascii=False, indent=2)
                handle.write("\n")

            was_existing = entry_key in existing_runtime_keys
            if entry_key not in imported_keys:
                catalog.remove_catalog_item_all_by_key(runtime_catalog, entry_key)
                imported_keys.add(entry_key)
            target_items = catalog.ensure_category_path(runtime_catalog, chain)
            target_items.append(entry)
            runtime_by_key[entry_key] = entry
            if was_existing:
                updated += 1
            else:
                imported += 1

        catalog.save_runtime_components_catalog(runtime_catalog)

    archive.close()
    return jsonify(
        {
            "status": "ok",
            "summary": {
                "imported": imported,
                "updated": updated,
                "skipped": skipped,
                "errors": errors,
            },
        }
    )


@bp.route("/api/custom-components", methods=["POST", "OPTIONS"])
def api_custom_components_create():
    access = auth.check_access()
    if access:
        return access

    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name") or "").strip()
    if not name:
        return json_error("Missing name", "COMPONENTS_NAME_REQUIRED", 400)

    custom_config = payload.get("custom_config")
    if custom_config is None:
        custom_config = payload.get("customConfig")
    if custom_config is None:
        custom_config = ""
    if not isinstance(custom_config, str):
        return json_error("custom_config must be a string", "COMPONENTS_CUSTOM_CONFIG_INVALID", 400)

    schema_data = payload.get("schema")
    if isinstance(schema_data, str):
        try:
            schema_data = json.loads(schema_data)
        except Exception:
            return json_error("Invalid schema JSON", "COMPONENTS_SCHEMA_INVALID", 400)

    requested_id = catalog.normalize_component_id(payload.get("id", ""))
    if requested_id and not requested_id.startswith("custom/"):
        return json_error("Custom component id must start with custom/", "COMPONENTS_CUSTOM_ID_INVALID", 400)

    key = ""
    if requested_id:
        key = requested_id.split("/")[-1]
    if not key:
        key = catalog.slugify_component_key(payload.get("key", "")) or catalog.slugify_component_key(name)
    if not key:
        return json_error("Invalid custom component key", "COMPONENTS_CUSTOM_KEY_INVALID", 400)

    component_id = requested_id or f"custom/{key}"
    entry = {
        "name": name,
        "path": f"components/{component_id}",
        "id": component_id,
        "schemaPath": f"components/{component_id}.json",
        "prefillConfig": {
            "name": name,
            "custom_config": custom_config,
        },
    }

    if schema_data is None:
        schema_data = catalog.build_custom_component_schema(key)
    elif not isinstance(schema_data, (dict, list)):
        return json_error("Invalid schema", "COMPONENTS_SCHEMA_INVALID", 400)

    with config.COMPONENTS_LOCK:
        runtime_path = catalog.components_runtime_list_path()
        runtime_catalog = catalog.load_components_catalog(runtime_path) if os.path.isfile(runtime_path) else catalog.default_components_catalog()

        runtime_items = catalog.extract_catalog_items(runtime_catalog)
        existing_ids = {item.get("id") for item in runtime_items}
        if component_id in existing_ids:
            return json_error("Component id already exists", "COMPONENTS_ID_CONFLICT", 409)

        normalized_name = name.lower()
        for item in runtime_items:
            item_id = str(item.get("id") or "")
            item_name = str(item.get("name") or "").strip().lower()
            if item_id.startswith("custom/") and item_name == normalized_name:
                return json_error("Component name already exists", "COMPONENTS_NAME_CONFLICT", 409)

        schema_target = catalog.runtime_schema_target_path(entry["schemaPath"])
        if not schema_target:
            return json_error("Invalid schema path", "COMPONENTS_SCHEMA_PATH_INVALID", 400)
        os.makedirs(os.path.dirname(schema_target), exist_ok=True)
        with open(schema_target, "w", encoding="utf-8") as handle:
            json.dump(schema_data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")

        custom_items = catalog.ensure_custom_category(runtime_catalog)
        custom_items.append(entry)
        catalog.save_runtime_components_catalog(runtime_catalog)

    return jsonify({"status": "ok", "item": entry})


@bp.route("/api/custom-components/<path:id_or_key>", methods=["PUT", "OPTIONS"])
def api_custom_components_update(id_or_key):
    access = auth.check_access()
    if access:
        return access

    component_id = catalog.normalize_custom_component_lookup_id(id_or_key)
    if not component_id:
        return json_error("Invalid component id", "COMPONENTS_ID_INVALID", 400)

    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name") or "").strip()
    if not name:
        return json_error("Missing name", "COMPONENTS_NAME_REQUIRED", 400)

    custom_config = payload.get("custom_config")
    if custom_config is None:
        custom_config = payload.get("customConfig")
    if custom_config is None:
        custom_config = ""
    if not isinstance(custom_config, str):
        return json_error("custom_config must be a string", "COMPONENTS_CUSTOM_CONFIG_INVALID", 400)

    new_key = catalog.slugify_component_key(name)
    if not new_key:
        return json_error("Invalid custom component key", "COMPONENTS_CUSTOM_KEY_INVALID", 400)
    new_id = f"custom/{new_key}"

    with config.COMPONENTS_LOCK:
        runtime_path = catalog.components_runtime_list_path()
        if not os.path.isfile(runtime_path):
            return json_error("Component not found", "COMPONENTS_NOT_FOUND", 404)
        runtime_catalog = catalog.load_components_catalog(runtime_path)

        existing_ref = catalog.find_catalog_item_ref(runtime_catalog, component_id)
        if not existing_ref:
            return json_error("Component not found", "COMPONENTS_NOT_FOUND", 404)
        target_items, target_index, existing_item = existing_ref

        runtime_items = catalog.extract_catalog_items(runtime_catalog)
        normalized_name = name.strip().lower()
        for item in runtime_items:
            item_id = str(item.get("id") or "")
            item_name = str(item.get("name") or "").strip().lower()
            if item_id == component_id:
                continue
            if item_id.startswith("custom/") and item_name == normalized_name:
                return json_error("Component name already exists", "COMPONENTS_NAME_CONFLICT", 409)

        if new_id != component_id:
            for item in runtime_items:
                if str(item.get("id") or "") == new_id:
                    return json_error("Component id already exists", "COMPONENTS_ID_CONFLICT", 409)

        updated_entry = {
            "name": name,
            "path": f"components/{new_id}",
            "id": new_id,
            "schemaPath": f"components/{new_id}.json",
            "prefillConfig": {
                "name": name,
                "custom_config": custom_config,
            },
        }

        schema_data = catalog.build_custom_component_schema(new_key)
        new_schema_path = catalog.runtime_schema_target_path(updated_entry["schemaPath"])
        if not new_schema_path:
            return json_error("Invalid schema path", "COMPONENTS_SCHEMA_PATH_INVALID", 400)

        old_schema_path = catalog.runtime_schema_target_path(str(existing_item.get("schemaPath") or ""))
        old_id = str(existing_item.get("id") or component_id)

        os.makedirs(os.path.dirname(new_schema_path), exist_ok=True)
        with open(new_schema_path, "w", encoding="utf-8") as handle:
            json.dump(schema_data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")

        renamed = old_id != new_id
        if renamed and old_schema_path and old_schema_path != new_schema_path and os.path.isfile(old_schema_path):
            try:
                os.remove(old_schema_path)
            except Exception:
                return json_error("Failed to delete old schema", "COMPONENTS_SCHEMA_DELETE_FAILED", 500)

        target_items[target_index] = updated_entry
        catalog.save_runtime_components_catalog(runtime_catalog)

    return jsonify(
        {
            "status": "ok",
            "item": updated_entry,
            "renamed": renamed,
            "previousId": old_id,
            "currentId": new_id,
        }
    )


@bp.route("/api/custom-components/<path:id_or_key>", methods=["DELETE", "OPTIONS"])
def api_custom_components_delete(id_or_key):
    access = auth.check_access()
    if access:
        return access

    component_id = catalog.normalize_custom_component_lookup_id(id_or_key)
    if not component_id:
        return json_error("Invalid component id", "COMPONENTS_ID_INVALID", 400)

    with config.COMPONENTS_LOCK:
        runtime_path = catalog.components_runtime_list_path()
        if not os.path.isfile(runtime_path):
            return json_error("Component not found", "COMPONENTS_NOT_FOUND", 404)
        runtime_catalog = catalog.load_components_catalog(runtime_path)
        removed = catalog.remove_catalog_item(runtime_catalog, component_id)
        if not removed:
            return json_error("Component not found", "COMPONENTS_NOT_FOUND", 404)

        schema_path = catalog.runtime_schema_target_path(str(removed.get("schemaPath") or ""))
        if schema_path and os.path.isfile(schema_path):
            try:
                os.remove(schema_path)
            except Exception:
                return json_error("Failed to delete schema", "COMPONENTS_SCHEMA_DELETE_FAILED", 500)

        catalog.save_runtime_components_catalog(runtime_catalog)

    return jsonify({"status": "ok", "removed": component_id})
