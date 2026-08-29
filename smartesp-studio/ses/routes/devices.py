"""Device registry endpoints + host serial port listing."""

import uuid

from flask import Blueprint, jsonify, request

from ses import auth, config, serial_ports
from ses import devices as dev
from ses.io import normalize_yaml_filename, utc_now

bp = Blueprint("devices", __name__)


@bp.route("/api/devices/unregister", methods=["DELETE", "OPTIONS"])
def api_devices_unregister():
    access = auth.check_access()
    if access:
        return access

    yaml_value = request.args.get("yaml") or request.args.get("filename") or ""
    name_value = request.args.get("name") or request.args.get("device") or ""
    yaml_name = normalize_yaml_filename(str(yaml_value)) if yaml_value else ""
    device_key = dev.normalize_device_key(str(name_value)) if name_value else ""
    if not yaml_name and not device_key:
        return jsonify({"status": "error", "message": "Provide yaml or name"}), 400

    removed, removed_count = dev.unregister_device_record(yaml_name=yaml_name, device_key=device_key)
    return jsonify(
        {
            "status": "ok",
            "removed": removed,
            "removed_count": removed_count,
            "yaml": yaml_name,
            "name": device_key,
        }
    )


@bp.route("/api/devices/register", methods=["POST", "OPTIONS"])
def api_devices_register():
    access = auth.check_access()
    if access:
        return access

    payload = request.get_json(silent=True) or {}
    yaml_name = normalize_yaml_filename(str(payload.get("yaml", "")))
    key = dev.device_key_from_yaml(yaml_name)
    name = str(payload.get("name", "")).strip()
    if key:
        name = key
    if not name or not config.VALID_DEVICE.match(name):
        return jsonify({"status": "error", "message": "Invalid name"}), 400
    name = name.strip().lower()
    if not key:
        key = dev.normalize_device_key(name)

    host = str(payload.get("host", "")).strip()
    if host and not config.VALID_DEVICE.match(host):
        host = ""

    devices = dev.load_devices()
    now = utc_now()
    updated = False
    for device in devices:
        current_key = dev.canonical_device_key(device)
        if current_key and current_key == key:
            device["device_key"] = key
            device["yaml"] = yaml_name or device.get("yaml", "")
            device["name"] = key
            if host:
                device["host"] = host
            device["updated_at"] = now
            updated = True
            break
        if str(device.get("name") or "").strip().lower() == name:
            device["device_key"] = key
            device["yaml"] = yaml_name or device.get("yaml", "")
            device["name"] = key
            if host:
                device["host"] = host
            device["updated_at"] = now
            updated = True
            break

    if not updated:
        devices.append(
            {
                "id": uuid.uuid4().hex,
                "device_key": key,
                "name": key,
                "yaml": yaml_name,
                "host": host or f"{key}.local",
                "status": "offline",
                "created_at": now,
                "updated_at": now,
                "last_seen": "",
            }
        )

    dev.save_devices(devices)
    return jsonify({"status": "ok"})


@bp.route("/api/devices/list", methods=["GET"])
def api_devices_list():
    access = auth.check_access()
    if access:
        return access

    devices = dev.load_devices()
    refresh = str(request.args.get("refresh", "0")).strip() in ("1", "true", "yes")
    deep = str(request.args.get("deep", "0")).strip() in ("1", "true", "yes") or config.SES_STATUS_USE_PING
    response_devices = []
    normalized_any = False

    for device in devices:
        key = dev.canonical_device_key(device)
        yaml_name = normalize_yaml_filename(str(device.get("yaml") or ""))
        host = str(device.get("host") or "").strip()
        if not host:
            fallback = key or dev.normalize_device_key(str(device.get("name") or ""))
            if fallback:
                host = f"{fallback}.local"
        status = str(device.get("status") or "").strip().lower()
        if status not in ("online", "offline", "unknown"):
            status = "unknown"
        status_source = str(device.get("status_source") or "").strip().lower()
        if status_source not in ("dns", "mdns", "ota", "unknown"):
            status_source = "unknown"

        if device.get("device_key") != key:
            device["device_key"] = key
            normalized_any = True
        if device.get("name") != key and key:
            device["name"] = key
            normalized_any = True
        if device.get("yaml") != yaml_name:
            device["yaml"] = yaml_name
            normalized_any = True
        if device.get("host") != host and host:
            device["host"] = host
            normalized_any = True
        if device.get("status") != status:
            device["status"] = status
            normalized_any = True
        if device.get("status_source") != status_source:
            device["status_source"] = status_source
            normalized_any = True

    if refresh:
        now = utc_now()
        updated_any = normalized_any
        mdns_probe = dev.MDNSProbe()
        try:
            for device in devices:
                key = dev.canonical_device_key(device)
                host = str(device.get("host") or "").strip() or (f"{key}.local" if key else "")
                online, dns_ok, mdns_ok, ota_ok, source = dev.evaluate_device_connectivity(
                    host,
                    deep=deep,
                    mdns_probe=mdns_probe,
                )
                status = "online" if online else "offline"
                if device.get("host") != host:
                    device["host"] = host
                    updated_any = True
                if device.get("status") != status:
                    device["status"] = status
                    device["updated_at"] = now
                    updated_any = True
                if device.get("status_source") != source:
                    device["status_source"] = source
                    updated_any = True
                if online:
                    device["last_seen"] = now
                checks = {"dns": dns_ok, "mdns": mdns_ok, "ota": ota_ok}
                response_devices.append(dev.build_device_response(device, checks=checks))
        finally:
            mdns_probe.close()
        if updated_any:
            dev.save_devices(devices)

        return jsonify({"status": "ok", "devices": response_devices})

    if normalized_any:
        dev.save_devices(devices)

    return jsonify({"status": "ok", "devices": [dev.build_device_response(device) for device in devices]})


@bp.route("/api/devices/status", methods=["GET"])
def api_device_status():
    access = auth.check_access()
    if access:
        return access

    yaml_query = normalize_yaml_filename(str(request.args.get("yaml", "")))
    key_query = dev.normalize_device_key(str(request.args.get("name", "")))
    if not yaml_query and not key_query:
        return jsonify({"status": "error", "message": "Invalid device selector"}), 400

    devices = dev.load_devices()
    target = None
    for device in devices:
        device_yaml = normalize_yaml_filename(str(device.get("yaml") or ""))
        device_key = dev.canonical_device_key(device)
        if yaml_query and device_yaml and device_yaml.lower() == yaml_query.lower():
            target = device
            break
        if key_query and device_key == key_query:
            target = device
            break

    if not target:
        return jsonify({"status": "ok", "device": None})

    refresh = str(request.args.get("refresh", "0")).strip() in ("1", "true", "yes")
    deep = str(request.args.get("deep", "0")).strip() in ("1", "true", "yes") or config.SES_STATUS_USE_PING
    if not refresh:
        return jsonify({"status": "ok", "device": dev.build_device_response(target)})

    now = utc_now()
    key = dev.canonical_device_key(target)
    host = str(target.get("host") or "").strip() or (f"{key}.local" if key else "")
    mdns_probe = dev.MDNSProbe()
    try:
        online, dns_ok, mdns_ok, ota_ok, source = dev.evaluate_device_connectivity(
            host,
            deep=deep,
            mdns_probe=mdns_probe,
        )
    finally:
        mdns_probe.close()

    status = "online" if online else "offline"
    changed = False
    if target.get("host") != host:
        target["host"] = host
        changed = True
    if target.get("status") != status:
        target["status"] = status
        target["updated_at"] = now
        changed = True
    if target.get("status_source") != source:
        target["status_source"] = source
        changed = True
    if online:
        target["last_seen"] = now

    if changed:
        dev.save_devices(devices)

    checks = {"dns": dns_ok, "mdns": mdns_ok, "ota": ota_ok}
    return jsonify({"status": "ok", "device": dev.build_device_response(target, checks=checks)})


@bp.route("/api/serial/ports", methods=["GET"])
def api_serial_ports():
    access = auth.check_access()
    if access:
        return access
    try:
        ports = serial_ports.list_host_serial_ports()
    except RuntimeError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 503
    return jsonify({"status": "ok", "ports": ports})
