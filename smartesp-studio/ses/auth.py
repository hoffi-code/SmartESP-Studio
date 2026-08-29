"""Ingress access control and standalone basic-auth."""

import hmac
import os
from base64 import b64decode

from flask import jsonify, request

from ses import config


def resolve_web_root() -> str:
    if config.WEB_ROOT and os.path.isdir(config.WEB_ROOT):
        return config.WEB_ROOT
    return ""


def resolve_secrets_path() -> str:
    return os.path.join(config.TARGET_DIR, config.SECRETS_FILENAME)


def is_standalone_mode() -> bool:
    return config.SES_MODE == "standalone"


def read_auth_password() -> str:
    if config.SES_AUTH_PASSWORD:
        return config.SES_AUTH_PASSWORD
    if not config.SES_AUTH_PASSWORD_FILE:
        return ""
    try:
        with open(config.SES_AUTH_PASSWORD_FILE, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    except Exception:
        return ""


def basic_auth_challenge(message: str = "Authentication required"):
    response = jsonify({"status": "error", "message": message})
    response.status_code = 401
    response.headers["WWW-Authenticate"] = 'Basic realm="SmartESP Studio"'
    return response


def standalone_basic_auth_response():
    if not is_standalone_mode() or config.SES_AUTH_MODE != "basic":
        return None
    if request.method == "OPTIONS" or request.path == "/api/health":
        return None

    expected_username = config.SES_AUTH_USERNAME
    expected_password = read_auth_password()
    if not expected_username or not expected_password:
        return basic_auth_challenge("Basic authentication is not configured")

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.lower().startswith("basic "):
        return basic_auth_challenge()

    token = auth_header.split(" ", 1)[1].strip()
    try:
        decoded = b64decode(token, validate=True).decode("utf-8")
    except Exception:
        return basic_auth_challenge()

    username, separator, password = decoded.partition(":")
    if not separator:
        return basic_auth_challenge()
    if not hmac.compare_digest(username, expected_username):
        return basic_auth_challenge()
    if not hmac.compare_digest(password, expected_password):
        return basic_auth_challenge()
    return None


def check_access():
    if is_standalone_mode():
        return None

    if request.headers.get("X-Ingress-Path") or request.headers.get("X-HA-Ingress"):
        return None

    return jsonify({"status": "error", "message": "Ingress required"}), 403
