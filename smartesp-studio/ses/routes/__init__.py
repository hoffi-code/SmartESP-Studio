"""Per-domain blueprints registered by ses.create_app()."""

from flask import Flask

from ses.routes import (
    assets,
    components,
    devices,
    health,
    imports,
    jobs,
    projects,
    secrets,
    ui,
    yaml_files,
)

_MODULES = (health, components, assets, yaml_files, imports, secrets, projects, devices, jobs, ui)


def register_blueprints(app: Flask) -> None:
    for module in _MODULES:
        app.register_blueprint(module.bp)
