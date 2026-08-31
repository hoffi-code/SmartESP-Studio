"""SmartESP Studio backend package."""

import os

from flask import Flask, make_response, request
from werkzeug.exceptions import HTTPException

from ses import assets, auth, catalog, config
from ses.errors import handle_http_exception, handle_unexpected_exception
from ses.esphome import JobManager
from ses.io import seed_assets, seed_tree


def bootstrap_storage() -> None:
    os.makedirs(config.TARGET_DIR, exist_ok=True)
    # Seed initial project/asset structure once at startup.
    seed_tree(config.SEED_ROOT, config.TARGET_DIR)
    seed_assets()
    os.makedirs(catalog.components_runtime_schemas_root(), exist_ok=True)
    assets.sync_assets("all")


def create_app() -> Flask:
    bootstrap_storage()

    app = Flask(__name__)
    app.extensions["job_manager"] = JobManager()

    @app.before_request
    def handle_options_preflight():
        if request.method == "OPTIONS":
            return make_response("", 204)
        return None

    @app.before_request
    def enforce_standalone_auth():
        return auth.standalone_basic_auth_response()

    from ses.routes import register_blueprints

    register_blueprints(app)

    app.register_error_handler(HTTPException, handle_http_exception)
    app.register_error_handler(Exception, handle_unexpected_exception)
    return app
