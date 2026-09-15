"""Thin async wrapper around Finnhub's quote API."""
from __future__ import annotations

import asyncio

import aiohttp

FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote"


class FinnhubClient:
    def __init__(self, api_key: str, base_url: str = FINNHUB_QUOTE_URL) -> None:
        self._api_key = api_key
        self._base_url = base_url

    async def fetch_quote(self, symbol: str) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                self._base_url,
                params={"symbol": symbol, "token": self._api_key},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()
        return {
            "symbol": symbol,
            "price": data.get("c"),
            "change": data.get("d"),
            "changePercent": data.get("dp"),
        }

    async def fetch_quotes(self, symbols: list[str]) -> list[dict]:
        results = await asyncio.gather(
            *(self.fetch_quote(symbol) for symbol in symbols), return_exceptions=True
        )
        # ponytail: a failed symbol is dropped rather than surfaced per-symbol;
        # upgrade to an {symbol, error} entry if silent drops become confusing.
        return [r for r in results if not isinstance(r, Exception)]
