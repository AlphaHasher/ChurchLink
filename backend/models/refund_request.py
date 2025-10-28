from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from mongo.database import DB
from bson import ObjectId
from pymongo import ReturnDocument
import logging
import traceback
from helpers.MongoHelper import generate_unique_id
from .transaction import RefundStatus, PaymentStatus

# Note: RefundRequestStatus is deprecated - use RefundStatus directly

class RefundRequest(BaseModel):
    id: Optional[str] = None
    request_id: str = Field(..., description="Unique refund request identifier")
    
    # Event and registration details
    event_id: str = Field(..., description="ID of the event")
    event_name: Optional[str] = Field(None, description="Name of the event for reference")
    user_uid: str = Field(..., description="Firebase UID of the user requesting refund")
    person_id: Optional[str] = Field(None, description="ID of the person (null for self)")
    display_name: str = Field(..., description="Display name of the person requesting refund")
    
    # Payment details
    transaction_id: Optional[str] = Field(None, description="Original PayPal transaction ID")
    payment_amount: float = Field(..., description="Amount to be refunded")
    original_amount: Optional[float] = Field(None, description="Original payment amount for reference")
    refund_type: str = Field(default="full", description="Type of refund: 'full', 'partial', 'per_person'")
    requested_amount: Optional[float] = Field(None, description="Specific amount requested for partial refunds")
    maximum_refundable: Optional[float] = Field(None, description="Maximum amount that can be refunded")
    payment_method: str = Field(default="paypal", description="Original payment method")
    
    # Request details
    reason: str = Field(..., description="Reason for refund request")
    user_notes: Optional[str] = Field(None, description="Additional notes from user")
    status: str = Field(default=RefundStatus.PENDING, description="Current status of refund request")
    
    # Admin processing
    admin_notes: Optional[str] = Field(None, description="Admin notes during processing")
    processed_by: Optional[str] = Field(None, description="Admin UID who processed the request")
    processed_at: Optional[datetime] = Field(None, description="When the request was processed")
    
    # PayPal refund details
    paypal_refund_id: Optional[str] = Field(None, description="PayPal refund transaction ID")
    paypal_refund_status: Optional[str] = Field(None, description="PayPal refund status")
    
    # Manual refund completion
    manual_refund_method: Optional[str] = Field(None, description="Method used for manual refund completion")
    manual_refund_proof_image_id: Optional[str] = Field(None, description="Asset ID of proof photo for manual refund")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Additional metadata
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional request metadata")
    
    def get_proof_image_id(self) -> Optional[str]:
        """Get the proof image ID for asset lookup"""
        return self.manual_refund_proof_image_id

class RefundRequestCreate(BaseModel):
    event_id: str
    person_id: Optional[str] = None
    display_name: str
    reason: str
    user_notes: Optional[str] = None
    refund_type: str = Field(default="full", description="Type of refund: 'full', 'partial', 'per_person'")
    requested_amount: Optional[float] = Field(None, description="Specific amount for partial refunds")

class RefundRequestUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    payment_amount: Optional[float] = None  # For updating to partial refund amount
    original_amount: Optional[float] = None  # Store original amount for reference
    refund_type: Optional[str] = None  # Update refund type (full/partial)
    paypal_refund_id: Optional[str] = None
    paypal_refund_status: Optional[str] = None
    processed_by: Optional[str] = None
    manual_refund_method: Optional[str] = None
    manual_refund_proof_image_id: Optional[str] = None

class RefundRequestOut(RefundRequest):
    proof_url: Optional[str] = Field(None, description="Public URL for proof image if available")

# CRUD Operations
async def create_refund_request(request_data: RefundRequestCreate, user_uid: str) -> Optional[RefundRequest]:
    """Create a new refund request"""
    try:
        
        # Generate unique request ID
        request_id = generate_unique_id("RFD")
        
        # Get event and transaction details
        event = await DB.db["events"].find_one({"_id": ObjectId(request_data.event_id)})
        if not event:
            logging.error(f"Event not found: {request_data.event_id}")
            return None
        
        # Try multiple queries to find the transaction - be more flexible
        # Check both uppercase and lowercase status values since actual data uses uppercase
        # Build event_id filter to tolerate either string or ObjectId storage for event_id in transactions
        try:
            event_obj_id = ObjectId(request_data.event_id)
            event_id_filter = {"$in": [request_data.event_id, event_obj_id]}
        except Exception:
            event_id_filter = request_data.event_id

        transaction_query = {
            "event_id": event_id_filter,
            "user_uid": user_uid,
            "payment_type": "event_registration",
            "status": PaymentStatus.COMPLETED  # Only completed transactions, not refunded ones
        }

        # For family members, find the specific transaction using the attendee record
        if request_data.person_id:
            # Get the event to find the attendee record with the correct transaction_id
            event = await DB.db["events"].find_one({"_id": ObjectId(request_data.event_id)})
            if not event:
                logging.error(f"Event not found: {request_data.event_id}")
                return None
            
            # Find the specific attendee record that matches this person_id
            attendee = None
            attendees = event.get("attendees", [])
            for att in attendees:
                if (att.get("user_uid") == user_uid and 
                    str(att.get("person_id", "")) == str(request_data.person_id)):
                    attendee = att
                    break
            
            if not attendee:
                logging.error(f"No attendee record found for user {user_uid}, person_id {request_data.person_id}")
                return None
            
            # Use the transaction_id from the attendee record
            attendee_transaction_id = attendee.get("transaction_id")
            if not attendee_transaction_id:
                logging.error(f"No transaction_id found in attendee record for person_id {request_data.person_id}")
                return None
            
            # Get the specific transaction
            transaction = await DB.db["transactions"].find_one({
                "transaction_id": attendee_transaction_id,
                "status": PaymentStatus.COMPLETED
            })
            
            if not transaction:
                logging.error(f"Transaction {attendee_transaction_id} not found or not completed")
                return None
                
            logging.info(f"Found transaction {attendee_transaction_id} for person_id {request_data.person_id}")
        else:
            # For user registration (no person_id), find the main transaction
            logging.info(f"Looking up main transaction with query: {transaction_query}")
            transaction = await DB.db["transactions"].find_one(transaction_query)

        if not transaction:
            logging.error(f"No completed transaction found for event {request_data.event_id}, user {user_uid}, person_id {request_data.person_id}")
            return None
        
        
        
        # Calculate refund amount based on refund type
        total_transaction_amount = transaction.get("amount", 0.0)
        per_person_amount = total_transaction_amount
        requested_refund_amount = request_data.requested_amount
        maximum_refundable = total_transaction_amount
        
        # Check if this is a bulk registration
        metadata = transaction.get("metadata", {})
        if metadata.get("bulk_registration", False):
            # Use registration_count from metadata if available
            registration_count = metadata.get("registration_count")
            if registration_count and registration_count > 0:
                per_person_amount = total_transaction_amount / registration_count
                maximum_refundable = per_person_amount  # For bulk, max is per-person amount
                logging.info(f"Bulk registration detected. Total: ${total_transaction_amount}, Count: {registration_count}, Per person: ${per_person_amount}")
            else:
                # Fallback: count attendees for this user in the event
                try:
                    user_attendees = []
                    if event:
                        attendees = event.get("attendees", [])
                        user_attendees = [att for att in attendees if att.get("user_uid") == user_uid]
                    
                    if len(user_attendees) > 0:
                        per_person_amount = total_transaction_amount / len(user_attendees)
                        maximum_refundable = per_person_amount
                        logging.info(f"Using attendee count fallback. Total: ${total_transaction_amount}, Attendees: {len(user_attendees)}, Per person: ${per_person_amount}")
                except Exception as e:
                    logging.error(f"Failed to calculate per-person amount using attendee count: {e}")
                    # Use event price as final fallback
                    per_person_amount = event.get("price", total_transaction_amount)
                    maximum_refundable = per_person_amount
                    logging.info(f"Using event price as fallback: ${per_person_amount}")

        # Calculate actual refund amount based on refund type
        final_refund_amount = per_person_amount  # Default to per-person amount
        
        if request_data.refund_type == "partial" and requested_refund_amount is not None:
            # Validate partial refund amount
            if requested_refund_amount <= 0:
                logging.error(f"Invalid partial refund amount: ${requested_refund_amount}")
                return None
            if requested_refund_amount > maximum_refundable:
                logging.error(f"Partial refund amount (${requested_refund_amount}) exceeds maximum refundable (${maximum_refundable})")
                return None
            final_refund_amount = requested_refund_amount
            logging.info(f"Partial refund requested: ${requested_refund_amount} (max: ${maximum_refundable})")
        elif request_data.refund_type == "full":
            # For full refunds, refund the entire transaction or per-person amount
            final_refund_amount = per_person_amount if metadata.get("bulk_registration", False) else total_transaction_amount
            logging.info(f"Full refund requested: ${final_refund_amount}")
        elif request_data.refund_type == "per_person":
            # Standard per-person refund (default behavior)
            final_refund_amount = per_person_amount
            logging.info(f"Per-person refund requested: ${final_refund_amount}")

        # Validation: Check if refunds would exceed appropriate limits
        transaction_type = transaction.get("type", "")
        
        if metadata.get("bulk_registration", False) and transaction_type != "bulk_child":
            # For legacy bulk registrations (not parent-child system), check total refunds for the entire transaction (all users)
            logging.info(f"Bulk registration validation: checking transaction {transaction.get('transaction_id')}")
            existing_refunds = await DB.db["refund_requests"].find({
                "transaction_id": transaction.get("transaction_id"),
                "status": {"$nin": [RefundStatus.REJECTED, RefundStatus.CANCELLED]}
            }).to_list(length=None)
            
            total_existing_refund_amount = sum(refund.get("payment_amount", 0) for refund in existing_refunds)
            logging.info(f"Transaction {transaction.get('transaction_id')}: Found {len(existing_refunds)} existing refunds totaling ${total_existing_refund_amount}")
            
            if total_existing_refund_amount + final_refund_amount > total_transaction_amount:
                logging.error(f"Refund validation failed for transaction {transaction.get('transaction_id')}: Total refunds (${total_existing_refund_amount} + ${final_refund_amount} = ${total_existing_refund_amount + final_refund_amount}) would exceed transaction amount (${total_transaction_amount})")
                return None
        else:
            # For individual registrations OR parent-child system (bulk_child), validate per-transaction
            # Each child transaction in parent-child system represents one person and should be validated independently
            logging.info(f"Individual transaction validation: checking transaction {transaction.get('transaction_id')} (type: {transaction_type})")
            existing_refunds = await DB.db["refund_requests"].find({
                "transaction_id": transaction.get("transaction_id"),
                "status": {"$nin": [RefundStatus.REJECTED, RefundStatus.CANCELLED]}
            }).to_list(length=None)
            
            total_existing_refund_amount = sum(refund.get("payment_amount", 0) for refund in existing_refunds)
            logging.info(f"Transaction {transaction.get('transaction_id')}: Found {len(existing_refunds)} existing refunds totaling ${total_existing_refund_amount}")
            
            if total_existing_refund_amount + final_refund_amount > total_transaction_amount:
                logging.error(f"Refund validation failed for transaction {transaction.get('transaction_id')}: Refunds (${total_existing_refund_amount} + ${final_refund_amount} = ${total_existing_refund_amount + final_refund_amount}) would exceed transaction amount (${total_transaction_amount})")
                return None
        
        # Check for duplicate refund requests for the same person
        if request_data.person_id:
            # Check by person_id if provided
            duplicate_refund = await DB.db["refund_requests"].find_one({
                "transaction_id": transaction.get("transaction_id"),
                "user_uid": user_uid,
                "person_id": request_data.person_id,
                "status": {"$nin": [RefundStatus.REJECTED, RefundStatus.CANCELLED, RefundStatus.COMPLETED]}
            })
            if duplicate_refund:
                logging.error(f"Duplicate refund request: User {user_uid} already has a pending/approved refund for person {request_data.person_id}")
                return None
        else:
            # If no person_id, check by display_name and user_uid to prevent duplicates
            duplicate_refund = await DB.db["refund_requests"].find_one({
                "transaction_id": transaction.get("transaction_id"),
                "user_uid": user_uid,
                "display_name": request_data.display_name,
                "person_id": None,  # Ensure we're matching records without person_id
                "status": {"$nin": [RefundStatus.REJECTED, RefundStatus.CANCELLED, RefundStatus.COMPLETED]}
            })
            if duplicate_refund:
                logging.error(f"Duplicate refund request: User {user_uid} already has a pending/approved refund for display_name '{request_data.display_name}'")
                return None

        # Create refund request document
        refund_doc = {
            "request_id": request_id,
            "event_id": request_data.event_id,
            "event_name": event.get("name"),
            "user_uid": user_uid,
            "person_id": request_data.person_id,
            "display_name": request_data.display_name,
            "transaction_id": transaction.get("transaction_id"),
            "payment_amount": final_refund_amount,
            "original_amount": total_transaction_amount,
            "refund_type": request_data.refund_type,
            "requested_amount": requested_refund_amount,
            "maximum_refundable": maximum_refundable,
            "payment_method": transaction.get("payment_method", "paypal"),
            "reason": request_data.reason,
            "user_notes": request_data.user_notes,
            "status": RefundStatus.PENDING,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "metadata": {
                "per_person_amount": per_person_amount,
                "is_bulk_registration": metadata.get("bulk_registration", False),
                "registration_count": metadata.get("registration_count", 1)
            }
        }
        
        # Atomically reserve refunded amount on the transaction to prevent races
        try:
            transactions_col = DB.db["transactions"]
            atomic_filter = {
                "transaction_id": transaction.get("transaction_id"),
                "$expr": {
                    "$lte": [
                        {"$add": [{"$ifNull": ["$refunded_amount", 0]}, final_refund_amount]},
                        total_transaction_amount
                    ]
                }
            }

            updated_tx = await transactions_col.find_one_and_update(
                atomic_filter,
                {"$inc": {"refunded_amount": final_refund_amount}},
                return_document=ReturnDocument.AFTER
            )
            if not updated_tx:
                logging.error(f"Atomic reservation failed: refund of ${final_refund_amount} would exceed transaction {transaction.get('transaction_id')} amount ${total_transaction_amount}")
                return None
        except Exception as e:
            logging.error(f"Error reserving refunded_amount atomically: {e}")
            return None

        # Insert into database
        try:
            result = await DB.db["refund_requests"].insert_one(refund_doc)
        except Exception as e:
            logging.error(f"Failed to insert refund request after reserving refunded_amount: {e}")
            # Attempt to rollback the refunded_amount reservation
            try:
                await transactions_col.update_one(
                    {"transaction_id": transaction.get("transaction_id")},
                    {"$inc": {"refunded_amount": -final_refund_amount}}
                )
                logging.info(f"Rolled back refunded_amount for transaction {transaction.get('transaction_id')}")
            except Exception as e2:
                logging.error(f"Failed to rollback refunded_amount for transaction {transaction.get('transaction_id')}: {e2}")
            return None

        if result.inserted_id:
            # Get the created document
            created_doc = await DB.db["refund_requests"].find_one({"_id": result.inserted_id})
            if created_doc:
                created_doc["id"] = str(created_doc.pop("_id"))
                # After successfully creating a refund request, update the event attendee's payment_status
                try:
                    event_doc = await DB.db["events"].find_one({"_id": ObjectId(request_data.event_id)})
                    if event_doc:
                        attendees = event_doc.get("attendees", []) or []
                        modified = False
                        # Normalize person_id comparison: stored values may be ObjectId or string or None
                        target_person_id = request_data.person_id

                        for attendee in attendees:
                            # Match by user_uid first
                            if attendee.get("user_uid") != user_uid:
                                continue

                            att_pid = attendee.get("person_id")
                            att_pid_str = None
                            if att_pid is None:
                                att_pid_str = None
                            else:
                                try:
                                    att_pid_str = str(att_pid)
                                except Exception:
                                    att_pid_str = None

                            # If request specified a person_id, match it; otherwise match attendee with no person_id (self)
                            if target_person_id:
                                if att_pid_str == target_person_id:
                                    attendee["payment_status"] = "refund_requested"
                                    modified = True
                                    break
                            else:
                                # person_id not specified -> update the attendee record that represents the user themself
                                if not att_pid_str:
                                    attendee["payment_status"] = "refund_requested"
                                    modified = True
                                    break

                        if modified:
                            await DB.db["events"].update_one(
                                {"_id": ObjectId(request_data.event_id)},
                                {"$set": {"attendees": attendees}}
                            )
                            logging.info(f"Updated event {request_data.event_id} attendee payment_status to 'refund_requested' for user {user_uid}")
                except Exception as e:
                    logging.error(f"Failed to update attendee payment_status after creating refund request: {e}")

                return RefundRequest(**created_doc)
        
        return None
    except Exception as e:
        logging.error(f"Error creating refund request: {e}")
        logging.error(f"Exception details: {str(e)}")
        
        logging.error(f"Traceback: {traceback.format_exc()}")
        return None

async def get_refund_request_by_id(request_id: str) -> Optional[RefundRequest]:
    """Get refund request by ID"""
    try:
        doc = await DB.db["refund_requests"].find_one({"request_id": request_id})
        if doc:
            doc["id"] = str(doc.pop("_id"))
            return RefundRequest(**doc)
        return None
    except Exception as e:
        logging.error(f"Error getting refund request {request_id}: {e}")
        return None

async def get_refund_requests_by_user(user_uid: str) -> List[RefundRequest]:
    """Get all refund requests for a user"""
    try:
        cursor = DB.db["refund_requests"].find({"user_uid": user_uid}).sort("created_at", -1)
        requests = []
        async for doc in cursor:
            doc["id"] = str(doc.pop("_id"))
            requests.append(RefundRequest(**doc))
        return requests
    except Exception as e:
        logging.error(f"Error getting refund requests for user {user_uid}: {e}")
        return []

async def get_refund_requests_by_event(event_id: str) -> List[RefundRequest]:
    """Get all refund requests for an event"""
    try:
        cursor = DB.db["refund_requests"].find({"event_id": event_id}).sort("created_at", -1)
        requests = []
        async for doc in cursor:
            doc["id"] = str(doc.pop("_id"))
            
            # Populate event name if missing
            if not doc.get("event_name"):
                try:
                    event = await DB.db["events"].find_one({"_id": ObjectId(event_id)})
                    if event and event.get("name"):
                        doc["event_name"] = event["name"]
                        # Also update the database for future queries
                        await DB.db["refund_requests"].update_one(
                            {"request_id": doc["request_id"]},
                            {"$set": {"event_name": event["name"]}}
                        )
                except Exception as e:
                    logging.error(f"Failed to populate event name for request {doc.get('request_id')}: {e}")
                    doc["event_name"] = "Unknown Event"
                    
            requests.append(RefundRequest(**doc))
        return requests
    except Exception as e:
        logging.error(f"Error getting refund requests for event {event_id}: {e}")
        return []

async def update_refund_request(request_id: str, updates: RefundRequestUpdate) -> bool:
    """Update a refund request"""
    try:
        update_data = updates.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        # If status is being updated to processed states, add processed timestamp
        if "status" in update_data and update_data["status"] in [
            RefundStatus.APPROVED, 
            RefundStatus.REJECTED, 
            RefundStatus.COMPLETED
        ]:
            update_data["processed_at"] = datetime.utcnow()
        
        # Handle rollback of refunded_amount for rejected/cancelled requests
        if "status" in update_data and update_data["status"] in [RefundStatus.REJECTED, RefundStatus.CANCELLED]:
            try:
                # Get the refund request to get transaction details
                refund_request = await DB.db["refund_requests"].find_one({"request_id": request_id})
                if refund_request:
                    transaction_id = refund_request.get("transaction_id")
                    payment_amount = refund_request.get("payment_amount", 0)
                    
                    if transaction_id and payment_amount > 0:
                        # Rollback the refunded_amount reservation
                        await DB.db["transactions"].update_one(
                            {"transaction_id": transaction_id},
                            {"$inc": {"refunded_amount": -payment_amount}}
                        )
                        logging.info(f"Rolled back refunded_amount (-${payment_amount}) for rejected/cancelled refund {request_id}, transaction {transaction_id}")
                        
            except Exception as e:
                logging.error(f"Failed to rollback refunded_amount for refund {request_id}: {e}")
                # Continue with the status update even if rollback fails
        
        result = await DB.db["refund_requests"].update_one(
            {"request_id": request_id},
            {"$set": update_data}
        )
        return result.modified_count > 0
    except Exception as e:
        logging.error(f"Error updating refund request {request_id}: {e}")
        return False

async def list_all_refund_requests(
    skip: int = 0, 
    limit: int = 20, 
    status: Optional[str] = None,
    event_id: Optional[str] = None
) -> List[RefundRequest]:
    """List refund requests with pagination and filtering"""
    try:
        query = {}
        if status:
            query["status"] = status
        if event_id:
            query["event_id"] = event_id
        
        cursor = DB.db["refund_requests"].find(query).sort("created_at", -1).skip(skip).limit(limit)
        requests = []
        async for doc in cursor:
            doc["id"] = str(doc.pop("_id"))
            
            # Populate event name if missing
            if not doc.get("event_name"):
                try:
                    event = await DB.db["events"].find_one({"_id": ObjectId(doc["event_id"])})
                    if event and event.get("name"):
                        doc["event_name"] = event["name"]
                        # Also update the database for future queries
                        await DB.db["refund_requests"].update_one(
                            {"request_id": doc["request_id"]},
                            {"$set": {"event_name": event["name"]}}
                        )
                except Exception as e:
                    logging.error(f"Failed to populate event name for request {doc.get('request_id')}: {e}")
                    doc["event_name"] = "Unknown Event"
            
            requests.append(RefundRequest(**doc))
        return requests
    except Exception as e:
        logging.error(f"Error listing refund requests: {e}")
        return []

async def populate_missing_event_names():
    """Populate event names for existing refund requests that don't have them"""
    try:
        # Find refund requests without event names
        requests_cursor = DB.db["refund_requests"].find({
            "$or": [
                {"event_name": {"$exists": False}},
                {"event_name": None},
                {"event_name": ""}
            ]
        })
        
        updated_count = 0
        requests_list = await requests_cursor.to_list(length=None)
        
        for request_doc in requests_list:
            try:
                # Get event details
                event = await DB.db["events"].find_one({"_id": ObjectId(request_doc["event_id"])})
                if event and event.get("name"):
                    # Update the refund request with event name
                    await DB.db["refund_requests"].update_one(
                        {"_id": request_doc["_id"]},
                        {"$set": {"event_name": event["name"]}}
                    )
                    updated_count += 1
                    logging.info(f"Updated refund request {request_doc.get('request_id')} with event name: {event['name']}")
                else:
                    # Event not found or has no name
                    await DB.db["refund_requests"].update_one(
                        {"_id": request_doc["_id"]},
                        {"$set": {"event_name": "Unknown Event"}}
                    )
                    updated_count += 1
                    logging.warning(f"Event not found for refund request {request_doc.get('request_id')}, set to 'Unknown Event'")
            except Exception as e:
                logging.error(f"Failed to update event name for refund request {request_doc.get('request_id')}: {e}")
        
        logging.info(f"Populated event names for {updated_count} refund requests")
        return updated_count
    except Exception as e:
        logging.error(f"Error populating missing event names: {e}")
        return 0

# Partial Refund Helper Functions
async def calculate_refund_options(transaction_id: str, user_uid: str) -> Dict[str, Any]:
    """Calculate available refund options for a transaction"""
    try:
        # Get transaction details
        transaction = await DB.db["transactions"].find_one({"transaction_id": transaction_id})
        if not transaction:
            return {"error": "Transaction not found"}
        
        total_amount = transaction.get("amount", 0.0)
        metadata = transaction.get("metadata", {})
        is_bulk = metadata.get("bulk_registration", False)
        registration_count = metadata.get("registration_count", 1)
        
        # Calculate per-person amount
        per_person_amount = total_amount / registration_count if is_bulk else total_amount
        
        # Get existing refunds
        existing_refunds = await DB.db["refund_requests"].find({
            "transaction_id": transaction_id,
            "user_uid": user_uid,
            "status": {"$nin": [RefundStatus.REJECTED, RefundStatus.CANCELLED]}
        }).to_list(length=None)
        
        total_refunded = sum(refund.get("payment_amount", 0) for refund in existing_refunds)
        remaining_amount = total_amount - total_refunded
        remaining_per_person = per_person_amount if total_refunded == 0 else max(0, per_person_amount - total_refunded)
        
        return {
            "transaction_id": transaction_id,
            "original_amount": total_amount,
            "per_person_amount": per_person_amount,
            "is_bulk_registration": is_bulk,
            "registration_count": registration_count,
            "total_refunded": total_refunded,
            "remaining_amount": remaining_amount,
            "remaining_per_person": remaining_per_person,
            "can_refund_full": remaining_amount > 0,
            "can_refund_partial": remaining_amount > 0,
            "can_refund_per_person": remaining_per_person > 0,
            "existing_refunds": len(existing_refunds),
            "refund_options": {
                "full": {
                    "amount": remaining_amount,
                    "description": f"Full remaining amount (${remaining_amount:.2f})",
                    "available": remaining_amount > 0
                },
                "per_person": {
                    "amount": remaining_per_person,
                    "description": f"Per-person amount (${remaining_per_person:.2f})",
                    "available": remaining_per_person > 0
                },
                "partial": {
                    "min_amount": 0.01,
                    "max_amount": remaining_amount,
                    "description": f"Custom amount (up to ${remaining_amount:.2f})",
                    "available": remaining_amount > 0
                }
            }
        }
    except Exception as e:
        logging.error(f"Error calculating refund options: {e}")
        return {"error": str(e)}

async def validate_refund_amount(transaction_id: str, user_uid: str, requested_amount: float, refund_type: str) -> Dict[str, Any]:
    """Validate if a refund amount is allowed"""
    try:
        refund_options = await calculate_refund_options(transaction_id, user_uid)
        if "error" in refund_options:
            return refund_options
        
        # Check if refund type is valid
        if refund_type not in ["full", "partial", "per_person"]:
            return {"error": "Invalid refund type", "valid_types": ["full", "partial", "per_person"]}
        
        # Validate amount based on refund type
        if refund_type == "full":
            if requested_amount != refund_options["remaining_amount"]:
                return {
                    "error": "Full refund amount mismatch",
                    "expected": refund_options["remaining_amount"],
                    "provided": requested_amount
                }
        elif refund_type == "per_person":
            if requested_amount != refund_options["remaining_per_person"]:
                return {
                    "error": "Per-person refund amount mismatch",
                    "expected": refund_options["remaining_per_person"], 
                    "provided": requested_amount
                }
        elif refund_type == "partial":
            min_amount = 0.01
            max_amount = refund_options["remaining_amount"]
            if requested_amount < min_amount or requested_amount > max_amount:
                return {
                    "error": "Partial refund amount out of range",
                    "min_amount": min_amount,
                    "max_amount": max_amount,
                    "provided": requested_amount
                }
        
        return {
            "valid": True,
            "refund_type": refund_type,
            "amount": requested_amount,
            "refund_options": refund_options
        }
    except Exception as e:
        logging.error(f"Error validating refund amount: {e}")
        return {"error": str(e)}

async def get_refund_summary(transaction_id: str) -> Dict[str, Any]:
    """Get a summary of all refunds for a transaction"""
    try:
        # Get transaction
        transaction = await DB.db["transactions"].find_one({"transaction_id": transaction_id})
        if not transaction:
            return {"error": "Transaction not found"}
        
        # Get all refunds for this transaction
        refunds = await DB.db["refund_requests"].find({
            "transaction_id": transaction_id
        }).to_list(length=None)
        
        # Categorize refunds by status
        refund_summary = {
            "transaction_amount": transaction.get("amount", 0.0),
            "total_refunds": len(refunds),
            "refunds_by_status": {},
            "total_refunded": 0.0,
            "pending_refunds": 0.0,
            "refund_details": []
        }
        
        for refund in refunds:
            status = refund.get("status", "unknown")
            amount = refund.get("payment_amount", 0.0)
            
            if status not in refund_summary["refunds_by_status"]:
                refund_summary["refunds_by_status"][status] = {"count": 0, "amount": 0.0}
            
            refund_summary["refunds_by_status"][status]["count"] += 1
            refund_summary["refunds_by_status"][status]["amount"] += amount
            
            if status in [RefundStatus.COMPLETED]:
                refund_summary["total_refunded"] += amount
            elif status in [RefundStatus.PENDING, RefundStatus.APPROVED, RefundStatus.PROCESSING]:
                refund_summary["pending_refunds"] += amount
            
            refund_summary["refund_details"].append({
                "request_id": refund.get("request_id"),
                "amount": amount,
                "status": status,
                "refund_type": refund.get("refund_type", "per_person"),
                "created_at": refund.get("created_at"),
                "user_uid": refund.get("user_uid"),
                "display_name": refund.get("display_name")
            })
        
        refund_summary["remaining_amount"] = refund_summary["transaction_amount"] - refund_summary["total_refunded"] - refund_summary["pending_refunds"]
        
        return refund_summary
    except Exception as e:
        logging.error(f"Error getting refund summary: {e}")
        return {"error": str(e)}
        return 0