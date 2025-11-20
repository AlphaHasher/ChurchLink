from fastapi import Request
from mongo.churchuser import UserHandler
from models.event import get_event_doc_by_id
from typing import List
import logging
from models.ministry import list_ministries
from models.event_instance import get_event_instance_for_read_by_id, get_sister_upcoming_identifiers

async def process_add_favorite_event(request: Request, event_id: str):

    # Validate that a particular event exists
    event_doc = await get_event_doc_by_id(event_id)
    if not event_doc:
        return {'success':False, 'msg':f'Could not add event to favorites! Error: Could not find event with id {event_id}'}
    
    favorite_events = list(request.state.user.get("favorite_events") or [])
    if event_id not in favorite_events:
        favorite_events.append(event_id)

    modified = await UserHandler.update_user({"uid": request.state.uid}, {"favorite_events":favorite_events})

    if not modified:
        return {'success':False, 'msg':f'Could not add event to favorites! Error in applying event updates'}
    
    return {'success':True, 'msg':f'Successfully added event with id {event_id} to favorites!'}

async def process_remove_favorite_event(request:Request, event_id: str):
    
    # Validate that a particular event is actually already favorited
    favorite_events = list(request.state.user.get("favorite_events") or [])
    if event_id not in favorite_events:
        return {'success':True, 'msg':'This event was already not in your favorites, but consider result accomplished.'}
    
    favorite_events.remove(event_id)

    modified = await UserHandler.update_user({"uid": request.state.uid}, {"favorite_events":favorite_events})

    if not modified:
        return {'success':False, 'msg':f'Failed to apply updates to remove event with id {event_id} from favorite events!'}
    
    return {'success':True, 'msg':f'Successfully removed event with id {event_id} from favorites!'}

async def get_instance_details(
    instance_id: str,
    uid: str | None = None,
    favorite_events: List[str] | None = None,
    preferred_lang: str | None = "en",
):
    """
    Controller used by both public and private routes.
    Returns:
      {
        "success": bool,
        "msg": str,
        "sister_details": SisterInstanceIdentifier | [],
        "event_details": ReadEventInstance | None,
        "ministries": List[dict]
      }
    """
    try:
        # Normalize / default language
        lang = preferred_lang or "en"

        # Assemble single instance for read (parent + overrides + per-user annotations)
        event_details = await get_event_instance_for_read_by_id(
            instance_id,
            uid=uid,
            preferred_lang=lang,
            favorites_event_ids=favorite_events or [],
        )

        if not event_details:
            mins = await list_ministries()
            return {
                "success": False,
                "msg": "Event instance not found or not available.",
                "event_details": None,
                "sister_details": [],
                "ministries": mins,
            }
        
        sister_details = await get_sister_upcoming_identifiers(event_details.get("event_id"), event_details.get("id"))

        if not sister_details:
            mins = await list_ministries()
            return {
                "success": True,
                "msg": "OK",
                "event_details": event_details,
                "sister_details": [],
                "ministries": mins,
            }


        mins = await list_ministries()
        return {
            "success": True,
            "msg": "OK",
            "event_details": event_details,
            "sister_details": sister_details,
            "ministries": mins,
        }
    except Exception as e:
        logging.exception("get_instance_details failed: %s", e)
        mins = await list_ministries()
        return {
            "success": False,
            "msg": "Failed to fetch event instance details due to some exception!",
            "event_details": None,
            "sister_details": [],
            "ministries": mins,
        }




    
