"""Redis cache helpers for probability responses."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

try:
    import redis
except ImportError:  # pragma: no cover - optional dependency
    redis = None

if redis is not None:
    RedisError = redis.RedisError
else:  # pragma: no cover - optional dependency
    class RedisError(Exception):
        """Fallback error type when redis is unavailable."""

logger = logging.getLogger("probability_service.cache")


class RedisCache:
    """Lightweight Redis cache wrapper with safe fallbacks."""

    def __init__(self) -> None:
        """Initialize cache client based on environment config."""
        self.url = os.getenv("REDIS_URL")
        self.enabled = bool(self.url) and redis is not None
        self.client = None
        self.ttl = self._parse_ttl(os.getenv("REDIS_TTL"))

        if self.enabled:
            try:
                self.client = redis.from_url(self.url)
            except RedisError as exc:
                logger.warning("Redis client init failed: %s", exc)
                self.enabled = False
                self.client = None

    @staticmethod
    def _parse_ttl(value: str | None) -> int:
        """Parse TTL from env, falling back to default on invalid input."""
        default_ttl = 90
        if value is None:
            return default_ttl
        try:
            ttl = int(value)
        except (TypeError, ValueError):
            logger.warning("Invalid REDIS_TTL=%s; using default %s", value, default_ttl)
            return default_ttl
        if ttl <= 0:
            logger.warning("Invalid REDIS_TTL=%s; using default %s", value, default_ttl)
            return default_ttl
        return ttl

    def build_key(
        self,
        symbol: str,
        timeframe: str,
        horizon: int,
        lookback: int,
        event: str,
        targetX: float,
        as_of: str,
    ) -> str:
        """Build a deterministic cache key for a probability query."""
        return f"prob:{symbol}:{timeframe}:{horizon}:{lookback}:{event}:{targetX}:{as_of}"

    def get(self, key: str) -> Any | None:
        """Fetch cached payload if available."""
        if not self.enabled or self.client is None:
            return None
        try:
            cached = self.client.get(key)
            if cached is None:
                return None
            return json.loads(cached)
        except (json.JSONDecodeError, TypeError, ValueError, RedisError) as exc:
            logger.warning("Cache get failed: %s", exc)
            return None

    def set(self, key: str, value: Any) -> None:
        """Store payload in cache, ignoring any redis errors."""
        if not self.enabled or self.client is None:
            return
        try:
            self.client.setex(key, self.ttl, json.dumps(value))
        except (TypeError, ValueError, RedisError) as exc:
            logger.warning("Cache set failed: %s", exc)
