"""Health and runtime diagnostics endpoints."""

from flask import Blueprint, jsonify, request

from ses import auth, config
from ses.io import utc_now

bp = Blueprint("health", __name__)


@bp.route("/api/health", methods=["GET"])
def api_health():
    return jsonify({"status": "ok", "ok": True, "mode": config.SES_MODE, "ts": utc_now()})


@bp.route("/api/runtime", methods=["GET"])
def api_runtime():
    access = auth.check_access()
    if access:
        return access

    payload = {
        "status": "ok",
        "mode": config.SES_MODE,
        "isHaAddon": config.ESPHOME_IS_HA_ADDON,
        "storageMode": config.SES_STORAGE_MODE,
        "authMode": config.SES_AUTH_MODE,
        "version": config.SES_VERSION,
        "port": config.PORT,
    }

    debug = config.is_truthy(request.args.get("debug", ""))
    if debug:
        payload.update(
            {
                "targetDir": config.TARGET_DIR,
                "projectDir": config.PROJECT_DIR,
                "assetRoot": config.ASSET_ROOT,
                "jobDir": config.JOB_DIR,
                "esphomeConfigDir": config.ESPHOME_CONFIG_DIR,
                "esphomeDataDir": config.ESPHOME_DATA_DIR,
                "webRoot": config.WEB_ROOT,
            }
        )

    return jsonify(payload)
