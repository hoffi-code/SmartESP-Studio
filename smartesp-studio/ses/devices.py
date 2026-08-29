"""Device registry: mDNS/DNS/OTA connectivity checks, device.json persistence."""

import json
import os
import socket
from typing import List, Optional, Tuple

try:
    from zeroconf import IPVersion, Zeroconf
except Exception:
    IPVersion = None
    Zeroconf = None

from ses import config
from ses.io import normalize_yaml_filename


def load_devices() -> List[dict]:
    if not os.path.isfile(config.DEVICES_PATH):
        return []
    try:
        with open(config.DEVICES_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
    except Exception:
        return []
    return []


def save_devices(devices: List[dict]) -> None:
    os.makedirs(os.path.dirname(config.DEVICES_PATH), exist_ok=True)
    with open(config.DEVICES_PATH, "w", encoding="utf-8") as handle:
        json.dump(devices, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def device_key_from_yaml(yaml_name: str) -> str:
    normalized = normalize_yaml_filename(yaml_name)
    if not normalized:
        return ""
    return normalized[:-5].strip().lower()


def normalize_device_key(value: str) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    if raw.endswith(".yaml"):
        raw = raw[:-5]
    if raw.endswith(".json"):
        raw = raw[:-5]
    if not raw or not config.VALID_DEVICE.match(raw):
        return ""
    return raw


def canonical_device_key(device: dict) -> str:
    yaml_name = str(device.get("yaml") or "").strip()
    key_from_yaml = device_key_from_yaml(yaml_name)
    if key_from_yaml:
        return key_from_yaml
    return normalize_device_key(str(device.get("name") or ""))


def unregister_device_record(
    *,
    yaml_name: str = "",
    device_key: str = "",
) -> Tuple[bool, int]:
    normalized_yaml = normalize_yaml_filename(yaml_name) if yaml_name else ""
    normalized_key = normalize_device_key(device_key) if device_key else ""
    if not normalized_yaml and not normalized_key:
        return False, 0

    devices = load_devices()
    kept = []
    removed = 0
    for device in devices:
        remove = False
        if normalized_yaml:
            device_yaml = normalize_yaml_filename(str(device.get("yaml") or ""))
            if device_yaml and device_yaml.lower() == normalized_yaml.lower():
                remove = True
        if not remove and normalized_key:
            if canonical_device_key(device) == normalized_key:
                remove = True
        if remove:
            removed += 1
            continue
        kept.append(device)

    if removed:
        save_devices(kept)
        return True, removed
    return False, 0


def build_device_response(device: dict, checks: Optional[dict] = None) -> dict:
    key = canonical_device_key(device)
    yaml_name = normalize_yaml_filename(str(device.get("yaml") or ""))
    name = str(device.get("name") or "").strip()
    host = str(device.get("host") or "").strip()
    status = str(device.get("status") or "").strip().lower()
    if status not in ("online", "offline", "unknown"):
        status = "unknown"
    status_source = str(device.get("status_source") or "").strip().lower()
    if status_source not in ("dns", "mdns", "ota", "unknown"):
        status_source = "unknown"

    payload = {
        **device,
        "device_key": key,
        "yaml": yaml_name,
        "name": name,
        "host": host,
        "status": status,
        "status_source": status_source,
        "checks": {
            "dns": bool((checks or {}).get("dns", False)),
            "mdns": bool((checks or {}).get("mdns", False)),
            "ota": bool((checks or {}).get("ota", False)),
        },
    }
    return payload


class MDNSProbe:
    def __init__(self) -> None:
        self.cache = {}
        self.zc = None
        if Zeroconf is None:
            return
        try:
            if IPVersion is not None:
                self.zc = Zeroconf(ip_version=IPVersion.All)
            else:
                self.zc = Zeroconf()
        except Exception:
            self.zc = None

    def is_online(self, host: str) -> bool:
        normalized = str(host or "").strip().rstrip(".").lower()
        if not normalized or not normalized.endswith(".local"):
            return False
        cached = self.cache.get(normalized)
        if cached is not None:
            return cached

        if self.zc is None:
            self.cache[normalized] = False
            return False

        node = normalized[:-6].strip()
        if not node:
            self.cache[normalized] = False
            return False

        online = False
        for service_type in ("_esphomelib._tcp.local.", "_esphome._tcp.local."):
            service_name = f"{node}.{service_type}"
            try:
                info = self.zc.get_service_info(service_type, service_name, timeout=1200)
            except Exception:
                info = None
            if info is not None:
                online = True
                break

        self.cache[normalized] = online
        return online

    def close(self) -> None:
        if self.zc is None:
            return
        try:
            self.zc.close()
        except Exception:
            pass
        self.zc = None


def ping_host(host: str, port: int = config.PING_PORT, timeout: float = config.PING_TIMEOUT) -> bool:
    if not host:
        return False
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def resolve_host(host: str) -> bool:
    if not host:
        return False
    try:
        socket.getaddrinfo(host, None)
        return True
    except Exception:
        return False


def evaluate_device_connectivity(
    host: str,
    deep: bool = False,
    mdns_probe: Optional[MDNSProbe] = None,
) -> Tuple[bool, bool, bool, bool, str]:
    """Return (online, dns_ok, mdns_ok, ota_ok, source) for a device host."""
    dns_ok = resolve_host(host)
    mdns_ok = mdns_probe.is_online(host) if mdns_probe else False
    ota_ok = ping_host(host) if deep else False
    online = dns_ok or mdns_ok or ota_ok
    source = "unknown"
    if dns_ok:
        source = "dns"
    elif mdns_ok:
        source = "mdns"
    elif ota_ok:
        source = "ota"
    return online, dns_ok, mdns_ok, ota_ok, source
