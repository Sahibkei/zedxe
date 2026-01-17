"""Symbol metadata derived from local OHLC files."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SymbolMetaInfo:
    """Metadata for a tradable symbol."""

    symbol: str
    timeframes: list[str]
    pip_size: float
    point_size: float


class SymbolMeta:
    """Discover available symbols/timeframes and provide sizing defaults."""

    def __init__(self) -> None:
        """Build symbol metadata from the local data directory."""
        self.data_dir = Path(
            os.getenv(
                "OHLC_DATA_DIR",
                Path(__file__).resolve().parents[2] / "data",
            )
        )
        self._symbols = self._load_symbols()

    def _load_symbols(self) -> dict[str, SymbolMetaInfo]:
        """Scan the data directory for supported symbol/timeframe files."""
        symbols: dict[str, SymbolMetaInfo] = {}
        if not self.data_dir.exists():
            return symbols

        for path in self.data_dir.glob("*.csv"):
            name = path.stem
            if name.endswith(".sample"):
                name = name[: -len(".sample")]
            if "_" not in name:
                continue
            symbol, timeframe = name.split("_", 1)
            info = symbols.get(symbol)
            if info:
                timeframes = sorted(set(info.timeframes + [timeframe]))
                symbols[symbol] = SymbolMetaInfo(
                    symbol=symbol,
                    timeframes=timeframes,
                    pip_size=info.pip_size,
                    point_size=info.point_size,
                )
            else:
                pip_size, point_size = self._default_sizes(symbol)
                symbols[symbol] = SymbolMetaInfo(
                    symbol=symbol,
                    timeframes=[timeframe],
                    pip_size=pip_size,
                    point_size=point_size,
                )

        return symbols

    def _default_sizes(self, symbol: str) -> tuple[float, float]:
        """Guess pip/point sizes from symbol prefixes."""
        if symbol.upper().endswith("JPY"):
            return 0.01, 0.0001
        if symbol.upper().startswith("XAU"):
            return 0.1, 0.01
        if symbol.upper().startswith("US"):
            return 1.0, 0.1
        return 0.0001, 0.00001

    def list_symbols(self) -> list[SymbolMetaInfo]:
        """Return symbol metadata entries sorted by symbol."""
        return sorted(self._symbols.values(), key=lambda item: item.symbol)

    def ensure_allowed(self, symbol: str, timeframe: str) -> None:
        """Raise if a symbol/timeframe pair is unavailable."""
        info = self._symbols.get(symbol)
        if not info or timeframe not in info.timeframes:
            raise ValueError(f"symbol/timeframe not available: {symbol} {timeframe}")
