"""Logging setup shared by the whole backend."""

import logging
import os

logging.basicConfig(
    level=os.environ.get("ECD_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

log = logging.getLogger("ecd")


def get_logger(name: str = "ecd") -> logging.Logger:
    return logging.getLogger(name)
