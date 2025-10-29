from pydantic import BaseModel, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal
from bson import ObjectId
from mongo.database import DB
import logging

# ========================================
# PAYMENT STATUS CONSTANTS
# ========================================

class PaymentStatus:
    """Transaction status constants"""
    PENDING = "pending"         # Payment initiated but not completed
    COMPLETED = "completed"     # Payment successful  
    FAILED = "failed"          # Payment failed/declined
    REFUNDED = "refunded"      # Payment refunded
    PARTIALLY_REFUNDED = "partially_refunded"  # Payment partially refunded
    CANCELLED = "cancelled"    # Payment cancelled by user

class RefundStatus:
    """Refund request status constants"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class RegistrationPaymentStatus:
    """Event registration payment status constants"""
    NOT_REQUIRED = "not_required"  # Free event
    PENDING = "pending"            # Payment required but not completed
    COMPLETED = "completed"        # Payment completed
    FAILED = "failed"             # Payment failed
    REFUND_REQUESTED = "refund_requested"  # Refund has been requested
    REFUNDED = "refunded"         # Payment fully refunded
    PARTIALLY_REFUNDED = "partially_refunded"  # Payment partially refunded

# Valid status transitions
VALID_PAYMENT_TRANSITIONS = {
    PaymentStatus.PENDING: [PaymentStatus.COMPLETED, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
    PaymentStatus.COMPLETED: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED],
    PaymentStatus.FAILED: [PaymentStatus.PENDING],  # Retry allowed
    PaymentStatus.CANCELLED: [PaymentStatus.PENDING],  # Retry allowed
    PaymentStatus.PARTIALLY_REFUNDED: [PaymentStatus.REFUNDED],  # Can refund remaining amount
    PaymentStatus.REFUNDED: []  # Terminal state
}

def is_valid_status_transition(from_status: str, to_status: str) -> bool:
    """Check if status transition is valid"""
    return to_status in VALID_PAYMENT_TRANSITIONS.get(from_status, [])

def get_valid_next_statuses(current_status: str) -> list:
    """Get list of valid next statuses from current status"""
    return VALID_PAYMENT_TRANSITIONS.get(current_status, [])

class Transaction(BaseModel):
    id: Optional[str] = None
    transaction_id: str  # Unique for each payment event
    user_email: str
    amount: Decimal  # Use Decimal for precise financial calculations
    status: str = PaymentStatus.PENDING  # Use constants with default
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
    
    # Refund-specific fields
    refund_type: Optional[str] = None  # "full", "partial", or None for non-refunded transactions
    refunded_on: Optional[str] = None  # ISO timestamp when refund was processed
    
    # Additional metadata for detailed transaction information
    metadata: Optional[Dict[str, Any]] = None  # Store additional transaction details

    @field_validator('refund_type')
    @classmethod
    def validate_refund_type(cls, v):
        """Ensure refund_type is valid"""
        if v is not None and v not in ["full", "partial"]:
            raise ValueError(f"Invalid refund_type: {v}. Must be 'full', 'partial', or None")
        return v

    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        """Ensure amount is properly converted to Decimal"""
        if v is None:
            return Decimal('0.00')
        if isinstance(v, (int, float, str)):
            try:
                # Convert to Decimal with 2 decimal places for currency
                return Decimal(str(v)).quantize(Decimal('0.01'))
            except (ValueError, TypeError):
                raise ValueError(f"Invalid amount: {v}. Must be a valid number")
        elif isinstance(v, Decimal):
            # Ensure 2 decimal places for currency
            return v.quantize(Decimal('0.01'))
        else:
            raise ValueError(f"Invalid amount type: {type(v)}. Must be numeric")

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        """Ensure status is always lowercase and valid"""
        if v:
            v = v.lower()
            valid_statuses = [
                PaymentStatus.PENDING, PaymentStatus.COMPLETED, PaymentStatus.FAILED,
                PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.CANCELLED
            ]
            if v not in valid_statuses:
                raise ValueError(f"Invalid status: {v}. Must be one of: {valid_statuses}")
        return v

    # CRUD Operations
    @staticmethod
    async def create_transaction(transaction: 'Transaction'):
        """
        Creates a new transaction using DB.insert_document.
        """
        try:
            # Convert to dict and exclude any _id field to prevent conflicts
            doc = transaction.dict(exclude_unset=True, exclude={'id'})
            
            # Ensure _id is not in the document
            if '_id' in doc:
                del doc['_id']
            
            # Convert Decimal amount to float for MongoDB storage
            if 'amount' in doc and isinstance(doc['amount'], Decimal):
                doc['amount'] = float(doc['amount'])
                
            doc["created_on"] = transaction.created_on or datetime.now().isoformat()
            
            logging.info(f"Attempting to insert transaction: {doc.get('transaction_id')}")
            inserted_id = await DB.insert_document("transactions", doc)
            
            if inserted_id is not None:
                tx_data = await DB.db["transactions"].find_one({"_id": inserted_id})
                if tx_data is not None:
                    tx_data["id"] = str(tx_data.pop("_id"))
                    # Convert amount back to Decimal when loading
                    if 'amount' in tx_data:
                        tx_data['amount'] = Decimal(str(tx_data['amount']))
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
            # Convert amount back to Decimal when loading from MongoDB
            if 'amount' in tx_doc:
                tx_doc['amount'] = Decimal(str(tx_doc['amount']))
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
            # Convert amount back to Decimal when loading from MongoDB
            if 'amount' in tx:
                tx['amount'] = Decimal(str(tx['amount']))
        return [Transaction(**tx) for tx in tx_docs]

    async def update_transaction_status(transaction_id: str, new_status: str):
        """
        Updates the status of a transaction with validation.
        """
        try:
            # Normalize status to lowercase
            new_status = new_status.lower()
            
            # Get current transaction to validate transition
            current_tx = await Transaction.get_transaction_by_id(transaction_id)
            if not current_tx:
                logging.error(f"Transaction not found: {transaction_id}")
                return False
                
            # Validate status transition
            if not is_valid_status_transition(current_tx.status, new_status):
                logging.warning(f"Invalid status transition for {transaction_id}: {current_tx.status} -> {new_status}")
                # Allow it but log the warning for now during migration
                
            result = await DB.update_document("transactions", {"transaction_id": transaction_id}, {"status": new_status})
            
            if result > 0:
                logging.info(f"Transaction {transaction_id} status updated: {current_tx.status} -> {new_status}")
            
            return result > 0
            
        except Exception as e:
            logging.error(f"Error updating transaction status: {e}")
            return False

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
    async def update_transaction_refund_info(transaction_id: str, refund_type: str, refunded_on: str = None):
        """
        Updates a transaction with refund information.
        
        Args:
            transaction_id: Transaction ID to update
            refund_type: Type of refund ("full" or "partial")
            refunded_on: ISO timestamp when refund was processed (defaults to current time)
        """
        try:
            if refunded_on is None:
                refunded_on = datetime.now().isoformat()
                
            update_data = {
                "refund_type": refund_type,
                "refunded_on": refunded_on
            }
                
            result = await DB.update_document("transactions", {"transaction_id": transaction_id}, update_data)
            
            if result > 0:
                logging.info(f"Transaction {transaction_id} refund info updated: type={refund_type}, date={refunded_on}")
            
            return result > 0
        except Exception as e:
            logging.error(f"Error updating transaction {transaction_id} refund info: {e}")
            return False
    
    @staticmethod
    async def save_paypal_transaction(transaction_data: dict):
        """
        Save a PayPal transaction (one-time or subscription) to MongoDB using Transaction model.
        """
        
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
                # Convert amount back to Decimal when loading from MongoDB
                if 'amount' in tx:
                    tx['amount'] = Decimal(str(tx['amount']))
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
                # Convert amount back to Decimal when loading from MongoDB
                if 'amount' in tx_doc:
                    tx_doc['amount'] = Decimal(str(tx_doc['amount']))
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
            # Convert amounts back to Decimal for consistency
            summary = {}
            for item in result:
                summary[item["_id"]] = {
                    "count": item["count"], 
                    "total_amount": Decimal(str(item["total_amount"]))
                }
            return summary
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
                # Convert amount back to Decimal when loading from MongoDB
                if 'amount' in tx:
                    tx['amount'] = Decimal(str(tx['amount']))
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
            # Convert amounts back to Decimal for consistency
            summary = {}
            for item in result:
                summary[item["_id"]] = {
                    "count": item["count"], 
                    "total_amount": Decimal(str(item["total_amount"]))
                }
            return summary
        except Exception as e:
            logging.error(f"Error getting payment summary for form {form_id}: {e}")
            return {}

    # ========================================
    # CENTRALIZED PAYMENT STATUS METHODS
    # ========================================
    
    @staticmethod
    async def get_attendee_payment_status(event_id: str, attendee_key: str) -> str:
        """
        Get payment status for an attendee by looking up their transaction.
        Now supports both single and bulk transactions, and checks for refund requests.
        
        Args:
            event_id: Event ID
            attendee_key: Attendee key (uid|person_id|kind|scope)
            
        Returns:
            Payment status string (completed, pending, failed, not_required, refund_requested, refunded)
        """
        try:
            # Get attendee record first to check for transaction_id
            attendee_doc = await DB.db["events"].find_one(
                {"_id": ObjectId(event_id), "attendees.key": attendee_key},
                {"attendees.$": 1, "price": 1}
            )
            
            if not attendee_doc:
                return RegistrationPaymentStatus.PENDING
                
            # Check if event is free first
            event_price = attendee_doc.get("price", 0)
            if event_price == 0:
                return RegistrationPaymentStatus.NOT_REQUIRED
                
            if not attendee_doc.get("attendees"):
                return RegistrationPaymentStatus.PENDING
                
            attendee = attendee_doc["attendees"][0]
            transaction_id = attendee.get("transaction_id")
            
            if not transaction_id:
                return RegistrationPaymentStatus.PENDING
            
            # Extract user_uid and person_id from attendee key
            # Format: uid|person_id|kind|scope
            key_parts = attendee_key.split("|")
            if len(key_parts) >= 2:
                user_uid = key_parts[0]
                person_id = key_parts[1] if key_parts[1] != 'self' else None
                
                # Check for pending refund requests
                refund_query = {
                    "event_id": event_id,
                    "user_uid": user_uid,
                    "status": {"$in": ["pending", "processing"]}
                }
                
                if person_id:
                    refund_query["person_id"] = person_id
                else:
                    refund_query["person_id"] = {"$in": [None, ""]}
                
                refund_request = await DB.db["refund_requests"].find_one(refund_query)
                
                if refund_request:
                    return RegistrationPaymentStatus.REFUND_REQUESTED
            
            # Check if this is a child transaction (bulk payment scenario)
            if "-CHILD-" in transaction_id:
                # This is a child transaction from bulk payment
                transaction = await Transaction.get_transaction_by_id(transaction_id)
                if not transaction:
                    return RegistrationPaymentStatus.PENDING
                    
                # Map transaction status to registration status
                if transaction.status == PaymentStatus.COMPLETED:
                    return RegistrationPaymentStatus.COMPLETED
                elif transaction.status == PaymentStatus.REFUNDED:
                    return RegistrationPaymentStatus.REFUNDED
                else:
                    return RegistrationPaymentStatus.PENDING
            else:
                # Single transaction logic
                transaction = await Transaction.get_transaction_by_id(transaction_id)
                if not transaction:
                    return RegistrationPaymentStatus.PENDING
                    
                # Map transaction status to registration status
                if transaction.status == PaymentStatus.COMPLETED:
                    return RegistrationPaymentStatus.COMPLETED
                elif transaction.status == PaymentStatus.FAILED:
                    return RegistrationPaymentStatus.FAILED
                elif transaction.status == PaymentStatus.REFUNDED:
                    return RegistrationPaymentStatus.REFUNDED
                else:
                    return RegistrationPaymentStatus.PENDING
                
        except Exception as e:
            logging.error(f"Error getting attendee payment status: {e}")
            return RegistrationPaymentStatus.PENDING

    @staticmethod
    async def get_event_payment_summary_detailed(event_id: str) -> Dict[str, Any]:
        """
        Get detailed payment summary for an event using Transaction records.
        
        Returns:
            Dictionary with payment statistics
        """
        try:
            # Get event details
            event = await DB.db["events"].find_one({"_id": ObjectId(event_id)}, {"attendees": 1, "price": 1})
            if not event:
                return {"error": "Event not found"}
                
            attendees = event.get("attendees", [])
            event_price = event.get("price", 0)
            
            if event_price == 0:
                # Free event
                return {
                    "total_attendees": len(attendees),
                    "payment_required": False,
                    "not_required": len(attendees),
                    "pending": 0,
                    "completed": 0,
                    "failed": 0,
                    "by_status": {
                        RegistrationPaymentStatus.NOT_REQUIRED: len(attendees)
                    }
                }
            
            # Count attendees by payment status
            status_counts = {
                RegistrationPaymentStatus.NOT_REQUIRED: 0,
                RegistrationPaymentStatus.PENDING: 0,
                RegistrationPaymentStatus.COMPLETED: 0,
                RegistrationPaymentStatus.FAILED: 0
            }
            
            for attendee in attendees:
                transaction_id = attendee.get("transaction_id")
                
                if not transaction_id:
                    status_counts[RegistrationPaymentStatus.PENDING] += 1
                    continue
                    
                # Look up transaction status
                transaction = await Transaction.get_transaction_by_id(transaction_id)
                if not transaction:
                    status_counts[RegistrationPaymentStatus.PENDING] += 1
                    continue
                    
                # Map transaction status to registration status
                if transaction.status == PaymentStatus.COMPLETED:
                    status_counts[RegistrationPaymentStatus.COMPLETED] += 1
                elif transaction.status == PaymentStatus.FAILED:
                    status_counts[RegistrationPaymentStatus.FAILED] += 1
                else:
                    status_counts[RegistrationPaymentStatus.PENDING] += 1
            
            return {
                "total_attendees": len(attendees),
                "payment_required": True,
                "not_required": status_counts[RegistrationPaymentStatus.NOT_REQUIRED],
                "pending": status_counts[RegistrationPaymentStatus.PENDING],
                "completed": status_counts[RegistrationPaymentStatus.COMPLETED],
                "failed": status_counts[RegistrationPaymentStatus.FAILED],
                "by_status": status_counts
            }
            
        except Exception as e:
            logging.error(f"Error getting event payment summary: {e}")
            return {"error": str(e)}

    @staticmethod
    async def get_event_registrations_by_payment_status(event_id: str, payment_status: Optional[str] = None) -> List[Dict]:
        """
        Get event registrations filtered by payment status using Transaction records.
        
        Args:
            event_id: Event ID
            payment_status: Filter by status (optional)
            
        Returns:
            List of attendee records with enriched payment information
        """
        try:
            # Get event with attendees
            event = await DB.db["events"].find_one({"_id": ObjectId(event_id)}, {"attendees": 1, "price": 1})
            if not event:
                return []
                
            attendees = event.get("attendees", [])
            event_price = event.get("price", 0)
            enriched_attendees = []
            
            for attendee in attendees:
                # Get payment status for this attendee
                attendee_payment_status = await Transaction.get_attendee_payment_status(event_id, attendee["key"])
                
                # Add payment information to attendee record
                enriched_attendee = {
                    **attendee,
                    "computed_payment_status": attendee_payment_status,
                    "event_price": event_price
                }
                
                # Add transaction details if available
                transaction_id = attendee.get("transaction_id")
                if transaction_id:
                    transaction = await Transaction.get_transaction_by_id(transaction_id)
                    if transaction:
                        enriched_attendee["transaction_details"] = {
                            "transaction_id": transaction.transaction_id,
                            "amount": float(transaction.amount),  # Convert Decimal to float for JSON serialization
                            "status": transaction.status,
                            "payment_method": transaction.payment_method,
                            "created_on": transaction.created_on
                        }
                
                # Filter by payment status if specified
                if payment_status is None or attendee_payment_status == payment_status:
                    enriched_attendees.append(enriched_attendee)
            
            return enriched_attendees
            
        except Exception as e:
            logging.error(f"Error getting event registrations by payment status: {e}")
            return []

    @staticmethod
    async def update_attendee_transaction_reference(event_id: str, attendee_key: str, transaction_id: str) -> bool:
        """
        Update attendee record with transaction_id reference.
        
        Args:
            event_id: Event ID
            attendee_key: Attendee key 
            transaction_id: Transaction ID to reference
            
        Returns:
            True if update successful
        """
        try:
            result = await DB.db["events"].update_one(
                {
                    "_id": ObjectId(event_id),
                    "attendees.key": attendee_key
                },
                {
                    "$set": {
                        "attendees.$.transaction_id": transaction_id
                    }
                }
            )
            
            if result.modified_count > 0:
                logging.info(f"Updated attendee {attendee_key} with transaction {transaction_id}")
                return True
            else:
                logging.warning(f"No attendee found to update: {attendee_key}")
                return False
            
        except Exception as e:
            logging.error(f"Error updating attendee transaction reference: {e}")
            return False
