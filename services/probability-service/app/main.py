from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from dotenv import load_dotenv

from app.api.routes import router as api_router

load_dotenv()

LOG_LEVEL = os.getenv("LOG_LEVEL", "info").upper()
logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("probability_service")

app = FastAPI(title="Probability Service", version="0.1.0")
app.include_router(api_router)


@app.on_event("startup")
def on_startup() -> None:
    logger.info("Probability service starting up")
