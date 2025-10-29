"""
Transaction Management for Event Registrations

This module handles the creation and management of transactions for event 
registrations. It creates individual transaction records for each attendee 
with parent-child relationships for bulk payments, supporting proper refund handling.

Single registrations are treated as bulk registrations with 1 person.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel
from datetime import datetime
import logging
import uuid
from bson import ObjectId
from mongo.database import DB
from models.transaction import Transaction, PaymentStatus, RegistrationPaymentStatus
from helpers.MongoHelper import serialize_objectid


class TransactionManager:
    """Manages transactions for event registrations (single and bulk)"""
    
    @staticmethod
    async def create_transaction_structure(
        parent_transaction_id: str,
        attendee_registrations: List[Dict],
        total_amount: float,
        per_person_amount: float,
        user_email: str,
        event_id: str,
        event_name: str,
        payment_method: str = "paypal"
    ) -> Dict[str, Any]:
        """
        Create a parent transaction and individual child transactions for each attendee.
        Works for both single and bulk registrations.
        
        Args:
            parent_transaction_id: The original PayPal transaction ID
            attendee_registrations: List of attendee data with keys and names
            total_amount: Total amount paid to PayPal
            per_person_amount: Amount per person (total_amount / number of people)
            user_email: Email of the person who made the payment
            event_id: Event ID
            event_name: Event name
            payment_method: Payment method (default: paypal)
            
        Returns:
            Dict with parent transaction and list of child transactions
        """
        try:
            child_transaction_ids = []
            child_transactions = []
            
            # Determine transaction types
            is_single_registration = len(attendee_registrations) == 1
            child_type = "single_child" if is_single_registration else "bulk_child"
            parent_type = "single_parent" if is_single_registration else "bulk_parent"
            
            # Create child transactions for each attendee
            for i, attendee in enumerate(attendee_registrations):
                child_transaction_id = f"{parent_transaction_id}-CHILD-{i+1}"
                child_transaction_ids.append(child_transaction_id)
                
                # Create child transaction
                child_transaction = Transaction(
                    transaction_id=child_transaction_id,
                    user_email=user_email,
                    amount=per_person_amount,
                    status=PaymentStatus.COMPLETED,
                    type=child_type,
                    parent_transaction_id=parent_transaction_id,
                    payment_method=payment_method,
                    event_id=event_id,
                    event_name=event_name,
                    registration_key=attendee.get("key"),
                    payment_type="event_registration",
                    user_uid=attendee.get("user_uid"),
                    metadata={
                        "attendee_name": attendee.get("display_name"),
                        "attendee_key": attendee.get("key"),
                        "registration_position": i + 1,
                        "total_attendees": len(attendee_registrations),
                        "is_single_registration": is_single_registration
                    },
                    created_on=datetime.now().isoformat()
                )
                
                # Save child transaction with duplicate checking
                try:
                    # Check if child transaction already exists
                    existing_child = await Transaction.get_transaction_by_id(child_transaction_id)
                    if existing_child:
                        child_transactions.append(existing_child)
                        logging.info(f"✅ Child transaction {child_transaction_id} already exists for {attendee.get('display_name')}")
                    else:
                        saved_child = await Transaction.create_transaction(child_transaction)
                        if saved_child:
                            child_transactions.append(saved_child)
                            logging.info(f"✅ Created child transaction {child_transaction_id} for {attendee.get('display_name')}")
                        else:
                            # Check if it was created by another process
                            double_check = await Transaction.get_transaction_by_id(child_transaction_id)
                            if double_check:
                                child_transactions.append(double_check)
                                logging.warning(f"⚠️ Child transaction {child_transaction_id} created by concurrent process")
                            else:
                                logging.error(f"❌ Failed to create child transaction for {attendee.get('display_name')}")
                                raise Exception(f"Failed to create child transaction {child_transaction_id}")
                except Exception as child_error:
                    logging.error(f"❌ Error creating child transaction {child_transaction_id}: {str(child_error)}")
                    raise Exception(f"Failed to create child transaction {child_transaction_id}: {str(child_error)}")
            
            # Check if parent transaction already exists (duplicate payment attempts)
            existing_parent = await Transaction.get_transaction_by_id(parent_transaction_id)
            if existing_parent:
                logging.info(f"Parent transaction {parent_transaction_id} already exists - returning existing structure")
                
                # Get existing child transactions
                existing_children = []
                for child_id in child_transaction_ids:
                    child_tx = await Transaction.get_transaction_by_id(child_id)
                    if child_tx:
                        existing_children.append(child_tx)
                
                if len(existing_children) == len(attendee_registrations):
                    # All transactions already exist - return the existing structure
                    parent_dict = serialize_objectid(existing_parent.model_dump() if hasattr(existing_parent, 'model_dump') else existing_parent)
                    child_dicts = [serialize_objectid(tx.model_dump() if hasattr(tx, 'model_dump') else tx) for tx in existing_children]
                    
                    return {
                        "success": True,
                        "parent_transaction": parent_dict,
                        "child_transactions": child_dicts,
                        "child_transaction_ids": child_transaction_ids,
                        "message": "Using existing transaction structure"
                    }
                else:
                    logging.warning(f"Parent exists but incomplete child transactions found for {parent_transaction_id}")
            
            # Create parent transaction
            is_single_registration = len(attendee_registrations) == 1
            parent_type = "single_parent" if is_single_registration else "bulk_parent"
            
            parent_transaction = Transaction(
                transaction_id=parent_transaction_id,
                user_email=user_email,
                amount=total_amount,
                status=PaymentStatus.COMPLETED,
                type=parent_type,
                payment_method=payment_method,
                event_id=event_id,
                event_name=event_name,
                payment_type="event_registration",
                metadata={
                    "child_transactions": child_transaction_ids,
                    "total_attendees": len(attendee_registrations),
                    "per_person_amount": per_person_amount,
                    "attendee_names": [a.get("display_name") for a in attendee_registrations],
                    "is_single_registration": is_single_registration
                },
                created_on=datetime.now().isoformat()
            )
            
            # Save parent transaction with better error handling
            try:
                saved_parent = await Transaction.create_transaction(parent_transaction)
                
                if saved_parent:
                    logging.info(f"✅ Created parent transaction {parent_transaction_id} for {len(attendee_registrations)} attendees")
                    
                    # Convert transaction objects to dicts and serialize ObjectIds properly (bulk transaction area only)
                    parent_dict = serialize_objectid(saved_parent.model_dump() if hasattr(saved_parent, 'model_dump') else saved_parent)
                    child_dicts = [serialize_objectid(tx.model_dump() if hasattr(tx, 'model_dump') else tx) for tx in child_transactions]
                    
                    return {
                        "success": True,
                        "parent_transaction": parent_dict,
                        "child_transactions": child_dicts,
                        "child_transaction_ids": child_transaction_ids
                    }
                else:
                    # Check if it was a duplicate key error by trying to fetch the transaction
                    check_existing = await Transaction.get_transaction_by_id(parent_transaction_id)
                    if check_existing:
                        logging.warning(f"⚠️ Parent transaction {parent_transaction_id} was created by another process")
                        return {
                            "success": True,
                            "parent_transaction": serialize_objectid(check_existing.model_dump() if hasattr(check_existing, 'model_dump') else check_existing),
                            "child_transactions": [serialize_objectid(tx.model_dump() if hasattr(tx, 'model_dump') else tx) for tx in child_transactions],
                            "child_transaction_ids": child_transaction_ids,
                            "message": "Parent transaction created by concurrent process"
                        }
                    else:
                        logging.error(f"❌ Failed to create parent transaction {parent_transaction_id} - create_transaction returned None")
                        return {"success": False, "error": "Failed to create parent transaction - database operation failed"}
                        
            except Exception as parent_error:
                logging.error(f"❌ Exception creating parent transaction {parent_transaction_id}: {str(parent_error)}")
                return {"success": False, "error": f"Failed to create parent transaction: {str(parent_error)}"}
                
        except Exception as e:
            logging.error(f"Error creating bulk transaction structure: {e}")
            return {"success": False, "error": str(e)}
    
    @staticmethod
    async def get_transaction_info(parent_transaction_id: str) -> Dict[str, Any]:
        """
        Get complete information about a bulk transaction including all child transactions.
        
        Args:
            parent_transaction_id: The parent transaction ID
            
        Returns:
            Dict with parent and child transaction information
        """
        try:
            # Get parent transaction
            parent_transaction = await Transaction.get_transaction_by_id(parent_transaction_id)
            if not parent_transaction:
                return {"success": False, "error": "Parent transaction not found"}
            
            # Get child transactions
            child_transactions = await DB.find_documents(
                "transactions", 
                {"parent_transaction_id": parent_transaction_id}
            )
            
            # Convert child transactions to Transaction objects and then to serializable dicts (bulk transaction area only)
            child_tx_objects = []
            for tx in child_transactions:
                # Convert ObjectId to string
                tx["id"] = str(tx.pop("_id"))
                # Create Transaction object and serialize ObjectIds
                transaction_obj = Transaction(**tx)
                child_tx_objects.append(serialize_objectid(transaction_obj.model_dump()))
            
            # Convert parent transaction to dict with proper ObjectId handling (bulk transaction area only)
            parent_dict = serialize_objectid(parent_transaction.model_dump() if hasattr(parent_transaction, 'model_dump') else parent_transaction)
            
            return {
                "success": True,
                "parent_transaction": parent_dict,
                "child_transactions": child_tx_objects,
                "total_attendees": len(child_tx_objects),
                "total_amount": parent_transaction.amount,
                "completed_count": len([tx for tx in child_transactions if tx.get("status") == PaymentStatus.COMPLETED]),
                "refunded_count": len([tx for tx in child_transactions if tx.get("status") == PaymentStatus.REFUNDED])
            }
            
        except Exception as e:
            logging.error(f"Error getting bulk transaction info: {e}")
            return {"success": False, "error": str(e)}
    
    @staticmethod
    async def process_partial_refund(
        attendee_key: str,
        event_id: str,
        refund_reason: str = "User requested cancellation"
    ) -> Dict[str, Any]:
        """
        Process a partial refund for one attendee in a bulk transaction.
        
        Args:
            attendee_key: The attendee key for the person requesting refund
            event_id: Event ID
            refund_reason: Reason for the refund
            
        Returns:
            Dict with refund processing results
        """
        try:
            # Find the attendee's child transaction (both single and bulk)
            child_transactions = await DB.find_documents(
                "transactions",
                {
                    "registration_key": attendee_key,
                    "event_id": event_id,
                    "type": {"$in": ["single_child", "bulk_child"]}
                }
            )
            
            if not child_transactions:
                return {"success": False, "error": "Child transaction not found for attendee"}
            
            child_tx_data = child_transactions[0]
            child_tx_data["id"] = str(child_tx_data.pop("_id"))
            child_transaction = Transaction(**child_tx_data)
            
            # Check if already refunded
            if child_transaction.status == PaymentStatus.REFUNDED:
                return {"success": False, "error": "Already refunded"}
            
            # Update child transaction status to refunded
            await Transaction.update_transaction_status(
                child_transaction.transaction_id, 
                PaymentStatus.REFUNDED
            )
            
            # Create a refund transaction record
            refund_transaction_id = f"REFUND-{child_transaction.transaction_id}-{int(datetime.now().timestamp())}"
            refund_transaction = Transaction(
                transaction_id=refund_transaction_id,
                user_email=child_transaction.user_email,
                amount=-child_transaction.amount,  # Negative amount for refund
                status=PaymentStatus.COMPLETED,
                type="refund",
                parent_transaction_id=child_transaction.parent_transaction_id,
                payment_method=child_transaction.payment_method,
                event_id=event_id,
                event_name=child_transaction.event_name,
                registration_key=attendee_key,
                payment_type="event_refund",
                metadata={
                    "refund_reason": refund_reason,
                    "original_transaction_id": child_transaction.transaction_id,
                    "refund_amount": child_transaction.amount,
                    "attendee_key": attendee_key
                },
                created_on=datetime.now().isoformat()
            )
            
            # Save refund transaction
            saved_refund = await Transaction.create_transaction(refund_transaction)
            
            if saved_refund:
                logging.info(f"Processed partial refund for attendee {attendee_key}, amount: ${child_transaction.amount}")
                
                # Convert refund transaction to dict for serialization with ObjectId handling (bulk transaction area only)
                refund_dict = serialize_objectid(saved_refund.model_dump() if hasattr(saved_refund, 'model_dump') else saved_refund)
                
                return {
                    "success": True,
                    "refund_transaction": refund_dict,
                    "refund_amount": child_transaction.amount,
                    "original_transaction_id": child_transaction.transaction_id
                }
            else:
                return {"success": False, "error": "Failed to create refund transaction"}
                
        except Exception as e:
            logging.error(f"Error processing partial refund: {e}")
            return {"success": False, "error": str(e)}
    
    @staticmethod
    async def get_attendee_payment_status_bulk_aware(event_id: str, attendee_key: str) -> str:
        """
        Get payment status for an attendee, handling both single and bulk transactions.
        
        Args:
            event_id: Event ID
            attendee_key: Attendee key
            
        Returns:
            Payment status string
        """
        try:
            # First check for child transaction (single or bulk payment)
            child_transactions = await DB.find_documents(
                "transactions",
                {
                    "registration_key": attendee_key,
                    "event_id": event_id,
                    "type": {"$in": ["single_child", "bulk_child"]}
                }
            )
            
            if child_transactions:
                # This is from a child transaction (single or bulk)
                child_tx_data = child_transactions[0]
                child_tx_data["id"] = str(child_tx_data.pop("_id"))
                child_transaction = Transaction(**child_tx_data)
                
                # Map transaction status to registration status
                if child_transaction.status == PaymentStatus.COMPLETED:
                    return RegistrationPaymentStatus.COMPLETED
                elif child_transaction.status == PaymentStatus.REFUNDED:
                    return RegistrationPaymentStatus.REFUNDED
                else:
                    return RegistrationPaymentStatus.PENDING
            
            # Fall back to the original method for single transactions
            return await Transaction.get_attendee_payment_status(event_id, attendee_key)
            
        except Exception as e:
            logging.error(f"Error getting bulk-aware payment status: {e}")
            return RegistrationPaymentStatus.PENDING