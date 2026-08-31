"""Logging setup shared by the whole backend."""

import logging
import os

logging.basicConfig(
    level=os.environ.get("SES_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

log = logging.getLogger("ses")


def get_logger(name: str = "ses") -> logging.Logger:
    return logging.getLogger(name)
