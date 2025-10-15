from typing import Optional
from fastapi import APIRouter, HTTPException, status, Request, Query, Body
from bson import ObjectId
from datetime import datetime

from helpers.event_person_helper import event_person_helper
from config.settings import settings
import logging


event_person_registration_router = APIRouter(prefix="/event-people", tags=["Event Registration"])
event_person_management_router = APIRouter(prefix="/event-people", tags=["Event People Management"])

#
# --- Protected routes ---
#

# Private Router
# Add (watch) a non-RSVP event to "My Events"
@event_person_registration_router.post("/watch/{event_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def watch_event_route(
    event_id: str,
    request: Request,
    scope: str = Query("series", regex="^(series|occurrence)$"),
    occurrenceStart: Optional[str] = Query(None, description="ISO8601 start for single occurrence"),
):
    """
    Adds an event to the user's 'My Events' as a 'watch' reference.
    scope=series|occurrence; when scope=occurrence you may pass occurrenceStart (ISO8601).
    """
    return await event_person_helper.watch_event(
        event_id=event_id,
        user_uid=request.state.uid,
        scope=scope,
        occurrence_start=occurrenceStart
    )


# Private Router
# Remove (unwatch) from "My Events"
@event_person_registration_router.delete("/watch/{event_id}", response_model=dict)
async def unwatch_event_route(
    event_id: str,
    request: Request,
    scope: Optional[str] = Query(None, regex="^(series|occurrence)$"),
    occurrenceStart: Optional[str] = Query(None),
):
    """
    Removes the user's 'watch' reference for this event.
    If scope/occurrenceStart are provided, removal will target that specific reference.
    Otherwise it removes any 'watch' entries for that event.
    """
    return await event_person_helper.unwatch_event(
        event_id=event_id,
        user_uid=request.state.uid,
        scope=scope,
        occurrence_start=occurrenceStart
    )


# Private Router
# Get all events for a user (My Events)
@event_person_management_router.get("/user", response_model=dict)
async def get_user_events_route(request: Request):
    return await event_person_helper.get_user_events(
        user_uid=request.state.uid
    )


# Private Router
@event_person_management_router.get("/status/{event_id}", response_model=dict)
async def get_registration_status_route(event_id: str, request: Request):
    """
    Simple check whether the *user themself* (not family) is registered for this event.
    Uses rsvp_list() which returns: { attendees: [...], seats_taken, spots }
    Each attendee has: user_uid, person_id, key, kind, addedOn, ...
    """
    return await event_person_helper.get_registration_status(
        event_id=event_id,
        user_uid=request.state.uid
    )


# Private Route
# Add user to event (RSVP/register)
@event_person_registration_router.post("/register/{event_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_user_for_event(
    event_id: str, 
    request: Request,
    scope: str = Query("series", regex="^(series|occurrence)$", description="Scope: 'series' for recurring, 'occurrence' for one-time")
):
    try:
        from controllers.event_functions import register_rsvp

        result = await register_rsvp(event_id, request.state.uid, None, None, scope)
        if not result:
            raise HTTPException(status_code=400, detail="Registration failed")
        return {"success": True, "registration": True, "scope": scope}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error registering for event: {str(e)}")


# Private Router
# Remove user from event (cancel RSVP)
@event_person_registration_router.delete("/unregister/{event_id}", response_model=dict)
async def unregister_user_from_event(
    event_id: str, 
    request: Request,
    scope: Optional[str] = Query(None, regex="^(series|occurrence)$", description="Optional scope to remove specific registration")
):
    try:
        from controllers.event_functions import cancel_rsvp

        result = await cancel_rsvp(event_id, request.state.uid, None, scope)
        if not result:
            raise HTTPException(status_code=400, detail="Unregistration failed")
        return {"success": True, "message": "Unregistered successfully"}
    except HTTPException:
        raise


# Private Router
# Unified registration for single or multiple people
@event_person_registration_router.post("/register-multiple/{event_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_multiple_people_for_event(
    event_id: str, 
    request: Request,
    registration_data: dict = Body(...)
):
    """
    Unified endpoint for registering single or multiple people for an event.
    
    Expected body:
    {
        "registrations": [
            {"person_id": null, "name": "John Doe"},  // null person_id = self
            {"person_id": "family_member_id", "name": "Jane Doe"}  // family member
        ],
        "payment_option": "paypal" | "door" | null,  // for free events
        "donation_amount": 25.50  // optional donation
    }
    """
    from controllers.event_functions import register_multiple_people
    
    try:
        registrations = registration_data.get('registrations', [])
        payment_option = registration_data.get('payment_option')
        donation_amount = float(registration_data.get('donation_amount', 0))
        
        if not registrations:
            raise HTTPException(status_code=400, detail="No registrations provided")
        
        success, message = await register_multiple_people(
            event_id=event_id,
            uid=request.state.uid,
            registrations=registrations,
            payment_option=payment_option,
            donation_amount=donation_amount
        )
        
        if success:
            return {"success": True, "message": message}
        else:
            raise HTTPException(status_code=400, detail=message)
            
    except Exception as e:
        logging.error(f"Error in unified registration: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


# Private Router  
# Create payment order for multiple registrations (simplified)
@event_person_registration_router.post("/create-payment-order/{event_id}", response_model=dict)
async def create_registration_payment_order(
    event_id: str,
    request: Request, 
    payment_data: dict = Body(...)
):
    """
    Simplified payment order creation for event registrations.
    
    Expected body:
    {
        "registrations": [...],  // same as register-multiple
        "payment_option": "paypal",
        "donation_amount": 25.50,
        "total_amount": 75.50
    }
    """
    from helpers.paypalHelper import create_order_from_data
    from models.event import get_event_by_id
    
    try:
        registrations = payment_data.get('registrations', [])
        total_amount = float(payment_data.get('total_amount', 0))
        donation_amount = float(payment_data.get('donation_amount', 0))
        return_url = payment_data.get('return_url', '')
        cancel_url = payment_data.get('cancel_url', '')
        
        # Debug: Print the received URLs
        print(f"DEBUG: Received payment_data: {payment_data}")
        print(f"DEBUG: return_url = '{return_url}'")
        print(f"DEBUG: cancel_url = '{cancel_url}'")
        
        if not registrations or total_amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid payment data: No registrations or zero total amount")
        
        # Get event for payment description
        event = await get_event_by_id(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Create PayPal order with proper v2 structure
        order_data = {
            "purchase_units": [
                {
                    "amount": {
                        "value": f"{total_amount:.2f}",
                        "currency_code": "USD"
                    },
                    "description": f"Registration for {event.name} ({len(registrations)} people)",
                    "items": [
                        {
                            "name": f"Registration for {event.name}",
                            "unit_amount": {
                                "value": f"{total_amount:.2f}",
                                "currency_code": "USD"
                            },
                            "quantity": 1
                        }
                    ]
                }
            ],
            "application_context": {
                "return_url": return_url or f"{settings.FRONTEND_URL}/events/{event_id}/payment/success",
                "cancel_url": cancel_url or f"{settings.FRONTEND_URL}/events/{event_id}/payment/cancel"
            }
        }
        
        # Debug: Print final URLs being sent to PayPal
        final_return_url = return_url or f"{settings.FRONTEND_URL}/events/{event_id}/payment/success"
        final_cancel_url = cancel_url or f"{settings.FRONTEND_URL}/events/{event_id}/payment/cancel"
        print(f"DEBUG: Final return_url sent to PayPal: '{final_return_url}'")
        print(f"DEBUG: Final cancel_url sent to PayPal: '{final_cancel_url}'")
        
        paypal_response = await create_order_from_data(order_data)
        
        if "error" in paypal_response:
            raise HTTPException(status_code=500, detail=paypal_response.get("error", "Payment order creation failed"))
        
        # Store registration details temporarily for success handler to use
        payment_id = paypal_response.get("payment_id")
        if payment_id:
            from mongo.database import DB
            registration_session = {
                "payment_id": payment_id,
                "event_id": event_id,
                "user_uid": request.state.uid,  # Add user UID for registration
                "registrations": registrations,
                "total_amount": total_amount,
                "donation_amount": donation_amount,
                "registration_count": len(registrations),
                "created_at": datetime.now().isoformat(),
                "status": "pending"
            }
            await DB.insert_document("payment_sessions", registration_session)
        
        # Store minimal payment info in user's session/temporary storage instead of separate collection
        # The actual registration will happen after payment confirmation
        return {
            "success": True,
            "payment_id": paypal_response.get("payment_id"),
            "approval_url": paypal_response.get("approval_url"),
            "message": "Payment order created successfully"
        }
        
    except Exception as e:
        logging.error(f"Error creating payment order: {e}")
        raise HTTPException(status_code=500, detail=f"Payment order creation failed: {str(e)}")


# Private Route
# Get user's events (alias of /user)
@event_person_registration_router.get("/my-events", response_model=dict)
async def get_my_events(request: Request, include_family: bool = True, expand: bool = False):
    return await event_person_helper.get_user_events(
        user_uid=request.state.uid,
        expand=expand
    )


#
# --- Family Member Event Routes ---
#

# Private Route
# Register a family member for an event
@event_person_registration_router.post("/register/{event_id}/family-member/{family_member_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_family_member_for_event(
    event_id: str, 
    family_member_id: str, 
    request: Request,
    scope: str = Query("series", regex="^(series|occurrence)$", description="Scope: 'series' for recurring, 'occurrence' for one-time")
):
    try:
        from controllers.event_functions import register_rsvp

        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=404, detail="Family member not found")

        result = await register_rsvp(event_id, request.state.uid, family_member_id, None, scope)
        if not result:
            raise HTTPException(status_code=400, detail="Registration failed")

        return {"success": True, "registration": True, "scope": scope}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error registering family member for event: {str(e)}")

# Redundant donation endpoint removed - now using bulk payment system for all event donations
# Free events with donations should use: /events/{id}/payment/create-bulk-order

# Private Route
# Unregister a family member from an event
@event_person_registration_router.delete("/unregister/{event_id}/family-member/{family_member_id}", response_model=dict)
async def unregister_family_member_from_event(
    event_id: str, 
    family_member_id: str, 
    request: Request,
    scope: Optional[str] = Query(None, regex="^(series|occurrence)$", description="Optional scope to remove specific registration")
):
    try:
        from controllers.event_functions import cancel_rsvp

        # Validate family member ownership
        member = await get_family_member_by_id(request.state.uid, family_member_id)
        if not member:
            raise HTTPException(status_code=404, detail="Family member not found")

        result = await cancel_rsvp(event_id, request.state.uid, family_member_id, scope)
        if not result:
            raise HTTPException(status_code=400, detail="Unregistration failed")

        return {"success": True, "message": "Family member unregistered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error unregistering family member from event: {str(e)}")


# Private Route
# Get all events for user's family members (currently returns all; filter if needed)
@event_person_registration_router.get("/my-family-members-events", response_model=dict)
async def get_my_family_members_events(request: Request, filters: Optional[str] = None):
    return await event_person_helper.get_family_members_events(
        user_uid=request.state.uid,
        filters=filters
    )


# Private Route
# Get events for a specific family member
@event_person_registration_router.get("/family-member/{family_member_id}/events", response_model=dict)
async def get_family_member_events(family_member_id: str, request: Request):
    return await event_person_helper.get_family_member_events(
        family_member_id=family_member_id,
        user_uid=request.state.uid
    )

# Test route to verify router is working
@event_person_registration_router.delete("/test-delete/{test_id}", response_model=dict)
async def test_delete_route(test_id: str, request: Request):
    print(f"DEBUG: Test delete route called - test_id: {test_id}")
    return {"success": True, "message": "Test delete route working", "test_id": test_id}


