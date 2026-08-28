"""Host (HA server) serial-port discovery and validation."""

import re
from typing import List

from ses import config


def is_allowed_serial_port(path: str) -> bool:
    normalized = str(path or "").strip()
    if re.fullmatch(r"COM[0-9]+", normalized, re.IGNORECASE):
        return True
    return normalized.startswith(config.SERIAL_PORT_PREFIXES)


def list_host_serial_ports() -> List[dict]:
    try:
        from serial.tools.list_ports import comports
    except ImportError as exc:
        raise RuntimeError("pyserial is not available") from exc

    ports = []
    seen = set()
    for port in comports(include_links=True):
        path = str(getattr(port, "device", "") or "").strip()
        if not path or path in seen or not is_allowed_serial_port(path):
            continue
        seen.add(path)
        ports.append(
            {
                "path": path,
                "description": str(getattr(port, "description", "") or ""),
                "vid": getattr(port, "vid", None),
                "pid": getattr(port, "pid", None),
                "serial_number": getattr(port, "serial_number", None),
            }
        )
    ports.sort(key=lambda item: item["path"])
    return ports


def validate_host_serial_port(path: str) -> str:
    normalized = str(path or "").strip()
    if not normalized or not is_allowed_serial_port(normalized):
        raise ValueError("Invalid serial port")
    available = {port["path"] for port in list_host_serial_ports()}
    if normalized not in available:
        raise ValueError("Serial port is not available")
    return normalized
