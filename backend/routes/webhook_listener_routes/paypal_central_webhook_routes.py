from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException, status
from typing import Any, Dict
from helpers.PayPalWebhookHelper import handle_paypal_event
from models.webhook_storage import record_event_seen, record_event_failure
from helpers.PayPalHelperV2 import PayPalHelperV2
import os

paypal_central_webhook_router = APIRouter(prefix="/paypal", tags=["PayPal"])

WEBHOOK_ID = os.getenv("PAYPAL_WEBHOOK_ID")  # must be configured in your PayPal app

async def _verify_webhook_signature(request: Request, event: Dict[str, Any]) -> bool:
    """
    Calls PayPal's /v1/notifications/verify-webhook-signature
    """
    if not WEBHOOK_ID:
        # We explicitly fail closed if the webhook id isn't configured
        raise HTTPException(status_code=500, detail="PAYPAL_WEBHOOK_ID not configured")

    helper = await PayPalHelperV2.get_instance()
    await helper.start()

    headers = request.headers
    payload = {
        "auth_algo": headers.get("paypal-auth-algo"),
        "cert_url": headers.get("paypal-cert-url"),
        "transmission_id": headers.get("paypal-transmission-id"),
        "transmission_sig": headers.get("paypal-transmission-sig"),
        "transmission_time": headers.get("paypal-transmission-time"),
        "webhook_id": WEBHOOK_ID,
        "webhook_event": event,
    }
    resp = await helper.post("/v1/notifications/verify-webhook-signature", payload)
    if resp.status_code != 200:
        return False
    data = resp.json() or {}
    return data.get("verification_status") == "SUCCESS"

@paypal_central_webhook_router.post("/webhook")
async def paypal_webhook(request: Request):
    event = await request.json()

    # 1) Idempotency: drop duplicates (PayPal retries aggressively)
    evt_id = (event or {}).get("id")
    if not evt_id:
        # All PayPal webhooks should have an id; if not, mark as invalid signature later
        pass
    else:
        already = await record_event_seen(evt_id, event)
        if already:
            return {"ok": True, "duplicate": True}

    # 2) Verify signature
    try:
        verified = await _verify_webhook_signature(request, event)
    except HTTPException:
        # bubble up configuration errors
        raise
    except Exception as e:
        # If verification call itself fails, do not process
        await record_event_failure(evt_id or "NO_ID", "verification_call_failed", {"error": str(e), "event": event})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook verification failed")

    if not verified:
        await record_event_failure(evt_id or "NO_ID", "invalid_signature", {"event": event})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    # 3) Route to handlers
    try:
        result = await handle_paypal_event(event)
        return {"ok": True, **(result or {})}
    except Exception as e:
        await record_event_failure(evt_id or "NO_ID", "handler_error", {"error": str(e), "event": event})
        # Re-raise to signal a retry; you can also return 200 and rely on dead-letter if preferred.
        raise
