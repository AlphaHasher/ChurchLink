# PayPalHelperV2.py
# Minimal, v2-Checkout friendly helper with singleton + token/cache

import os
import time
import base64
import asyncio
from typing import Optional, Dict, Any
import httpx


class PayPalHelperV2:
    # Singleton instance holder
    _instance: Optional["PayPalHelperV2"] = None
    _instance_lock = asyncio.Lock()

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            # Not thread-safe by itself; guarded by _instance_lock in get_instance()
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    async def get_instance(cls) -> "PayPalHelperV2":
        # Ensure one instance globally
        async with cls._instance_lock:
            if cls._instance is None:
                # Calling cls() triggers __new__ and then __init__
                cls._instance = cls()
            return cls._instance

    def __init__(self):
        # __init__ can be called multiple times by Python; guard with _initialized
        if getattr(self, "_initialized", False):
            return
        self._initialized = True

        # Read env once
        self.client_id = (os.getenv("PAYPAL_CLIENT_ID") or "").strip()
        self.client_secret = (os.getenv("PAYPAL_CLIENT_SECRET") or "").strip()
        mode = (os.getenv("PAYPAL_MODE") or "sandbox").strip().lower()

        if not self.client_id or not self.client_secret:
            raise ValueError("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are required")

        if mode not in ("sandbox", "live", "production"):
            raise ValueError("PAYPAL_MODE must be 'sandbox' or 'live'")
        self.mode = "live" if mode in ("live", "production") else "sandbox"

        self._base_url = (
            "https://api-m.paypal.com" if self.mode == "live" else "https://api-m.sandbox.paypal.com"
        )

        # HTTP + OAuth cache
        self._client: Optional[httpx.AsyncClient] = None
        self._token: Optional[str] = None
        self._token_expiry_epoch: float = 0.0
        self._token_lock = asyncio.Lock()

    async def start(self):
        # Create shared HTTP client and warm the token
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=20.0)
        # Optional: prefetch token so first request isn’t delayed
        try:
            await self._ensure_token()
        except Exception:
            # It's fine to lazily fetch on first authenticated call if this fails at boot.
            pass

    async def stop(self):
        # Close shared HTTP client
        if self._client is not None:
            try:
                await self._client.aclose()
            finally:
                self._client = None

    @property
    def base_url(self) -> str:
        return self._base_url

    async def _ensure_token(self) -> str:
        # Fast path: token valid for at least 60 more seconds
        now = time.time()
        if self._token and (self._token_expiry_epoch - 60) > now:
            return self._token

        async with self._token_lock:
            # Double-check after acquiring the lock
            now = time.time()
            if self._token and (self._token_expiry_epoch - 60) > now:
                return self._token

            auth = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode("utf-8")).decode("ascii")

            if self._client is None:
                self._client = httpx.AsyncClient(timeout=20.0)

            resp = await self._client.post(
                f"{self._base_url}/v1/oauth2/token",
                headers={
                    "Authorization": f"Basic {auth}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={"grant_type": "client_credentials"},
            )
            resp.raise_for_status()
            data = resp.json()
            access_token = data.get("access_token")
            expires_in = int(data.get("expires_in", 300))
            if not access_token:
                raise RuntimeError("PayPal token response missing access_token")

            self._token = access_token
            self._token_expiry_epoch = time.time() + max(60, expires_in)
            return self._token

    async def auth_headers(self, *, request_id: Optional[str] = None, json: bool = True) -> Dict[str, str]:
        token = await self._ensure_token()
        headers = {
            "Authorization": f"Bearer {token}",
        }
        if json:
            headers["Content-Type"] = "application/json"
        if request_id:
            headers["PayPal-Request-Id"] = request_id  # idempotency header
        return headers

    def new_http_client(self) -> httpx.AsyncClient:
        # Most callers should use the shared client, but this is available if needed
        return httpx.AsyncClient(timeout=20.0)

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            # Safe fallback if someone forgot to call start()
            self._client = httpx.AsyncClient(timeout=20.0)
        return self._client

    # Convenience helpers for v2 Checkout endpoints (optional, minimal)
    async def post(self, path: str, json_body: Any, *, request_id: Optional[str] = None) -> httpx.Response:
        headers = await self.auth_headers(request_id=request_id, json=True)
        return await self.client.post(f"{self._base_url}{path}", headers=headers, json=json_body)

    async def get(self, path: str) -> httpx.Response:
        headers = await self.auth_headers(json=False)
        return await self.client.get(f"{self._base_url}{path}", headers=headers)
