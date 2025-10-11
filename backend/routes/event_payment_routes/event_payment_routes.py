# Bulk Registration Endpoint for Events with Combined Payment

from typing import List, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Body
from bson import ObjectId
from models.event import get_event_by_id, update_attendee_payment_status
from models.transaction import Transaction
from helpers.paypalHelper import create_order
from controllers.event_functions import register_rsvp
from mongo.database import DB
from config.settings import settings
import json
import os
import traceback
from datetime import datetime
from models.event import get_event_payment_summary, get_event_registrations_by_payment_status
        

# Create router instance
router = APIRouter()

event_payment_router = APIRouter(prefix="/events", tags=["Event Payments"])

class BulkRegistrationRequest:
    def __init__(self, data: Dict[str, Any]):
        self.registrations = data.get("registrations", [])
        self.message = data.get("message", "")
        self.return_url = data.get("return_url", "")
        self.cancel_url = data.get("cancel_url", "")

@event_payment_router.post("/{event_id}/payment/create-bulk-order")
async def create_bulk_event_payment_order(
    event_id: str,
    request: Request,
    bulk_data: Dict[str, Any] = Body(...)
):
    """Create PayPal payment order for multiple event registrations"""
    try:
        print(f"🔍 Creating bulk payment order for event: {event_id}")
        print(f"🔍 Bulk data received: {bulk_data}")
        
        # Parse bulk registration request
        bulk_request = BulkRegistrationRequest(bulk_data)
        registrations = bulk_request.registrations
        
        if not registrations:
            raise HTTPException(status_code=400, detail="No registrations provided")
        
        print(f"🔍 Number of registrations: {len(registrations)}")
        
        # Check PayPal configuration first
        paypal_client_id = os.getenv("PAYPAL_CLIENT_ID")
        paypal_client_secret = os.getenv("PAYPAL_CLIENT_SECRET")
        
        if not paypal_client_id or not paypal_client_secret:
            raise HTTPException(
                status_code=503, 
                detail="PayPal is not configured. Please contact the administrator to set up PayPal credentials."
            )
        
        # Get the event
        event = await get_event_by_id(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        print(f"✅ Event found: {event.name}")
        print(f"🔍 Event details - Price: {event.price}, PayPal option: {event.has_paypal_option()}")
        
        # Check if PayPal is enabled for this event
        if not event.has_paypal_option():
            raise HTTPException(
                status_code=400,
                detail="PayPal payments are not enabled for this event"
            )
        
        # Calculate total payment amount
        total_amount = 0.0
        registration_summary = []
        
        for registration in registrations:
            person_name = registration.get("name", registration.get("person_name", "Unknown"))
            person_id = registration.get("family_member_id", registration.get("person_id"))  # None for self, ID for family members
            donation_amount = registration.get("donation_amount", 0.0)
            
            if event.price and event.price > 0:
                # Paid event - add event price for each person
                total_amount += event.price
                registration_summary.append({
                    "person_name": person_name,
                    "person_id": person_id,
                    "amount": event.price
                })
            elif donation_amount > 0:
                # Free event with donation
                print(f"✅ Free event with donation: ${donation_amount} for {person_name}")
                total_amount += donation_amount
                registration_summary.append({
                    "person_name": person_name,
                    "person_id": person_id,
                    "amount": donation_amount,
                    "type": "donation"
                })
            else:
                # Free event with no donation - this shouldn't trigger payment
                print(f"⚠️ Warning: Free event with no donation in bulk payment request for {person_name}")
        
        if total_amount <= 0:
            raise HTTPException(
                status_code=400,
                detail="No payment required for this event or registrations"
            )
        
        print(f"🔍 Total payment amount: ${total_amount} for {len(registrations)} people")
        
        # Determine if this is payment or donation
        has_paid_registrations = any(reg.get("type") != "donation" for reg in registration_summary)
        has_donations = any(reg.get("type") == "donation" for reg in registration_summary)
        
        # Create description for PayPal
        if len(registrations) == 1:
            reg_type = "payment" if has_paid_registrations else "donation"
            person_name = registrations[0].get('name', registrations[0].get('person_name', 'User'))
            description = f"Event {reg_type} for {event.name} - {person_name}"
        else:
            if has_paid_registrations and has_donations:
                description = f"Event payment and donation for {event.name} - {len(registrations)} people"
            elif has_donations:
                description = f"Event donation for {event.name} - {len(registrations)} people"
            else:
                description = f"Event payment for {event.name} - {len(registrations)} people"
        
        # Prepare return URLs with event ID parameter for mobile deep link support
        return_url = bulk_request.return_url or f"{settings.FRONTEND_URL}/events/{event_id}/payment/success"
        cancel_url = bulk_request.cancel_url or f"{settings.FRONTEND_URL}/events/{event_id}/payment/cancel"
        
        # If mobile deep links are provided, ensure event ID is in the path to avoid conflicts with PayPal parameters
        if return_url.startswith("churchlink://"):
            # Check if eventId is already in the path to avoid duplication
            if not return_url.endswith(f"/{event_id}") and event_id not in return_url.split("://")[1]:
                return_url = f"{return_url}/{event_id}"
        if cancel_url.startswith("churchlink://"):
            # Check if eventId is already in the path to avoid duplication
            if not cancel_url.endswith(f"/{event_id}") and event_id not in cancel_url.split("://")[1]:
                cancel_url = f"{cancel_url}/{event_id}"
        
        # Prepare donation data for PayPal
        donation_data = {
            "fund_name": f"Event: {event.name}",
            "amount": total_amount,
            "message": bulk_request.message or description,
            "return_url": return_url,
            "cancel_url": cancel_url,
            "event_id": event_id,
            "event_name": event.name,
            "payment_type": "bulk_event_registration",
            "registration_count": len(registrations),
            "registrations": registration_summary
        }
        
        print(f"🔍 Donation data prepared: {donation_data}")
        
        # Create the PayPal order using existing helper
        class MockRequest:
            def __init__(self, data):
                self.data = data
            
            async def json(self):
                return self.data
        
        mock_request = MockRequest({"donation": donation_data})
        
        print("🔍 Calling create_order helper function")
        result = await create_order(mock_request)
        print(f"🔍 PayPal helper result type: {type(result)}")
        
        if hasattr(result, 'status_code') and result.status_code != 200:
            print(f"❌ PayPal helper returned error status: {result.status_code}")
            raise HTTPException(status_code=500, detail="Failed to create PayPal order")
        
        print("✅ Bulk PayPal order created successfully")
        return result
        
    except HTTPException as he:
        print(f"❌ HTTP Exception: {he.detail}")
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to create bulk payment order: {str(e)}")

@event_payment_router.post("/{event_id}/payment/complete-bulk-registration")
async def complete_bulk_event_registration(
    event_id: str,
    request: Request,
    completion_data: Dict[str, Any] = Body(...)
):
    """Complete bulk event registration after successful payment"""
    try:
        print(f"🔍 Completing bulk registration for event: {event_id}")
        print(f"🔍 Completion data received: {completion_data}")
        
        registrations = completion_data.get("registrations", [])
        payment_id = completion_data.get("payment_id", "")
        payer_id = completion_data.get("payer_id", "")
        total_amount = completion_data.get("total_amount", 0.0)
        payer_email = completion_data.get("payer_email", "")
        payer_name = completion_data.get("payer_name", "")
        user_uid = completion_data.get("user_uid")  # Try to get from completion data
        
        # If user_uid not in completion data, try to get from request.state
        if not user_uid:
            try:
                user_uid = request.state.uid
                print(f"🔍 Got user_uid from request.state: {user_uid}")
            except AttributeError:
                print(f"⚠️ No user_uid in request.state, will try to extract from registration data")
                # For now, we'll need to handle this differently
                # This is a temporary solution - we should get user_uid from frontend
                user_uid = None
        
        if not user_uid:
            print(f"❌ Cannot proceed without user_uid - this needs to be included in completion data")
            raise HTTPException(status_code=400, detail="User ID not available for registration completion")
        
        print(f"🔍 Using user_uid: {user_uid}")
        print(f"🔍 Processing {len(registrations)} registrations")
        print(f"🔍 Payment ID: {payment_id}, Total: ${total_amount}")
        
        if not registrations:
            raise HTTPException(status_code=400, detail="No registrations provided")
        
        # Check if this payment has already been processed
        existing_transaction = await Transaction.get_transaction_by_id(payment_id)
        if existing_transaction and existing_transaction.event_id == event_id:
            print(f"[BULK_PAYMENT] Payment {payment_id} already processed for event {event_id}")
            return {
                "status": "success",
                "message": "Bulk registration already completed",
                "event_id": event_id,
                "payment_id": payment_id,
                "total_amount": existing_transaction.amount,
                "registrations_completed": len(registrations)
            }

        # Get the event
        event = await get_event_by_id(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        print(f"🔍 Event found: {event.name} (Free: {event.is_free_event()}, Price: ${event.price})")
        
        # Register each person
        successful_registrations = []
        failed_registrations = []
        
        print(f"🔍 Starting registration loop for {len(registrations)} registrations")
        
        for i, registration in enumerate(registrations):
            print(f"🔍 Processing registration {i+1}/{len(registrations)}: {registration}")
            
            person_name = registration.get("name", registration.get("person_name", "Unknown"))
            person_id = registration.get("family_member_id", registration.get("person_id"))  # None for self, ID for family members
            donation_amount = registration.get("donation_amount", 0.0)
            payment_amount = registration.get("payment_amount_per_person", 0.0)
            
            print(f"🔍 Registration details:")
            print(f"  - Person name: {person_name}")
            print(f"  - Person ID: {person_id}")
            print(f"  - Donation amount: ${donation_amount}")
            print(f"  - Payment amount: ${payment_amount}")
            
            # Ensure person_id is properly None for self-registration
            if person_id == "null" or person_id == "":
                person_id = None
                print(f"🔍 Converted person_id to None for self-registration")
            
            print(f"🔍 About to start try block for registration...")
                
            print(f"🔍 About to call register_rsvp...")
            print(f"🔍 Registering: {person_name}, person_id: {person_id}")
            
            try:
                # Determine payment option for registration
                payment_option = None
                if donation_amount > 0 or payment_amount > 0:
                    payment_option = 'paypal'
                
                print(f"🔍 Calling register_rsvp with:")
                print(f"  - event_id: {event_id}")
                print(f"  - uid: {user_uid}")
                print(f"  - person_id: {person_id}")
                print(f"  - display_name: {person_name}")
                print(f"  - payment_option: {payment_option}")
                
                success, reason = await register_rsvp(
                    event_id=event_id,
                    uid=user_uid,
                    person_id=person_id,
                    display_name=person_name,
                    payment_option=payment_option
                )
                
                print(f"🔍 register_rsvp completed:")
                print(f"  - success: {success}")
                print(f"  - reason: {reason}")
                
                if success:
                    successful_registrations.append({
                        "person_name": person_name,
                        "person_id": person_id,
                        "donation_amount": donation_amount,
                        "payment_amount": payment_amount
                    })
                    print(f"✅ Successfully registered: {person_name} (donation: ${donation_amount})")
                    
                    # Immediately verify the attendee was added to the database
                    print(f"🔍 Verifying attendee was added to database...")
                    verify_event = await DB.db["events"].find_one(
                        {"_id": ObjectId(event_id)},
                        {"attendees": 1, "attendee_keys": 1, "seats_taken": 1}
                    )
                    
                    if verify_event:
                        attendee_keys = verify_event.get('attendee_keys', [])
                        attendees = verify_event.get('attendees', [])
                        seats_taken = verify_event.get('seats_taken', 0)
                        
                        print(f"🔍 Database verification after registration:")
                        print(f"  - Attendee keys: {attendee_keys}")
                        print(f"  - Number of attendees: {len(attendees)}")
                        print(f"  - Seats taken: {seats_taken}")
                        
                        # Check if our specific attendee was added
                        expected_key = f"{user_uid}|{person_id if person_id else 'self'}|rsvp"
                        if expected_key in attendee_keys:
                            print(f"✅ Attendee key found in database: {expected_key}")
                        else:
                            print(f"❌ Attendee key NOT found in database. Expected: {expected_key}")
                            print(f"❌ Available keys: {attendee_keys}")
                    else:
                        print(f"❌ Could not find event in database for verification: {event_id}")
                else:
                    error_message = "Registration failed"
                    if reason == "already_registered":
                        error_message = "Already registered"
                    elif reason == "event_full":
                        error_message = "Event is full"
                    
                    failed_registrations.append({
                        "person_name": person_name,
                        "person_id": person_id,
                        "error": error_message,
                        "reason": reason
                    })
                    print(f"❌ Failed to register: {person_name} - {error_message} (reason: {reason})")
            except Exception as e:
                failed_registrations.append({
                    "person_name": person_name,
                    "person_id": person_id,
                    "error": str(e)
                })
                print(f"❌ Error registering {person_name}: {e}")
                print(f"❌ Traceback: {traceback.format_exc()}")
        
        # Record payment transaction for successful registrations
        if successful_registrations and payment_id:
            try:
                print(f"🔍 Recording transaction for {len(successful_registrations)} successful registrations")
                
                # Calculate actual amounts from successful registrations
                total_donation_amount = sum(reg.get("donation_amount", 0) for reg in successful_registrations)
                total_payment_amount = sum(reg.get("payment_amount", 0) for reg in successful_registrations)
                calculated_total = total_donation_amount + total_payment_amount
                
                print(f"🔍 Transaction amounts:")
                print(f"  - Total donations: ${total_donation_amount}")
                print(f"  - Total payments: ${total_payment_amount}")
                print(f"  - Calculated total: ${calculated_total}")
                print(f"  - Reported total: ${total_amount}")
                
                # Use the calculated total or fall back to reported total
                final_amount = calculated_total if calculated_total > 0 else total_amount
                
                # Determine transaction type based on actual amounts
                if total_donation_amount > 0 and total_payment_amount > 0:
                    transaction_type = "event_payment_and_donation"
                    fund_name = f"Event Payment & Donation: {event.name}"
                elif total_donation_amount > 0:
                    transaction_type = "event_donation"
                    fund_name = f"Event Donation: {event.name}"
                else:
                    transaction_type = "event_payment"
                    fund_name = f"Event Payment: {event.name}"
                
                print(f"🔍 Transaction type: {transaction_type}")
                print(f"🔍 Fund name: {fund_name}")
                
                # Create transaction record
                transaction = Transaction(
                    transaction_id=payment_id,
                    user_email=payer_email or "unknown@example.com",
                    amount=final_amount,
                    status="completed",
                    type="one-time",
                    order_id=payment_id,
                    payment_method="paypal",
                    time=datetime.now().isoformat(),
                    name=payer_name or "Anonymous",
                    fund_name=fund_name,
                    note=f"Bulk registration for {len(successful_registrations)} people" + 
                         (f" (${total_donation_amount} donation + ${total_payment_amount} payment)" if total_donation_amount > 0 else ""),
                    currency="USD",
                    event_type="bulk_registration",
                    created_on=datetime.now().isoformat(),
                    event_id=event_id,
                    event_name=event.name,
                    payment_type=transaction_type,
                    user_uid=user_uid
                )
                
                # Save transaction to database
                print(f"🔍 Saving transaction to database...")
                print(f"🔍 Transaction object details:")
                print(f"  - transaction_id: {transaction.transaction_id}")
                print(f"  - amount: ${transaction.amount}")
                print(f"  - user_email: {transaction.user_email}")
                print(f"  - payment_method: {transaction.payment_method}")
                print(f"  - payment_type: {transaction.payment_type}")
                print(f"  - user_uid: {transaction.user_uid}")
                
                saved_transaction = await Transaction.create_transaction(transaction)
                print(f"🔍 Transaction.create_transaction returned: {saved_transaction}")
                print(f"🔍 Transaction saved type: {type(saved_transaction)}")
                
                if saved_transaction:
                    print(f"✅ Transaction recorded: {payment_id} for ${final_amount}")
                    print(f"✅ Transaction ID in database: {saved_transaction.get('_id', 'Unknown') if isinstance(saved_transaction, dict) else getattr(saved_transaction, 'id', 'Unknown')}")
                    
                    # Verify transaction was actually saved by querying the database
                    print(f"🔍 Verifying transaction was saved to database...")
                    verify_transaction = await DB.db["transactions"].find_one(
                        {"transaction_id": payment_id}
                    )
                    
                    if verify_transaction:
                        print(f"✅ Transaction verified in database:")
                        print(f"  - Database ID: {verify_transaction.get('_id')}")
                        print(f"  - Transaction ID: {verify_transaction.get('transaction_id')}")
                        print(f"  - Amount: ${verify_transaction.get('amount')}")
                        print(f"  - Payment type: {verify_transaction.get('payment_type')}")
                    else:
                        print(f"❌ Transaction NOT found in database with payment_id: {payment_id}")
                        
                        # Check if any transactions exist at all
                        total_transactions = await DB.db["transactions"].count_documents({})
                        print(f"🔍 Total transactions in database: {total_transactions}")
                    
                    # Update event registration records with payment information
                    for reg in successful_registrations:
                        try:
                            # Get person_id and convert to ObjectId if it's a string
                            person_id = reg.get('person_id')
                            donation_amount = reg.get('donation_amount', 0)
                            payment_amount = reg.get('payment_amount', 0)
                            
                            if person_id and person_id != "null" and person_id != "":
                                person_oid = ObjectId(person_id)
                            else:
                                person_oid = None
                            
                            # Generate attendee key using the same format as _attendee_key function
                            attendee_key = f"{user_uid}|{str(person_oid) if person_oid else 'self'}|rsvp"
                            
                            print(f"🔍 Updating payment status for {reg['person_name']}:")
                            print(f"  - Attendee key: {attendee_key}")
                            print(f"  - Donation: ${donation_amount}")
                            print(f"  - Payment: ${payment_amount}")
                            
                            # Update payment status for this attendee
                            updated = await update_attendee_payment_status(
                                event_id=event_id,
                                attendee_key=attendee_key,
                                payment_status="paid",
                                transaction_id=payment_id
                            )
                            
                            if updated:
                                print(f"✅ Updated payment status for {reg['person_name']}")
                            else:
                                print(f"⚠️ Could not update payment status for {reg['person_name']} - attendee not found with key: {attendee_key}")
                                
                                # Try to find the attendee in the database to debug
                                print(f"🔍 Debugging: Checking if attendee exists in event...")
                                debug_event = await DB.db["events"].find_one(
                                    {"_id": ObjectId(event_id)},
                                    {"attendees": 1, "attendee_keys": 1}
                                )
                                if debug_event:
                                    print(f"🔍 Event attendee keys: {debug_event.get('attendee_keys', [])}")
                                    attendees = debug_event.get('attendees', [])
                                    for att in attendees:
                                        if att.get('user_uid') == user_uid:
                                            print(f"🔍 Found attendee for user: {att}")
                                
                        except Exception as e:
                            print(f"❌ Error updating payment status for {reg['person_name']}: {e}")
                            print(f"❌ Traceback: {traceback.format_exc()}")
                else:
                    print(f"❌ Failed to save transaction: {payment_id}")
                    print(f"❌ Transaction save result: {saved_transaction}")
                    
            except Exception as e:
                print(f"❌ Error recording transaction: {str(e)}")
                # Don't fail the whole operation if transaction recording fails
        
        return {
            "success": len(failed_registrations) == 0,
            "event_id": event_id,
            "event_name": event.name,
            "payment_id": payment_id,
            "total_registrations": len(registrations),
            "successful_registrations": successful_registrations,
            "failed_registrations": failed_registrations
        }
        
    except HTTPException as he:
        raise
    except Exception as e:
        print(f"❌ Error completing bulk registration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to complete bulk registration: {str(e)}")

@event_payment_router.get("/{event_id}/payment/status")
async def get_event_payment_status(event_id: str):
    """Get payment requirements and status for an event"""
    try:
        # Get the event
        event = await get_event_by_id(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Detailed debugging information
        debug_info = {
            "price": event.price,
            "price_greater_than_zero": event.price > 0,
            "payment_options": event.payment_options,
            "has_paypal_option": event.has_paypal_option(),
            "has_door_payment": event.has_door_payment_option(),
            "requires_payment_result": event.requires_payment(),
            "requires_payment_logic": f"payment_options ({event.payment_options}) AND price > 0 ({event.price > 0})"
        }
        
        return {
            "event_id": event_id,
            "event_name": event.name,
            "price": event.price,
            "payment_options": event.payment_options,
            "has_paypal_option": event.has_paypal_option(),
            "has_door_payment": event.has_door_payment_option(),
            "requires_payment": event.requires_payment(),
            "is_free": event.is_free_event(),
            "refund_policy": event.refund_policy,
            "debug": debug_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get payment status: {str(e)}")

@event_payment_router.get("/{event_id}/registrations/payment-status")
async def get_event_payment_registrations(event_id: str):
    """Get event registrations with payment status information"""
    try:
        # Get the event
        event = await get_event_by_id(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Get payment summary
        payment_summary = await get_event_payment_summary(event_id)
        
        # Get all registrations with payment status
        all_registrations = await get_event_registrations_by_payment_status(event_id)
        
        # Get transaction details for paid registrations
        transactions = await Transaction.get_transactions_by_event(event_id)
        
        return {
            "event_id": event_id,
            "event_name": event.name,
            "requires_payment": event.requires_payment(),
            "price": event.price,
            "payment_summary": payment_summary,
            "registrations": all_registrations,
            "transactions": [tx.model_dump() for tx in transactions]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get payment registrations: {str(e)}")

@event_payment_router.post("/{event_id}/registrations/{registration_key}/payment-status")
async def update_registration_payment_status(
    event_id: str,
    registration_key: str,
    request: Request,
    status_data: Dict[str, Any] = Body(...)
):
    """Update payment status for a specific registration (admin only)"""
    try:
        # Get the event
        event = await get_event_by_id(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        payment_status = status_data.get("payment_status")
        transaction_id = status_data.get("transaction_id")
        
        if payment_status not in ["not_required", "pending", "completed", "failed"]:
            raise HTTPException(
                status_code=400,
                detail="payment_status must be one of: not_required, pending, completed, failed"
            )
        
        # Update the payment status
        updated = await update_attendee_payment_status(
            event_id=event_id,
            registration_key=registration_key,
            payment_status=payment_status,
            transaction_id=transaction_id
        )
        
        if updated:
            return {
                "success": True,
                "message": "Payment status updated successfully",
                "event_id": event_id,
                "registration_key": registration_key,
                "payment_status": payment_status
            }
        else:
            raise HTTPException(
                status_code=404,
                detail="Registration not found or update failed"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update payment status: {str(e)}")