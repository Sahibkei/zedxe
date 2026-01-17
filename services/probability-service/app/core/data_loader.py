from __future__ import annotations

import logging
import os
from pathlib import Path

import pandas as pd

from app.core.symbol_meta import SymbolMeta

logger = logging.getLogger("probability_service.data_loader")


class DataNotFoundError(RuntimeError):
    pass


class DataLoader:
    def __init__(self, symbol_meta: SymbolMeta) -> None:
        self.symbol_meta = symbol_meta
        self.data_dir = Path(
            os.getenv(
                "OHLC_DATA_DIR",
                Path(__file__).resolve().parents[2] / "data",
            )
        )

    def load(self, symbol: str, timeframe: str) -> pd.DataFrame:
        symbol = symbol.strip()
        timeframe = timeframe.strip()
        self.symbol_meta.ensure_allowed(symbol, timeframe)

        filename = f"{symbol}_{timeframe}.csv"
        filepath = self.data_dir / filename
        if not filepath.exists():
            sample_path = self.data_dir / f"{symbol}_{timeframe}.sample.csv"
            if sample_path.exists():
                filepath = sample_path
            else:
                logger.warning("Missing data file for %s %s", symbol, timeframe)
                raise DataNotFoundError(f"no data file for {symbol} {timeframe}")

        df = pd.read_csv(filepath)
        df = self._normalize(df)

        if df.empty:
            raise DataNotFoundError(f"no valid rows for {symbol} {timeframe}")

        return df

    @staticmethod
    def _normalize(df: pd.DataFrame) -> pd.DataFrame:
        expected = {"timestamp", "open", "high", "low", "close"}
        missing = expected - set(df.columns)
        if missing:
            raise DataNotFoundError(f"missing columns: {', '.join(sorted(missing))}")

        df = df.copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
        df = df.dropna(subset=["timestamp", "open", "high", "low", "close"])
        df = df.sort_values("timestamp")
        return df.reset_index(drop=True)
