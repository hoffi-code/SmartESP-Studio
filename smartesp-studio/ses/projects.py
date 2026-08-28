"""Virtual folder index: load/save/add/remove/rename project placement."""

import json
import os

from ses import config
from ses.io import utc_now, write_json_file_atomic


def projects_index_path() -> str:
    return os.path.join(config.PROJECT_DIR, "projects.json")


def load_projects_index() -> dict:
    path = projects_index_path()
    if not os.path.isfile(path):
        return {
            "version": 1,
            "updatedAt": utc_now(),
            "folders": [{"id": "root", "name": "Projects", "parentId": None}],
            "projectPlacement": [],
        }
    try:
        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except Exception:
        return {
            "version": 1,
            "updatedAt": utc_now(),
            "folders": [{"id": "root", "name": "Projects", "parentId": None}],
            "projectPlacement": [],
        }
    if not isinstance(payload, dict):
        return {
            "version": 1,
            "updatedAt": utc_now(),
            "folders": [{"id": "root", "name": "Projects", "parentId": None}],
            "projectPlacement": [],
        }
    if not isinstance(payload.get("folders"), list):
        payload["folders"] = [{"id": "root", "name": "Projects", "parentId": None}]
    if not isinstance(payload.get("projectPlacement"), list):
        payload["projectPlacement"] = []
    if "version" not in payload:
        payload["version"] = 1
    return payload


def save_projects_index(index_payload: dict) -> None:
    payload = dict(index_payload or {})
    payload["updatedAt"] = utc_now()
    path = projects_index_path()
    write_json_file_atomic(path, payload)


def add_project_to_index(project_filename: str, folder_id: str = "root") -> dict:
    index_payload = load_projects_index()
    folders = index_payload.get("folders")
    if not isinstance(folders, list) or not folders:
        folders = [{"id": "root", "name": "Projects", "parentId": None}]
        index_payload["folders"] = folders
    valid_folder_ids = {
        str(folder.get("id") or "")
        for folder in folders
        if isinstance(folder, dict) and str(folder.get("id") or "")
    }
    target_folder_id = folder_id if folder_id in valid_folder_ids else "root"
    current = index_payload.get("projectPlacement")
    if not isinstance(current, list):
        current = []
    next_items = []
    found = False
    now = utc_now()
    for item in current:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        if name == project_filename:
            updated = dict(item)
            updated["folderId"] = str(updated.get("folderId") or target_folder_id)
            updated["lastEditedAt"] = now
            next_items.append(updated)
            found = True
            continue
        next_items.append(item)
    if not found:
        next_items.append({"name": project_filename, "folderId": target_folder_id, "lastEditedAt": now})
    index_payload["projectPlacement"] = next_items
    return index_payload


def remove_project_from_index(project_filename: str) -> bool:
    index_payload = load_projects_index()
    current = index_payload.get("projectPlacement")
    if not isinstance(current, list):
        current = []
    next_items = [
        item
        for item in current
        if not (isinstance(item, dict) and str(item.get("name") or "").strip() == project_filename)
    ]
    changed = len(next_items) != len(current)
    if changed:
        index_payload["projectPlacement"] = next_items
        save_projects_index(index_payload)
    return changed


def rename_project_in_index(old_name: str, new_name: str) -> bool:
    if not old_name or not new_name or old_name == new_name:
        return False
    index_payload = load_projects_index()
    current = index_payload.get("projectPlacement")
    if not isinstance(current, list):
        current = []

    changed = False
    deduped = []
    seen_names = set()
    for item in current:
        if not isinstance(item, dict):
            deduped.append(item)
            continue
        name = str(item.get("name") or "").strip()
        next_name = new_name if name == old_name else name
        if next_name != name:
            item = dict(item)
            item["name"] = next_name
            changed = True
        if not next_name:
            changed = True
            continue
        if next_name in seen_names:
            changed = True
            continue
        seen_names.add(next_name)
        deduped.append(item)

    if changed:
        index_payload["projectPlacement"] = deduped
        save_projects_index(index_payload)
    return changed
