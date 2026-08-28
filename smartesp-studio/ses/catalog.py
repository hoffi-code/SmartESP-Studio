"""Component catalog: base/runtime merge, normalization, ZIP import, custom components."""

import json
import os
import posixpath
import re
from typing import List, Optional, Tuple

from ses import config
from ses.io import read_json_file, utc_now


def components_runtime_root() -> str:
    return os.path.join(config.TARGET_DIR, config.COMPONENTS_RUNTIME_ROOTNAME)


def components_runtime_list_path() -> str:
    return os.path.join(components_runtime_root(), config.COMPONENTS_RUNTIME_FILENAME)


def components_runtime_schemas_root() -> str:
    return os.path.join(components_runtime_root(), "schemas", "components")


def default_components_catalog() -> dict:
    return {
        "generatedAt": utc_now(),
        "categories": [
            {
                "title": "Custom Components",
                "slug": "custom-components",
                "items": [],
                "subcategories": [],
            }
        ],
    }


def load_components_catalog(path: str) -> dict:
    payload = read_json_file(path)
    if not isinstance(payload, dict):
        return default_components_catalog()
    categories = payload.get("categories")
    if not isinstance(categories, list):
        payload["categories"] = []
    return payload


def save_runtime_components_catalog(payload: dict) -> None:
    data = dict(payload or {})
    data["generatedAt"] = utc_now()
    path = components_runtime_list_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def safe_zip_component_package_member_path(name: str) -> str:
    raw = str(name or "").strip().replace("\\", "/")
    if not raw or raw.startswith("/"):
        return ""
    if "\x00" in raw:
        return ""
    normalized = posixpath.normpath(raw)
    if normalized in ("", ".", ".."):
        return ""
    if normalized.startswith("../") or "/../" in normalized:
        return ""
    if normalized == "LICENSE.md":
        return normalized
    if not normalized.endswith(".json"):
        return ""
    if normalized == "components_list.json":
        return normalized
    if normalized.startswith("schemas/components/"):
        return normalized
    return ""


def normalize_component_token(value: str) -> str:
    token = str(value or "").strip().lower()
    if not token or not config.VALID_COMPONENT_TOKEN.match(token):
        return ""
    return token


def normalize_component_id(value: str) -> str:
    raw = str(value or "").strip().lower().replace("\\", "/")
    if not raw or raw.startswith("/") or raw.endswith("/"):
        return ""
    parts = [part for part in raw.split("/") if part]
    if any(not normalize_component_token(part) for part in parts):
        return ""
    return "/".join(parts)


def normalize_component_path(value: str) -> str:
    raw = str(value or "").strip().lower().replace("\\", "/")
    if not raw or raw.startswith("/"):
        return ""
    if raw.startswith("components/"):
        component_path = normalize_component_id(raw[len("components/") :])
        if not component_path:
            return ""
        return f"components/{component_path}"
    return ""


def normalize_component_schema_path(value: str) -> str:
    raw = str(value or "").strip().lower().replace("\\", "/")
    if not raw or raw.startswith("/"):
        return ""
    if not raw.startswith("components/") or not raw.endswith(".json"):
        return ""
    comp_id = normalize_component_id(raw[len("components/") : -5])
    if not comp_id:
        return ""
    return f"components/{comp_id}.json"


def normalize_component_catalog_key(value: str) -> str:
    raw = str(value or "").strip().lower().replace("\\", "/")
    if not raw or raw.startswith("/") or raw.endswith("/"):
        return ""
    parts = [part for part in raw.split("/") if part]
    if len(parts) < 2:
        return ""
    if any(not normalize_component_token(part) for part in parts):
        return ""
    return "/".join(parts)


def normalize_custom_component_lookup_id(value: str) -> str:
    raw = str(value or "").strip().lower().replace("\\", "/")
    component_id = normalize_component_id(raw) if "/" in raw else ""
    if component_id:
        return component_id if component_id.startswith("custom/") else ""
    key = normalize_component_token(raw)
    if not key:
        return ""
    return f"custom/{key}"


def normalize_component_entry(raw: dict) -> Tuple[Optional[dict], str]:
    if not isinstance(raw, dict):
        return None, "Component entry must be an object"

    name = str(raw.get("name") or "").strip()
    if not name:
        return None, "Component entry missing name"

    comp_id = normalize_component_id(raw.get("id", ""))
    path_value = normalize_component_path(raw.get("path", ""))
    schema_path = normalize_component_schema_path(raw.get("schemaPath", ""))
    if not comp_id or not path_value or not schema_path:
        return None, f"Invalid component entry for {name}"

    available = raw.get("available", True)
    if not isinstance(available, bool):
        return None, f"Invalid available flag for {comp_id}"

    catalog_key = None
    if "catalogKey" in raw and raw.get("catalogKey") is not None:
        catalog_key = normalize_component_catalog_key(raw.get("catalogKey", ""))
        if not catalog_key:
            return None, f"Invalid catalogKey for {comp_id}"

    prefill_config = raw.get("prefillConfig")
    normalized_prefill = None
    if prefill_config is not None:
        if not isinstance(prefill_config, dict):
            return None, f"Invalid prefillConfig for {comp_id}"
        normalized_prefill = {}
        if "name" in prefill_config:
            if not isinstance(prefill_config.get("name"), str):
                return None, f"Invalid prefillConfig.name for {comp_id}"
            normalized_prefill["name"] = prefill_config.get("name")
        if "custom_config" in prefill_config:
            if not isinstance(prefill_config.get("custom_config"), str):
                return None, f"Invalid prefillConfig.custom_config for {comp_id}"
            normalized_prefill["custom_config"] = prefill_config.get("custom_config")

    normalized_entry = {
        "name": name,
        "path": path_value,
        "id": comp_id,
        "available": available,
        "schemaPath": schema_path,
    }
    if catalog_key:
        normalized_entry["catalogKey"] = catalog_key
    if normalized_prefill is not None:
        normalized_entry["prefillConfig"] = normalized_prefill

    return normalized_entry, ""


def component_catalog_entry_key(entry: dict) -> str:
    if not isinstance(entry, dict):
        return ""
    catalog_key = normalize_component_catalog_key(entry.get("catalogKey", ""))
    if catalog_key:
        return catalog_key
    path_value = normalize_component_path(entry.get("path", ""))
    if path_value:
        return path_value
    component_id = normalize_component_id(entry.get("id", ""))
    return component_id


def iter_catalog_item_refs(categories: list):
    for category in categories:
        if not isinstance(category, dict):
            continue
        items = category.get("items")
        if isinstance(items, list):
            for index, item in enumerate(items):
                yield items, index, item
        subcategories = category.get("subcategories")
        if isinstance(subcategories, list):
            yield from iter_catalog_item_refs(subcategories)


def extract_catalog_items(catalog_payload: dict) -> List[dict]:
    categories = catalog_payload.get("categories")
    if not isinstance(categories, list):
        return []
    items = []
    for _, _, item in iter_catalog_item_refs(categories):
        normalized, _ = normalize_component_entry(item)
        if normalized:
            items.append(normalized)
    return items


def ensure_custom_category(catalog_payload: dict) -> list:
    categories = catalog_payload.get("categories")
    if not isinstance(categories, list):
        categories = []
        catalog_payload["categories"] = categories

    for category in categories:
        if not isinstance(category, dict):
            continue
        title = str(category.get("title") or "").strip().lower()
        slug = str(category.get("slug") or "").strip().lower()
        if title == "custom components" or slug == "custom-components":
            items = category.get("items")
            if not isinstance(items, list):
                category["items"] = []
            if not isinstance(category.get("subcategories"), list):
                category["subcategories"] = []
            return category["items"]

    custom_category = {
        "title": "Custom Components",
        "slug": "custom-components",
        "items": [],
        "subcategories": [],
    }
    categories.insert(0, custom_category)
    return custom_category["items"]


def category_match_key(category: dict) -> Tuple[str, str]:
    if not isinstance(category, dict):
        return "", ""
    slug = str(category.get("slug") or "").strip().lower()
    title = str(category.get("title") or "").strip().lower()
    return slug, title


def ensure_category_shape(category: dict) -> dict:
    if not isinstance(category.get("items"), list):
        category["items"] = []
    if not isinstance(category.get("subcategories"), list):
        category["subcategories"] = []
    return category


def find_category_by_match(categories: list, slug: str, title: str) -> Optional[dict]:
    for category in categories:
        if not isinstance(category, dict):
            continue
        c_slug, c_title = category_match_key(category)
        if slug and c_slug == slug:
            return ensure_category_shape(category)
        if not slug and title and c_title == title:
            return ensure_category_shape(category)
        if slug and not c_slug and title and c_title == title:
            return ensure_category_shape(category)
    return None


def ensure_category_path(catalog_payload: dict, category_chain: List[dict]) -> list:
    categories = catalog_payload.get("categories")
    if not isinstance(categories, list):
        categories = []
        catalog_payload["categories"] = categories

    current_list = categories
    current_category = None
    for node in category_chain:
        slug = str(node.get("slug") or "").strip().lower()
        title = str(node.get("title") or "").strip()
        title_lower = title.lower()

        found = find_category_by_match(current_list, slug, title_lower)
        if not found:
            found = {
                "title": title or (slug.replace("-", " ").title() if slug else "Category"),
                "slug": slug,
                "items": [],
                "subcategories": [],
            }
            current_list.append(found)
        current_category = ensure_category_shape(found)
        current_list = current_category["subcategories"]

    if current_category is None:
        return ensure_custom_category(catalog_payload)
    return current_category["items"]


def remove_catalog_item(catalog_payload: dict, component_id: str) -> Optional[dict]:
    categories = catalog_payload.get("categories")
    if not isinstance(categories, list):
        return None
    for items, index, item in iter_catalog_item_refs(categories):
        if isinstance(item, dict) and str(item.get("id") or "").strip().lower() == component_id:
            removed = items[index]
            del items[index]
            return removed
    return None


def remove_catalog_item_by_key(catalog_payload: dict, entry_key: str) -> Optional[dict]:
    categories = catalog_payload.get("categories")
    if not isinstance(categories, list):
        return None
    target_key = str(entry_key or "").strip().lower()
    if not target_key:
        return None
    for items, index, item in iter_catalog_item_refs(categories):
        if isinstance(item, dict) and component_catalog_entry_key(item) == target_key:
            removed = items[index]
            del items[index]
            return removed
    return None


def find_catalog_item_ref(catalog_payload: dict, component_id: str):
    categories = catalog_payload.get("categories")
    if not isinstance(categories, list):
        return None
    target_id = str(component_id or "").strip().lower()
    if not target_id:
        return None
    for items, index, item in iter_catalog_item_refs(categories):
        if isinstance(item, dict) and str(item.get("id") or "").strip().lower() == target_id:
            return items, index, item
    return None


def remove_catalog_item_all_by_key(catalog_payload: dict, entry_key: str) -> int:
    removed_count = 0
    while True:
        removed = remove_catalog_item_by_key(catalog_payload, entry_key)
        if not removed:
            break
        removed_count += 1
    return removed_count


def iter_category_nodes(categories: list, chain: Optional[List[dict]] = None):
    current_chain = list(chain or [])
    for category in categories:
        if not isinstance(category, dict):
            continue
        ensured = ensure_category_shape(category)
        current = current_chain + [
            {
                "slug": str(ensured.get("slug") or "").strip(),
                "title": str(ensured.get("title") or "").strip(),
            }
        ]
        yield ensured, current
        subcategories = ensured.get("subcategories")
        if isinstance(subcategories, list):
            yield from iter_category_nodes(subcategories, current)


def apply_runtime_catalog_into_merged(merged_catalog: dict, runtime_catalog: dict) -> None:
    runtime_categories = runtime_catalog.get("categories")
    if not isinstance(runtime_categories, list):
        return

    applied_keys = set()
    for runtime_category, chain in iter_category_nodes(runtime_categories):
        target_items = ensure_category_path(merged_catalog, chain)
        source_items = runtime_category.get("items")
        if not isinstance(source_items, list):
            continue
        for source_item in source_items:
            normalized, _ = normalize_component_entry(source_item)
            if not normalized:
                continue
            entry_key = component_catalog_entry_key(normalized)
            if entry_key not in applied_keys:
                remove_catalog_item_all_by_key(merged_catalog, entry_key)
                applied_keys.add(entry_key)
            target_items.append(normalized)


def merge_component_catalogs(base_catalog: dict, runtime_catalog: Optional[dict]) -> dict:
    merged = json.loads(json.dumps(base_catalog if isinstance(base_catalog, dict) else default_components_catalog()))
    runtime_payload = runtime_catalog if isinstance(runtime_catalog, dict) else {}
    apply_runtime_catalog_into_merged(merged, runtime_payload)
    merged["generatedAt"] = utc_now()
    return merged


def slugify_component_key(value: str) -> str:
    lowered = str(value or "").strip().lower()
    lowered = re.sub(r"[^a-z0-9_-]+", "-", lowered)
    lowered = re.sub(r"-+", "-", lowered).strip("-_")
    token = normalize_component_token(lowered)
    if token:
        return token
    return ""


def runtime_schema_target_path(schema_path: str) -> str:
    relative = str(schema_path or "").strip().replace("\\", "/")
    if not relative.startswith("components/"):
        return ""
    full_path = os.path.normpath(os.path.join(components_runtime_root(), "schemas", relative))
    schemas_root = os.path.normpath(os.path.join(components_runtime_root(), "schemas"))
    try:
        common = os.path.commonpath([schemas_root, full_path])
    except ValueError:
        return ""
    if common != schemas_root:
        return ""
    return full_path


def parse_zip_components_catalog(catalog_payload: dict) -> Tuple[List[dict], List[str]]:
    errors = []
    entries = []
    categories = catalog_payload.get("categories")
    if not isinstance(categories, list):
        return [], ["components_list.json must contain categories"]

    for category, chain in iter_category_nodes(categories):
        items = category.get("items")
        if not isinstance(items, list):
            continue
        for item in items:
            normalized, error = normalize_component_entry(item)
            if not normalized:
                if len(errors) < config.COMPONENTS_IMPORT_MAX_ITEM_ERRORS:
                    errors.append(error)
                continue
            entries.append({"entry": normalized, "chain": chain})

    if not entries:
        errors.append("No valid component entries found in components_list.json")
    return entries, errors


def normalize_component_schema_relpath(value: str) -> str:
    raw = str(value or "").strip().replace("\\", "/")
    if not raw:
        return ""
    if raw.startswith("/"):
        return ""
    normalized = posixpath.normpath(raw)
    if normalized in ("", ".", ".."):
        return ""
    if normalized.startswith("../") or "/../" in normalized:
        return ""
    if normalized.startswith("schemas/"):
        normalized = normalized[len("schemas/") :]
    if not normalized.startswith("components/"):
        return ""
    if not normalized.endswith(".json"):
        return ""
    return normalized


def resolve_component_schema_path(base_root: str, relpath: str) -> str:
    root = os.path.normpath(base_root)
    candidate = os.path.normpath(os.path.join(root, relpath.replace("/", os.sep)))
    try:
        common = os.path.commonpath([root, candidate])
    except ValueError:
        return ""
    if common != root:
        return ""
    return candidate


def load_empty_custom_template() -> dict:
    template_path = os.path.join(config.COMPONENTS_BASE_SCHEMAS_ROOT, "custom", "empty.json")
    template = read_json_file(template_path)
    if isinstance(template, dict):
        return template
    return {
        "id": "custom.empty",
        "domain": "custom",
        "platform": "empty",
        "helpUrl": "",
        "uiLabelField": "name",
        "defaultLabel": "Empty Component",
        "renderStrategy": "verbatim_root",
        "verbatimField": "custom_config",
        "fields": [
            {
                "key": "name",
                "type": "text",
                "required": False,
                "lvl": "simple",
                "placeholder": "Custom component name",
                "emitYAML": "never",
            },
            {
                "key": "custom_config",
                "type": "raw_yaml",
                "required": False,
                "lvl": "simple",
                "placeholder": "# Enter raw YAML that should be emitted as-is",
            },
        ],
    }


def build_custom_component_schema(key: str) -> dict:
    schema = json.loads(json.dumps(load_empty_custom_template()))
    schema["id"] = f"custom.{key}"
    schema["domain"] = "custom"
    schema["platform"] = key
    fields = schema.get("fields")
    if isinstance(fields, list):
        for field in fields:
            if not isinstance(field, dict):
                continue
            field_key = str(field.get("key") or "").strip()
            if field_key in ("name", "custom_config") and "default" in field:
                field.pop("default", None)

    return schema
