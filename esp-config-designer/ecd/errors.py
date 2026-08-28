"""Uniform JSON error responses."""

from flask import jsonify, request
from werkzeug.exceptions import HTTPException

from ecd.logging import log


def json_error(message: str, code: str, status_code: int):
    return jsonify({"status": "error", "code": code, "message": message}), status_code


def handle_http_exception(error: HTTPException):
    return jsonify({"status": "error", "message": error.description}), error.code


def handle_unexpected_exception(error: Exception):
    log.exception("unhandled error on %s %s", request.method, request.path)
    return jsonify({"status": "error", "message": "Internal server error"}), 500
