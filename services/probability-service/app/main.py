"""FastAPI entrypoint for the probability service."""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI

from app.api.routes import router as api_router

load_dotenv()

level_name = os.getenv("LOG_LEVEL", "INFO").upper()
level = logging.getLevelNamesMapping().get(level_name, logging.INFO)
if level_name not in logging.getLevelNamesMapping():
    logging.getLogger("probability_service").warning(
        "Invalid LOG_LEVEL=%s; defaulting to INFO",
        level_name,
    )
logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("probability_service")

app = FastAPI(title="Probability Service", version="0.1.0")
app.include_router(api_router)


@app.on_event("startup")
def on_startup() -> None:
    """Log service startup."""
    logger.info("Probability service starting up")
