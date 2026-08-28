"""Route-level smoke coverage.

One reachable endpoint per route group so a broken import or a mis-registered
blueprint shows up immediately while server.py is split into modules.
"""

import importlib.util
import pathlib
import sys
import types
import unittest

SERVER_PATH = pathlib.Path(__file__).resolve().parents[1] / "server.py"
sys.modules.setdefault(
    "pty", types.SimpleNamespace(openpty=lambda: (_ for _ in ()).throw(NotImplementedError()))
)
SPEC = importlib.util.spec_from_file_location("ses_server_smoke", SERVER_PATH)
server = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(server)

INGRESS = {"X-Ingress-Path": "/smoke"}

# path -> accepted status codes. A group that loses its blueprint returns 404 for
# every path in it; an import error at module load turns these into 500s.
CASES = {
    "/api/health": {200},
    "/api/runtime": {200},
    "/api/component-catalog": {200},
    "/api/assets/manifest": {200},
    "/api/assets/mdi-substitutions": {200},
    "/projects/list": {200},
    "/yaml/load?name=__smoke_missing__.yaml": {404},
    "/api/import/targets": {200},
    "/api/import/yaml-candidates": {200},
    "/api/secrets/raw": {200},
    "/api/devices/list": {200},
    "/api/devices/status?yaml=__smoke_missing__.yaml": {200},
    "/api/jobs/__smoke_missing__": {404},
    "/api/firmware?yaml=__smoke_missing__.yaml": {404},
    # environment dependent (web bundle present / pyserial importable)
    "/": {200, 404},
    "/api/serial/ports": {200, 503},
}


class RouteSmokeTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_every_route_group_answers(self):
        for path, accepted in CASES.items():
            with self.subTest(path=path):
                response = self.client.get(path, headers=INGRESS)
                self.assertIn(
                    response.status_code,
                    accepted,
                    f"{path} -> {response.status_code}: {response.get_data(as_text=True)[:200]}",
                )

    def test_unknown_api_route_is_json_404(self):
        response = self.client.get("/api/__does_not_exist__", headers=INGRESS)
        self.assertEqual(404, response.status_code)
        self.assertEqual("error", response.json["status"])

    def test_preflight_short_circuits_for_any_path(self):
        response = self.client.options("/projects/save")
        self.assertEqual(204, response.status_code)
        self.assertEqual("", response.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()
