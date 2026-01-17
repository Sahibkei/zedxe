from __future__ import annotations

import json
import os
from typing import Any

try:
    import redis
except Exception:  # pragma: no cover - optional dependency
    redis = None


class RedisCache:
    def __init__(self) -> None:
        self.url = os.getenv("REDIS_URL")
        self.enabled = bool(self.url) and redis is not None
        self.client = redis.from_url(self.url) if self.enabled else None
        self.ttl = int(os.getenv("REDIS_TTL", "90"))

    def build_key(
        self,
        symbol: str,
        timeframe: str,
        horizon: int,
        lookback: int,
        event: str,
        as_of: str,
        targetX: float,
    ) -> str:
        return f"prob:{symbol}:{timeframe}:{horizon}:{lookback}:{event}:{as_of}:{targetX}"

    def get(self, key: str) -> Any | None:
        if not self.enabled:
            return None
        cached = self.client.get(key)
        if cached is None:
            return None
        return json.loads(cached)

    def set(self, key: str, value: Any) -> None:
        if not self.enabled:
            return
        self.client.setex(key, self.ttl, json.dumps(value))
