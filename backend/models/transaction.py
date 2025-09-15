from pydantic import BaseModel
from typing import Optional
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
    note: Optional[str] = None
    currency: Optional[str] = "USD"
    event_type: Optional[str] = None
    created_on: Optional[str] = None

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
