"""Thin async wrapper around OpenRouter's per-key usage/limit API."""
from __future__ import annotations

import aiohttp

OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key"


class OpenRouterClient:
    def __init__(self, api_key: str, base_url: str = OPENROUTER_KEY_URL) -> None:
        self._api_key = api_key
        self._base_url = base_url

    async def fetch_usage(self) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                self._base_url,
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                resp.raise_for_status()
                body = await resp.json()
        data = body["data"]
        return {
            "limit_remaining": data.get("limit_remaining"),
            "usage": data.get("usage"),
            "usage_daily": data.get("usage_daily"),
            "usage_weekly": data.get("usage_weekly"),
            "usage_monthly": data.get("usage_monthly"),
            "is_free_tier": data.get("is_free_tier"),
        }
