from fastapi import APIRouter, HTTPException, status
from models.event import create_event, EventCreate, get_event_by_id, update_event, delete_event
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler

async def process_create_event(event: EventCreate, uid:str):
    # Verify Event has Roles Attached
    if len(event.roles) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating event: No Roles Attached to Event")
    # Find user in mongo
    user = await UserHandler.find_by_uid(uid)
    # Return failure if no user found
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating event: Unable to Verify User")
    # Gather user permissions
    user_perms = await RoleHandler.infer_permissions(user['roles'])
    # If user is not an Admin, Event Manager, or Event Editor, refuse
    if not user_perms['admin'] and not user_perms['event_editing'] and not user_perms['event_management']:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating event: Invalid Permissions")
    # Verify user has permissions to include all requested event locks
    if not user_perms['admin'] and not user_perms['event_management']:
        for role in event.roles:
            if role not in user['roles']:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating event: Tried to add a Permission Role you do not have access to")


    created_event = await create_event(event)
    if created_event is None:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating event (maybe duplicate name/data?)")
    return created_event

async def process_edit_event(event_id: str, event: EventCreate, uid:str):
    # Verify Event has Roles Attached
    if len(event.roles) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: No Roles Attached to Event")
    # Find user in mongo
    user = await UserHandler.find_by_uid(uid)
    # Return failure if no user found
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Unable to Verify User")
    # Gather user permissions
    user_perms = await RoleHandler.infer_permissions(user['roles'])
    # If user is not an Admin, Event Manager, or Event Editor, refuse
    if not user_perms['admin'] and not user_perms['event_editing'] and not user_perms['event_management']:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Invalid Permissions")
    
    # Find event in mongo
    old_event = await get_event_by_id(event_id)
    if old_event is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Unable to find original event")
    
    # Verify user has at least one permission needed to modify event
    if not user_perms['admin'] and not user_perms['event_management']:
        perms_found = False
        for role in old_event.roles:
            if role in user['roles']:
                perms_found = True
                break
        if not perms_found:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: User Does Not Have Permissions Access to Event")
    
    # Verify that if event roles changed user has permissions
    if (event.roles != old_event.roles) and (not user_perms['admin'] and not user_perms['event_management']):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Only an Administrator or Event Manager can edit an Existing Event's Perm Roles")
    
    success = await update_event(event_id, event)
    if not success:
         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found or update failed")
    return {"message": "Event updated successfully", "success": True}

async def process_delete_event(event_id:str, uid:str):

    # Find user in mongo
    user = await UserHandler.find_by_uid(uid)
    # Return failure if no user found
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Unable to Verify User")
    # Gather user permissions
    user_perms = await RoleHandler.infer_permissions(user['roles'])
    # If user is not an Admin, Event Manager, or Event Editor, refuse
    if not user_perms['admin'] and not user_perms['event_editing'] and not user_perms['event_management']:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Invalid Permissions")
    
    # Find event in mongo
    old_event = await get_event_by_id(event_id)
    if old_event is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: Unable to find original event")
    
    # Verify user has at least one permission needed to modify event
    if not user_perms['admin'] and not user_perms['event_management']:
        perms_found = False
        for role in old_event.roles:
            if role in user['roles']:
                perms_found = True
                break
        if not perms_found:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error editing event: User Does Not Have Permissions Access to Event")
    
    success = await delete_event(event_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return {"message": "Event deleted successfully", "success": True}

