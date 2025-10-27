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
from fastapi import HTTPException

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
            raise HTTPException(
                status_code=404,
                detail="Event not found"
            )
        
        # Check for duplicate refund requests for the same person BEFORE processing
        duplicate_refund_query = {
            "event_id": request_data.event_id,
            "user_uid": user_uid,
            "status": {"$nin": [RefundStatus.REJECTED, RefundStatus.CANCELLED]}
        }
        
        if request_data.person_id is not None:
            # Check by person_id if provided
            duplicate_refund_query["person_id"] = request_data.person_id
        else:
            # If no person_id (self refund), match records where person_id is None or "null"
            duplicate_refund_query["person_id"] = {"$in": [None, "null"]}
        
        logging.info(f"Checking for duplicate refund requests with query: {duplicate_refund_query}")
        duplicate_refund = await DB.db["refund_requests"].find_one(duplicate_refund_query)
        
        if duplicate_refund:
            logging.error(f"EARLY DUPLICATE DETECTION: Found existing refund request")
            logging.error(f"  - Request ID: {duplicate_refund.get('request_id')}")
            logging.error(f"  - Transaction ID: {duplicate_refund.get('transaction_id')}")
            logging.error(f"  - Status: {duplicate_refund.get('status')}")
            logging.error(f"  - Person ID: {duplicate_refund.get('person_id')}")
            logging.error(f"  - Display Name: {duplicate_refund.get('display_name')}")
            
            if request_data.person_id is not None:
                error_msg = f"A refund request has already been submitted for this family member in this event."
                logging.error(f"Duplicate refund request: User {user_uid} already has a pending/approved refund for person {request_data.person_id} in this event")
            else:
                error_msg = f"You have already submitted a refund request for yourself in this event."
                logging.error(f"Duplicate refund request: User {user_uid} already has a pending/approved refund for themselves in this event")
            
            raise HTTPException(
                status_code=409,  # Conflict status code for duplicates
                detail=error_msg
            )
        else:
            logging.info(f"No duplicate refund request found in early check")
        
        # Try multiple queries to find the transaction - be more flexible
        # Check both uppercase and lowercase status values since actual data uses uppercase
        # Build event_id filter to tolerate either string or ObjectId storage for event_id in transactions
        try:
            event_obj_id = ObjectId(request_data.event_id)
            event_id_filter = {"$in": [request_data.event_id, event_obj_id]}
        except Exception:
            event_id_filter = request_data.event_id

        # For the new parent-child transaction system, we need to find the right child transaction
        # Instead of generating attendee_key from potentially wrong person_id, get it from the event attendees
        
        logging.info(f"Looking up attendees for user {user_uid} in event {request_data.event_id}")
        
        # Get all attendees for this user from the event
        event_attendees = event.get("attendees", [])
        user_attendees = [att for att in event_attendees if att.get("user_uid") == user_uid]
        
        logging.info(f"Found {len(user_attendees)} attendees for this user:")
        for i, attendee in enumerate(user_attendees):
            logging.info(f"  {i+1}. Key: {attendee.get('key')}, Name: {attendee.get('display_name')}, Person ID: {attendee.get('person_id')}")
        
        # Strategy 1: If person_id is provided, try to find the specific attendee
        target_attendee_key = None
        if request_data.person_id is not None:
            # Look for attendee with matching person_id
            for attendee in user_attendees:
                if str(attendee.get('person_id', '')) == str(request_data.person_id):
                    target_attendee_key = attendee.get('key')
                    logging.info(f"Found target attendee by person_id: {target_attendee_key}")
                    break
        else:
            # Look for attendee with person_id = None (self registration)
            for attendee in user_attendees:
                if attendee.get('person_id') is None:
                    target_attendee_key = attendee.get('key')
                    logging.info(f"Found self-registration attendee: {target_attendee_key}")
                    break
        
        # Strategy 2: Look for exact match by registration_key (if we found target attendee)
        transaction = None
        if target_attendee_key:
            exact_match_query = {
                "event_id": event_id_filter,
                "user_uid": user_uid,
                "payment_type": "event_registration",
                "status": PaymentStatus.COMPLETED,
                "type": {"$in": ["bulk_child", "single_child"]},
                "registration_key": target_attendee_key
            }
            
            logging.info(f"Looking for exact registration_key match: {target_attendee_key}")
            transaction = await DB.db["transactions"].find_one(exact_match_query)
            
            if transaction:
                logging.info(f"Found exact match: {transaction.get('transaction_id')} with registration_key: {transaction.get('registration_key')}")
                
                # Check if this transaction already has a refund request
                existing_refund_query = {
                    "transaction_id": transaction.get("transaction_id"),
                    "status": {"$nin": [RefundStatus.REJECTED, RefundStatus.CANCELLED]}
                }
                
                existing_refund = await DB.db["refund_requests"].find_one(existing_refund_query)
                if existing_refund:
                    logging.warning(f"Transaction {transaction.get('transaction_id')} already has a refund request. This is a duplicate.")
                    raise HTTPException(
                        status_code=409,
                        detail="A refund request has already been submitted for this registration."
                    )
            else:
                logging.warning(f"No transaction found with registration_key: {target_attendee_key}")
                raise HTTPException(
                    status_code=404,
                    detail="No payment transaction found for this registration. Please contact support."
                )
        else:
            # No target attendee found - this means the person_id doesn't match any attendee
            if request_data.person_id is not None:
                logging.error(f"No attendee found with person_id: {request_data.person_id}")
                raise HTTPException(
                    status_code=404,
                    detail="This person is not registered for this event."
                )
            else:
                logging.error(f"No self-registration attendee found for user")
                raise HTTPException(
                    status_code=404,
                    detail="You are not registered for this event."
                )
        
        if not transaction:
            logging.error(f"No suitable transaction found for refund request")
            raise HTTPException(
                status_code=404,
                detail="No payment transaction found for this registration."
            )

        logging.info(f"Selected transaction: {transaction.get('transaction_id')} for user {user_uid}, person {request_data.person_id}")
        
        
        
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
                "status": {"$nin": [RefundStatus.REJECTED, RefundStatus.CANCELLED]}
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
                "status": {"$nin": [RefundStatus.REJECTED, RefundStatus.CANCELLED]}
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
    """Update a refund request with proper rollback handling"""
    try:
        # Get the current refund request to check for status changes
        current_refund = await get_refund_request_by_id(request_id)
        if not current_refund:
            logging.error(f"Refund request {request_id} not found")
            return False
        
        update_data = updates.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        # Check if status is being changed
        old_status = current_refund.status
        new_status = update_data.get("status", old_status)
        
        # If status is being updated to processed states, add processed timestamp
        if "status" in update_data and update_data["status"] in [
            RefundStatus.APPROVED, 
            RefundStatus.REJECTED, 
            RefundStatus.COMPLETED
        ]:
            update_data["processed_at"] = datetime.utcnow()
        
        # Handle rollback for rejected/cancelled refunds
        if (new_status in [RefundStatus.REJECTED, RefundStatus.CANCELLED] and 
            old_status not in [RefundStatus.REJECTED, RefundStatus.CANCELLED]):
            
            # Rollback the refunded_amount in the transaction
            refund_amount = current_refund.payment_amount
            transaction_id = current_refund.transaction_id
            
            if transaction_id and refund_amount > 0:
                try:
                    rollback_result = await DB.db["transactions"].update_one(
                        {"transaction_id": transaction_id},
                        {"$inc": {"refunded_amount": -refund_amount}}
                    )
                    
                    if rollback_result.modified_count > 0:
                        logging.info(f"Rolled back ${refund_amount} from transaction {transaction_id} for rejected refund {request_id}")
                    else:
                        logging.warning(f"Could not rollback refunded_amount for transaction {transaction_id}")
                        
                except Exception as e:
                    logging.error(f"Error rolling back refunded_amount for rejected refund {request_id}: {e}")
        
        # Update the refund request
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