from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from mongo.database import DB

class DonationSubscription(BaseModel):
    id: Optional[str] = None
    user_email: str
    amount: float
    status: str
    time: Optional[str] = None
    payment_method: Optional[str] = "paypal"
    type: Optional[str] = "subscription"
    subscription_id: str
    plan_id: Optional[str] = None
    start_time: Optional[str] = None
    next_billing_time: Optional[str] = None
    user_id: Optional[str] = None
    note: Optional[str] = None
    currency: Optional[str] = "USD"
    event_type: Optional[str] = None
    created_on: Optional[str] = None

    # CRUD Operations
    async def create_donation_subscription(subscription: 'DonationSubscription'):
        """
        Creates a new donation subscription using DB.insert_document.
        """
        doc = subscription.model_dump(exclude_unset=True)
        doc["created_on"] = subscription.created_on or datetime.now().isoformat()
        inserted_id = await DB.insert_document("donations_subscriptions", doc)
        if inserted_id is not None:
            sub_data = await DB.db["donations_subscriptions"].find_one({"_id": inserted_id})
            if sub_data is not None:
                sub_data["id"] = str(sub_data.pop("_id"))
                return DonationSubscription(**sub_data)
        return None

    async def get_donation_subscription_by_id(subscription_id: str):
        """
        Retrieves a donation subscription by its subscription_id.
        """
        sub_doc = await DB.db["donations_subscriptions"].find_one({"subscription_id": subscription_id})
        if sub_doc is not None:
            sub_doc["id"] = str(sub_doc.pop("_id"))
            return DonationSubscription(**sub_doc)
        return None

    async def get_donation_subscriptions_by_email(user_email: str, limit: int = None):
        """
        Retrieves donation subscriptions by user_email.
        """
        sub_docs = await DB.find_documents("donations_subscriptions", {"user_email": user_email}, limit=limit)
        for sub in sub_docs:
            sub["id"] = str(sub.pop("_id"))
        return [DonationSubscription(**sub) for sub in sub_docs]

    async def update_donation_subscription_status(subscription_id: str, status: str):
        """
        Updates the status of a donation subscription.
        """
        result = await DB.update_document("donations_subscriptions", {"subscription_id": subscription_id}, {"status": status})
        return result > 0

    async def update_donation_subscription_field(subscription_id: str, field: str, value):
        """
        Updates a single field of a donation subscription.
        """
        result = await DB.update_document("donations_subscriptions", {"subscription_id": subscription_id}, {field: value})
        return result > 0

    async def delete_donation_subscription(subscription_id: str):
        """
        Deletes a donation subscription by subscription_id.
        """
        result = await DB.delete_documents("donations_subscriptions", {"subscription_id": subscription_id})
        return result > 0
