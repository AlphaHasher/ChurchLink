
from fastapi import APIRouter,  Request, Query, Body
from models.event import EventUpdate, search_events, get_readmod_event_by_id, get_events_with_discount_code
from models.event_instance import search_assembled_event_instances
from models.discount_code import DiscountCodeUpdate, get_discount_code_by_id, get_all_discount_codes, create_discount_code, update_discount_code
from controllers.event_controllers.admin_event_controller import process_create_event, process_edit_event, process_delete_event, process_instance_overrides, fetch_admin_instance_assembly_by_id, EventDiscountCodesUpdate, process_set_event_discount_codes, process_delete_discount_code, get_user_registration_info
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

@mod_event_router.get("/admin-instance-assembly/{instance_id}", summary="Get assembled admin view for a single event instance")
async def get_admin_instance_assembly_route(
    instance_id: str,
    preferred_lang: Optional[str] = Query(
        None, description="Preferred locale key for default localization (e.g. 'en')."
    ),
):
    """
    Admin-only, single-instance fetch by instance_id.
    Returns the assembled admin payload including registration_details.
    """
    return await fetch_admin_instance_assembly_by_id(instance_id, preferred_lang)

@mod_event_router.get("/get-discount-code/{code_id}", summary="Get discount code by ID")
async def get_discount_code_by_id_route(code_id: str):
    """
    Admin-only: Fetch a single discount code by ID.
    """
    code = await get_discount_code_by_id(code_id)
    if not code:
        return {"success": False, "msg": "Discount code not found.", "code": None}
    return {"success": True, "msg": "Discount code returned!", "code": code}

@mod_event_router.get("/get-all-discount-codes", summary="List all discount codes")
async def list_discount_codes_route():
    """
    Admin-only: Return all discount codes.
    """
    codes = await get_all_discount_codes()
    return {"success": True, "msg": "Discount codes returned!", "codes": codes}

@mod_event_router.get("/get-events-with-discount/{code_id}", summary="List all events using a given discount code (admin view)")
async def get_events_with_discount_route(
    code_id: str,
    preferred_lang: Optional[str] = Query(
        None, description="Preferred locale key for default localization (e.g. 'en')."
    ),
):
    """
    Admin-only: return ALL events whose `discount_codes` contains `code_id`.
    """
    events = await get_events_with_discount_code(code_id, preferred_lang=preferred_lang)
    return {
        "success": True,
        "msg": f"Found {len(events)} event(s) using this discount code.",
        "events": events,
        "preferred_lang": preferred_lang or "",
    }

@mod_event_router.get("/registration-details/{instance_id}/{user_id}")
async def get_reg_details_for_instance_and_user(instance_id: str, user_id:str):
    return await get_user_registration_info(instance_id, user_id)

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


@event_editing_router.post("/create-discount-code", summary="Create discount code")
async def create_discount_code_route(payload: DiscountCodeUpdate):
    """
    Admin-only: Create a new discount code.
    Passes directly through to the model-layer create function.
    """
    return await create_discount_code(payload)

@event_editing_router.put("/discount-code/{code_id}", summary="Update discount code")
async def update_discount_code_route(code_id: str, payload: DiscountCodeUpdate):
    """
    Admin-only: Update an existing discount code by ID.
    """
    return await update_discount_code(code_id, payload)

@event_editing_router.patch("/change-discount-codes", summary="Change which discount codes are available for an event")
async def update_event_discount_codes(payload: EventDiscountCodesUpdate = Body(...)):
    return await process_set_event_discount_codes(payload)

@event_editing_router.delete("/delete-discount-code/{code_id}", summary="Delete a discount code and detach it from all events")
async def delete_discount_code_route(code_id: str):
    """
    Editing-protected: Delete the discount code and remove its id
    from every event's `discount_codes` array.
    """
    return await process_delete_discount_code(code_id)
