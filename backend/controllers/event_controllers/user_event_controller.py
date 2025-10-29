from fastapi import Request
from mongo.churchuser import UserHandler
from models.event import get_event_doc_by_id

async def process_add_favorite_event(request: Request, event_id: str):

    # Validate that a particular event exists
    event_doc = await get_event_doc_by_id(event_id)
    if not event_doc:
        return {'success':False, 'msg':f'Could not add event to favorites! Error: Could not find event with id {event_id}'}
    
    favorite_events = request.state.user.get("favorite_events")
    if event_id not in favorite_events:
        favorite_events.append(event_id)

    modified = await UserHandler.update_user({"uid": request.state.uid}, {"favorite_events":favorite_events})

    if not modified:
        return {'success':False, 'msg':f'Could not add event to favorites! Error in applying event updates'}
    
    return {'success':True, 'msg':f'Successfully added event with id {event_id} to favorites!'}

async def process_remove_favorite_event(request:Request, event_id: str):
    
    # Validate that a particular event is actually already favorited
    favorite_events = request.state.user.get("favorite_events")
    if event_id not in favorite_events:
        return {'success':True, 'msg':'This event was already not in your favorites, but consider result accomplished.'}
    
    favorite_events.remove(event_id)

    modified = await UserHandler.update_user({"uid": request.state.uid}, {"favorite_events":favorite_events})

    if not modified:
        return {'success':False, 'msg':f'Failed to apply updates to remove event with id {event_id} from favorite events!'}
    
    return {'success':True, 'msg':f'Successly removed event with id {event_id} from favorites!'}
    
