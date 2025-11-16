from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Literal

from pydantic import BaseModel, Field


class TransactionRefund(BaseModel):
    """
    Canonical refund log entry shared across ledgers.

    Used for:
    - event transactions (per-line refunds)
    - one-time donation transactions
    - form payment transactions
    - subscription payment transactions (later)

    Extra fields (currency, source, payload) are optional so existing
    data without them will still parse cleanly.
    """

    # PayPal refund id (or some synthetic id for legacy / non-PayPal refunds)
    refund_id: str

    # Money
    amount: float
    currency: Literal["USD"] = "USD"

    # Human / system context
    reason: Optional[str] = None           # "admin_manual", "paypal_external", etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    by_uid: Optional[str] = None           # admin uid or system actor, if known

    # Optional metadata about where this came from
    source: Optional[str] = None           # "admin_api", "webhook", "migration", ...
    paypal_refund_payload: Optional[Dict[str, Any]] = None
