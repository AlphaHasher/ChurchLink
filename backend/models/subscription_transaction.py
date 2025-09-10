from pydantic import BaseModel
from typing import Optional

class SubscriptionTransaction(BaseModel):
    id: Optional[str] = None
    subscription_id: str  # Link to DonationSubscription
    transaction_id: str   # Unique transaction identifier
    amount: float
    status: str
    payment_date: Optional[str] = None
    currency: Optional[str] = "USD"
    note: Optional[str] = None
    event_type: Optional[str] = None
    created_on: Optional[str] = None
