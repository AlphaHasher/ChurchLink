from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from mongo.database import DB
import logging

class Transaction(BaseModel):
    id: Optional[str] = None
    transaction_id: str  # Unique for each payment event
    user_email: str
    amount: float
    status: str
    type: str  # 'one-time' or 'subscription'
    order_id: Optional[str] = None  # For one-time payments
    subscription_id: Optional[str] = None  # For subscriptions
    plan_id: Optional[str] = None
    payment_method: Optional[str] = "paypal"
    time: Optional[str] = None
    start_time: Optional[str] = None
    next_billing_time: Optional[str] = None
    name: Optional[str] = None  # Donor name
    fund_name: Optional[str] = None  # Donation fund purpose
    note: Optional[str] = None
    currency: Optional[str] = "USD"
    event_type: Optional[str] = None
    created_on: Optional[str] = None
    
    # Event-specific fields for linking payments to registrations
    event_id: Optional[str] = None  # Link to specific event
    event_name: Optional[str] = None  # Event name for easy reference
    registration_key: Optional[str] = None  # Link to specific attendee record
    payment_type: Optional[str] = None  # "donation" | "event_registration" | "form_submission"
    user_uid: Optional[str] = None  # Firebase user ID for event registrations
    
    # Form-specific fields for linking payments to form submissions  
    form_id: Optional[str] = None  # Link to specific form
    form_slug: Optional[str] = None  # Form slug for easy reference
    
    # Additional metadata for detailed transaction information
    metadata: Optional[Dict[str, Any]] = None  # Store additional transaction details

    # CRUD Operations
    @staticmethod
    async def create_transaction(transaction: 'Transaction'):
        """
        Creates a new transaction using DB.insert_document.
        """
        try:
            doc = transaction.model_dump(exclude_unset=True)
            doc["created_on"] = transaction.created_on or datetime.now().isoformat()
            inserted_id = await DB.insert_document("transactions", doc)
            if inserted_id is not None:
                tx_data = await DB.db["transactions"].find_one({"_id": inserted_id})
                if tx_data is not None:
                    tx_data["id"] = str(tx_data.pop("_id"))
                    return Transaction(**tx_data)
                else:
                    logging.error(f"Transaction inserted but not found: {inserted_id}")
            else:
                logging.error(f"Failed to insert transaction: {doc}")
        except Exception as e:
            logging.exception(f"Error creating transaction: {e}")
        return None

    async def get_transaction_by_id(transaction_id: str):
        """
        Retrieves a transaction by its transaction_id.
        """
        tx_doc = await DB.db["transactions"].find_one({"transaction_id": transaction_id})
        if tx_doc is not None:
            tx_doc["id"] = str(tx_doc.pop("_id"))
            return Transaction(**tx_doc)
        return None

    async def get_transactions_by_email(user_email: str = None, limit: int = None):
        """
        Retrieves transactions by user_email, or all if user_email is None.
        """
        query = {"user_email": user_email} if user_email else {}
        tx_docs = await DB.find_documents("transactions", query, limit=limit)
        for tx in tx_docs:
            tx["id"] = str(tx.pop("_id"))
        return [Transaction(**tx) for tx in tx_docs]

    async def update_transaction_status(transaction_id: str, status: str):
        """
        Updates the status of a transaction.
        """
        result = await DB.update_document("transactions", {"transaction_id": transaction_id}, {"status": status})
        return result > 0

    async def delete_transaction(transaction_id: str):
        """
        Deletes a transaction by transaction_id.
        """
        result = await DB.delete_documents("transactions", {"transaction_id": transaction_id})
        return result > 0
    
    @staticmethod
    async def update_transaction_with_event_info(transaction_id: str, event_id: str, event_name: str, user_uid: str = None, registration_key: str = None):
        """
        Updates a transaction with event-specific information.
        """
        try:
            update_data = {
                "event_id": event_id,
                "event_name": event_name,
                "payment_type": "event_registration"
            }
            
            if user_uid:
                update_data["user_uid"] = user_uid
            
            if registration_key:
                update_data["registration_key"] = registration_key
                
            result = await DB.update_document("transactions", {"transaction_id": transaction_id}, update_data)
            return result > 0
        except Exception as e:
            logging.error(f"Error updating transaction {transaction_id} with event info: {e}")
            return False
    
    @staticmethod
    async def save_paypal_transaction(transaction_data: dict):
        """
        Save a PayPal transaction (one-time or subscription) to MongoDB using Transaction model.
        """
        import logging
        logging.info(f"Attempting to save PayPal transaction: {transaction_data}")
        try:
            transaction = Transaction(**transaction_data)
            result = await Transaction.create_transaction(transaction)
            logging.info(f"Transaction saved successfully: {result}")
            return result
        except Exception as e:
            logging.error(f"Error saving PayPal transaction: {e}")
            raise

    # Event-specific transaction methods
    @staticmethod
    async def get_transactions_by_event(event_id: str):
        """
        Get all transactions for a specific event.
        """
        try:
            tx_docs = await DB.find_documents("transactions", {"event_id": event_id})
            for tx in tx_docs:
                tx["id"] = str(tx.pop("_id"))
            return [Transaction(**tx) for tx in tx_docs]
        except Exception as e:
            logging.error(f"Error getting transactions for event {event_id}: {e}")
            return []

    @staticmethod
    async def get_transaction_by_registration_key(registration_key: str):
        """
        Get transaction for a specific event registration.
        """
        try:
            tx_doc = await DB.db["transactions"].find_one({"registration_key": registration_key})
            if tx_doc:
                tx_doc["id"] = str(tx_doc.pop("_id"))
                return Transaction(**tx_doc)
            return None
        except Exception as e:
            logging.error(f"Error getting transaction for registration {registration_key}: {e}")
            return None

    @staticmethod
    async def get_event_payment_summary(event_id: str):
        """
        Get payment summary for an event.
        """
        try:
            pipeline = [
                {"$match": {"event_id": event_id, "payment_type": "event_registration"}},
                {"$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                    "total_amount": {"$sum": "$amount"}
                }}
            ]
            result = await DB.db["transactions"].aggregate(pipeline).to_list(None)
            return {item["_id"]: {"count": item["count"], "total_amount": item["total_amount"]} for item in result}
        except Exception as e:
            logging.error(f"Error getting payment summary for event {event_id}: {e}")
            return {}

    @staticmethod
    async def get_transactions_by_form(form_id: str):
        """
        Get all transactions for a specific form.
        """
        try:
            tx_docs = await DB.find_documents("transactions", {"form_id": form_id})
            for tx in tx_docs:
                tx["id"] = str(tx.pop("_id"))
            return [Transaction(**tx) for tx in tx_docs]
        except Exception as e:
            logging.error(f"Error getting transactions for form {form_id}: {e}")
            return []

    @staticmethod
    async def get_form_payment_summary(form_id: str):
        """
        Get payment summary for a form.
        """
        try:
            pipeline = [
                {"$match": {"form_id": form_id, "payment_type": "form_submission"}},
                {"$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                    "total_amount": {"$sum": "$amount"}
                }}
            ]
            result = await DB.db["transactions"].aggregate(pipeline).to_list(None)
            return {item["_id"]: {"count": item["count"], "total_amount": item["total_amount"]} for item in result}
        except Exception as e:
            logging.error(f"Error getting payment summary for form {form_id}: {e}")
            return {}
