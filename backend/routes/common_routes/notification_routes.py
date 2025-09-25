from fastapi import APIRouter, Body
from mongo.database import DB
from firebase_admin import messaging
from mongo.scheduled_notifications import (
    schedule_notification, get_scheduled_notifications, remove_scheduled_notification, get_notification_history, log_notification
)
from pydantic import BaseModel

class FCMTokenRequest(BaseModel):
    user_id: str
    token: str

# Mod Protected Router from main
# Consider changing to PermProtectedRouter down the line if perm is added
public_notification_router = APIRouter(prefix="/notification", tags=["Notification Public Route"])
private_notification_router = APIRouter(prefix="/notification", tags=["Notification Auth Route"], dependencies=[])

# PUBLIC ROUTES
# --- FCM Token Management (Public) ---
@public_notification_router.post('/save-fcm-token')
async def save_fcm_token(request: FCMTokenRequest):
    result = await DB.db['fcm_tokens'].update_one(
        {'user_id': request.user_id},
        {'$set': {'token': request.token}},
        upsert=True
    )
    return {"success": True, "matched": result.matched_count, "modified": result.modified_count}

# Mod Protected Router
@private_notification_router.get('/get-fcm-tokens')
async def get_fcm_tokens():
    tokens = await DB.db['fcm_tokens'].find({}, {'_id': 0, 'token': 1, 'user_id': 1}).to_list(length=1000)
    return tokens

# --- Notification Settings ---

# Mod Protected Router
@private_notification_router.get('/settings')
async def get_notification_settings():
    doc = await DB.db["settings"].find_one({"type": "youtube"})
    return {
        "streamNotificationMessage": doc.get("streamNotificationMessage", "A new stream is live!") if doc else "A new stream is live!",
        "streamNotificationTitle": doc.get("streamNotificationTitle", "YouTube Live Stream") if doc else "YouTube Live Stream"
    }

# Mod Protected Router
# Add POST endpoint to update notification settings
@private_notification_router.post('/settings')
async def update_notification_settings(
    streamNotificationMessage: str = Body(...),
    streamNotificationTitle: str = Body(...)
):
    result = await DB.db["settings"].update_one(
        {"type": "youtube"},
        {"$set": {
            "streamNotificationMessage": streamNotificationMessage,
            "streamNotificationTitle": streamNotificationTitle
        }},
        upsert=True
    )
    return {"success": True, "matched": result.matched_count, "modified": result.modified_count}

# Mod Protected Router
# --- Notification History ---
@private_notification_router.get('/history')
async def notification_history(limit: int = 100):
    history = await get_notification_history(DB.db, limit)
    for n in history:
        if '_id' in n:
            n['_id'] = str(n['_id'])
    return history

# Mod Protected Router
# --- Send Push Notification (Instant) ---
@private_notification_router.post('/send')
async def send_push_notification(
    title: str = Body(...),
    body: str = Body(...),
    data: dict = Body(default={}),
    send_to_all: bool = Body(default=True),
    token: str = Body(default=None),
    # Deep linking fields
    tab: str = Body(default=None),
    eventId: str = Body(default=None),
    link: str = Body(default=None),
    route: str = Body(default=None),
    actionType: str = Body(default="text")
):
    responses = []
    target = data.get('target', 'all')
    query = {}
    if send_to_all:
        if target == 'anonymous':
            query = {'user_id': 'anonymous'}
        elif target == 'logged_in':
            query = {'user_id': {'$ne': 'anonymous'}}
        tokens_cursor = DB.db['fcm_tokens'].find(query, {'_id': 0, 'token': 1})
        tokens = [doc['token'] for doc in await tokens_cursor.to_list(length=1000) if doc.get('token')]
        for t in tokens:
            # Enhanced data payload for deep linking
            enhanced_data = {
                **data,
                # Add explicit deep linking fields
                **({"tab": str(tab)} if tab is not None else {}),
                **({"eventId": str(eventId)} if eventId is not None else {}),
                **({"link": str(link)} if link is not None else {}),
                **({"route": str(route)} if route is not None else {}),
                **({"actionType": str(actionType)} if actionType is not None else {}),
                # Ensure string conversion for FCM compatibility
                **{k: str(v) if v is not None else None for k, v in data.items()}
            }
            
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                token=t,
                data=enhanced_data
            )
            try:
                response = messaging.send(message)
                responses.append({"token": t, "response": response})
            except Exception as e:
                responses.append({"token": t, "error": str(e)})
                
                # If token is invalid, remove it from database
                if "not found" in str(e).lower() or "invalid" in str(e).lower() or "expired" in str(e).lower():
                    await DB.db['fcm_tokens'].delete_many({"token": t})
        await log_notification(DB.db, title, body, "mobile", tokens, data.get("actionType"), data.get("link"), data.get("route"))
        return {"success": True, "results": responses, "count": len(tokens)}
    elif token:
        # Enhanced data payload for deep linking
        enhanced_data = {
            **data,
            # Add explicit deep linking fields
            **({"tab": str(tab)} if tab is not None else {}),
            **({"eventId": str(eventId)} if eventId is not None else {}),
            **({"link": str(link)} if link is not None else {}),
            **({"route": str(route)} if route is not None else {}),
            **({"actionType": str(actionType)} if actionType is not None else {}),
            # Ensure string conversion for FCM compatibility
            **{k: str(v) if v is not None else None for k, v in data.items()}
        }
        
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            token=token,
            data=enhanced_data
        )
        try:
            response = messaging.send(message)
            return {"success": True, "response": response}
        except Exception as e:
            # If token is invalid, remove it from database
            if "not found" in str(e).lower() or "invalid" in str(e).lower() or "expired" in str(e).lower():
                await DB.db['fcm_tokens'].delete_many({"token": token})
            return {"success": False, "error": str(e)}
    else:
        return {"success": False, "error": "No token provided and send_to_all is False."}

# Mod Protected Router
# --- Schedule Notification ---
@private_notification_router.post('/schedule')
async def api_schedule_notification(
    title: str = Body(...),
    body: str = Body(...),
    scheduled_time: str = Body(...),
    send_to_all: bool = Body(default=True),
    token: str = Body(default=None),
    data: dict = Body(default={}),
    # Deep linking fields
    tab: str = Body(default=None),
    eventId: str = Body(default=None),
    link: str = Body(default=None),
    route: str = Body(default=None),
    actionType: str = Body(default="text")
):
    # Enhanced data payload for deep linking
    enhanced_data = {
        **data,
        # Add explicit deep linking fields
        **({"tab": str(tab)} if tab is not None else {}),
        **({"eventId": str(eventId)} if eventId is not None else {}),
        **({"link": str(link)} if link is not None else {}),
        **({"route": str(route)} if route is not None else {}),
        **({"actionType": str(actionType)} if actionType is not None else {}),
        # Ensure string conversion for FCM compatibility
        **{k: str(v) if v is not None else None for k, v in data.items()}
    }
    
    payload = {
        "title": title,
        "body": body,
        "scheduled_time": scheduled_time,
        "send_to_all": send_to_all,
        "token": token,
        "data": enhanced_data,
        "sent": False
    }
    notification_id = await schedule_notification(DB.db, payload)
    return {"success": True, "id": notification_id}

# Mod Protected Router
# --- List Scheduled Notifications ---
@private_notification_router.get('/scheduled')
async def api_get_scheduled_notifications():
    notifications = await get_scheduled_notifications(DB.db)
    for n in notifications:
        if '_id' in n:
            n['_id'] = str(n['_id'])
    return notifications

# Mod Protected Router
# --- Remove Scheduled Notification ---
@private_notification_router.delete('/scheduled/{notification_id}')
async def api_remove_scheduled_notification(notification_id: str):
    success = await remove_scheduled_notification(DB.db, notification_id)
    return {"success": success}
