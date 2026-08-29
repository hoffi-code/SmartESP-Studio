import os

from ses import config, create_app
from ses.logging import log

app = create_app()


if __name__ == "__main__":
    log.info("Starting SmartESP Studio %s on :%s (mode=%s)", config.SES_VERSION or "dev", config.PORT, config.SES_MODE)
    try:
        from waitress import serve
    except ImportError:
        # Local dev without waitress installed.
        app.run(host="0.0.0.0", port=config.PORT)
    else:
        # Streaming log endpoints hold a thread each while a job runs, so keep a
        # generous pool.
        serve(
            app,
            host="0.0.0.0",
            port=config.PORT,
            threads=int(os.environ.get("SES_THREADS", "8")),
        )
