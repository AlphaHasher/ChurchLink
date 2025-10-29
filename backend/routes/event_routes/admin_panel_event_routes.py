
from fastapi import APIRouter,  Request, Query, Body
from models.event import EventUpdate, search_events, get_readmod_event_by_id
from models.event_instance import search_assembled_event_instances
from controllers.event_controllers.admin_event_controller import process_create_event, process_edit_event, process_delete_event, process_instance_overrides
from typing import Literal, List, Optional, Any, Dict


mod_event_router = APIRouter(prefix="/events", tags=["Events Moderator Routes"])
event_editing_router = APIRouter(prefix="/events", tags=["Events Editing Routes"])

# Mod Route: Event Search
@mod_event_router.get("/admin-panel")
async def get_admin_panel_events(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    query: Optional[str] = Query(None),
    ministries: Optional[List[str]] = Query(None, description="Repeat param, e.g. ?ministries=a&ministries=b or comma-separated"),
    registration_allowed: Optional[bool] = Query(None),
    hidden: Optional[bool] = Query(None),
    members_only: Optional[bool] = Query(None),
    rsvp_required: Optional[bool] = Query(None),
    min_age: Optional[int] = Query(None, ge=0),
    max_age: Optional[int] = Query(None, ge=0),
    gender: Optional[Literal["all", "male", "female"]] = Query(None),
    preferred_lang: Optional[str] = Query(None),
    sort_by_date_asc: bool = Query(True),
):
    # Normalize ministries to support both repeated params and single comma-separated string
    mins: Optional[List[str]] = ministries
    if mins and len(mins) == 1 and "," in mins[0]:
        mins = [m.strip() for m in mins[0].split(",") if m.strip()]
    if mins == []:
        mins = None

    return await search_events(
        page=page,
        limit=limit,
        query=query,
        ministries=mins,
        registration_allowed=registration_allowed,
        hidden=hidden,
        members_only=members_only,
        rsvp_required=rsvp_required,
        min_age=min_age,
        max_age=max_age,
        gender=gender,
        preferred_lang=preferred_lang,
        sort_by_date_asc=sort_by_date_asc,
    )

# Mod Route: Get Admin Panel by ID
@mod_event_router.get("/admin-panel-by-id/{event_id}")
async def get_admin_panel_event_by_id(
    event_id: str,
    preferred_lang: Optional[str] = Query(
        None,
        description="Preferred locale key for default localization (e.g. 'en').",
    ),
):
    event = await get_readmod_event_by_id(event_id, preferred_lang=preferred_lang)
    if event:
        return {
            "success": True,
            "msg": "Event returned successfully!",
            "event": event,
            "preferred_lang": preferred_lang or "",
        }
    else:
        return {
            "success": False,
            "msg": "Failed to get event!",
            "event": None,
            "preferred_lang": preferred_lang or "",
        }


# Mod Route: Event Instance Search (Admin Panel POV)
@mod_event_router.get("/admin-instances")
async def get_admin_event_instances(
    event_id: str = Query(..., description="Parent event ID to scope instances"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    status: Literal["all", "upcoming", "passed"] = Query("all"),
    sort_by_series_index_asc: bool = Query(True),
    preferred_lang: Optional[str] = Query(None),
):
    return await search_assembled_event_instances(
        event_id=event_id,
        page=page,
        limit=limit,
        status=status,
        sort_by_series_index_asc=sort_by_series_index_asc,
        preferred_lang=preferred_lang,
    )


# Perm Protected Router: event_editing
@event_editing_router.post("/", summary="Create event")
async def create_event_route(event: EventUpdate, request: Request):
    return await process_create_event(event, request)

# Perm Protected Router: event_editing
@event_editing_router.put("/{event_id}", summary="Update event")
async def update_event_route(event_id: str, event: EventUpdate, request: Request):
    return await process_edit_event(event_id, event, request)

# Perm Protected Router: event_editing
@event_editing_router.delete("/{event_id}", summary="Delete event")
async def delete_event_route(event_id: str, request: Request):
    return await process_delete_event(event_id, request)

# Perm Protected Router: event_editing
@event_editing_router.put("/override/{event_id}/{series_index}", summary = 'Update Event Instance Overrides')
async def update_event_instance_overrides(
    event_id: str,
    series_index: int,
    overrides: Dict[str, Any] = Body(...)
):
    return await process_instance_overrides(overrides, event_id, series_index)

'''
TODO: DEAL WITH THIS BUSINESS LATER
# Mod Router
@mod_event_router.get("/{event_id}/admin-details", summary="Get detailed event information for admin")
async def get_event_admin_details(event_id: str, request: Request):
    """Get comprehensive event details including attendees, payment info, and statistics for admin panel"""
    try:
        # Get the event
        event = await get_event_by_id(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Get basic attendee information
        attendee_data = await rsvp_list(event_id)
        attendees = attendee_data.get("attendees", [])
        
        # Get payment summary and detailed payment status
        payment_summary = await get_event_payment_summary(event_id)
        payment_registrations = await get_event_registrations_by_payment_status(event_id)
        
        # Get transaction details for this event
        transactions = await Transaction.get_transactions_by_event(event_id)
        transaction_data = [tx.model_dump() for tx in transactions]
        
        # Resolve user names and contact information for attendees
        enriched_attendees = await UserResolutionHelper.resolve_user_names_for_attendees(attendees)
        
        # Calculate event statistics
        total_spots = event.spots if event.spots > 0 else "Unlimited"
        spots_taken = attendee_data.get("seats_taken", 0)
        available_spots = "Unlimited" if event.spots == 0 else max(0, event.spots - spots_taken)
        
        # Payment statistics
        total_revenue = sum(tx.amount for tx in transactions if tx.payment_type == "event_registration")
        pending_payments = payment_summary.get("pending_count", 0)
        completed_payments = payment_summary.get("paid_count", 0)
        
        return {
            "event": {
                "id": event.id,
                "name": event.name,
                "description": event.description,
                "date": event.date.isoformat(),
                "location": event.location,
                "price": event.price,
                "spots": event.spots,
                "rsvp": event.rsvp,
                "recurring": event.recurring,
                "ministry": event.ministry,
                "min_age": event.min_age,
                "max_age": event.max_age,
                "gender": event.gender,
                "image_url": event.image_url,
                "published": event.published,
                "payment_options": event.payment_options,
                "refund_policy": event.refund_policy,
                "requires_payment": event.requires_payment(),
                "is_free_event": event.is_free_event()
            },
            "statistics": {
                "total_spots": total_spots,
                "spots_taken": spots_taken,
                "available_spots": available_spots,
                "total_registrations": len(attendees),
                "total_revenue": total_revenue,
                "pending_payments": pending_payments,
                "completed_payments": completed_payments
            },
            "attendees": enriched_attendees,
            "payment_summary": payment_summary,
            "payment_registrations": payment_registrations,
            "transactions": transaction_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get event admin details: {str(e)}")


# Public Router: Event History for recurring events
@public_event_router.get("/{event_id}/history", summary="Get event history for recurring events")
async def get_event_history_route(event_id: str):
    """Get historical data for recurring events including past occurrences and statistics"""
    try:
        # Get the current event to check if it's recurring
        current_event = await get_event_by_id(event_id)
        if not current_event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        if current_event.recurring == "never":
            raise HTTPException(status_code=400, detail="Event is not recurring - no history available")
        
        # For now, return mock data since we don't have historical tracking yet
        # In a real implementation, you would:
        # 1. Query for all events with the same name/base_event_id 
        # 2. Calculate statistics from past occurrences
        # 3. Return actual historical data
        
        
        # Generate mock historical occurrences
        occurrences = []
        now = datetime.now()
        
        # Generate 6 past occurrences
        for i in range(6):
            occurrence_date = now - timedelta(weeks=i+1)
            attendees_count = random.randint(15, min(current_event.spots, 30))
            
            occurrences.append({
                "id": f"mock-{event_id}-{i}",
                "name": current_event.name,
                "date": occurrence_date.isoformat(),
                "location": current_event.location,
                "price": current_event.price,
                "spots": current_event.spots,
                "attendees_count": attendees_count,
                "revenue": attendees_count * current_event.price,
                "status": "completed",
                "attendance_rate": round((attendees_count / current_event.spots) * 100, 1) if current_event.spots > 0 else 100.0
            })
        
        # Calculate statistics
        total_attendees = sum(occ["attendees_count"] for occ in occurrences)
        total_revenue = sum(occ["revenue"] for occ in occurrences)
        average_attendance = total_attendees / len(occurrences) if occurrences else 0
        
        # Find best attendance
        best_occurrence = max(occurrences, key=lambda x: x["attendees_count"]) if occurrences else None
        
        # Simple trend calculation (comparing last 3 vs first 3)
        if len(occurrences) >= 6:
            recent_avg = sum(occ["attendees_count"] for occ in occurrences[:3]) / 3
            older_avg = sum(occ["attendees_count"] for occ in occurrences[3:6]) / 3
            if recent_avg > older_avg * 1.1:
                trend = "increasing"
            elif recent_avg < older_avg * 0.9:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            trend = "stable"
        
        stats = {
            "total_occurrences": len(occurrences),
            "total_attendees": total_attendees,
            "total_revenue": total_revenue,
            "average_attendance": round(average_attendance, 1),
            "average_revenue": round(total_revenue / len(occurrences), 2) if occurrences else 0,
            "best_attendance": {
                "count": best_occurrence["attendees_count"] if best_occurrence else 0,
                "date": best_occurrence["date"] if best_occurrence else ""
            },
            "trend": trend
        }
        
        return {
            "success": True,
            "occurrences": occurrences,
            "stats": stats
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logging.error(f"Error fetching event history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch event history: {str(e)}")

'''