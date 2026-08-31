# NOT CURRENTLY BUILDABLE: HA Supervisor builds this with smartesp-studio/ as context, which
# can't see smartesp-studio-frontend/ -- COPY web /web below has nothing to copy since the
# frontend build output is no longer checked in (see Phase 4 / R2 in REFACTORING.md). The HA
# add-on distribution path is shelved for now; only the standalone image (Dockerfile.standalone,
# built from the repo root) is maintained. Revisit before relisting on the HA add-on store.
FROM ghcr.io/esphome/esphome-hassio:2026.6.4

ENV LANG=C.UTF-8
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt /requirements.txt
RUN python3 -m venv /opt/designer-venv \
    && /opt/designer-venv/bin/python -m pip install --no-cache-dir -U pip \
    && /opt/designer-venv/bin/python -m pip install --no-cache-dir -r /requirements.txt

COPY server.py /server.py
COPY ses /ses
COPY run.sh /run.sh
COPY seed_esphome /seed_esphome
COPY logo.png /logo.png
COPY web /web
RUN chmod a+x /run.sh

# Override the esphome base image healthcheck (it probes the dashboard on :6052).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD curl -fsS http://localhost:8099/api/health || exit 1

ENTRYPOINT ["/run.sh"]
