from fastapi import APIRouter, Body
from fastapi import APIRouter, Body
from firebase_admin import messaging
from firebase.firebase_credentials import get_firebase_app
from mongo.database import DB
from mongo.scheduled_notifications import (
    schedule_notification, get_scheduled_notifications, remove_scheduled_notification,
    log_notification, get_notification_history
)
import logging
router = APIRouter()


@router.get('/notification-history')
async def notification_history(limit: int = 100):
    try:
        
        history = await get_notification_history(DB.db, limit)
        # Convert ObjectId to string for each notification
        for n in history:
            if '_id' in n:
                n['_id'] = str(n['_id'])
        return history
    except Exception as e:
        import traceback
        logging.error(f"Error fetching notification history: {e}\n{traceback.format_exc()}")
        return {"error": str(e), "trace": traceback.format_exc()}


@router.post('/send-push-notification')
async def send_push_notification(
    title: str = Body(...),
    body: str = Body(...),
    data: dict = Body(default={}),
    send_to_all: bool = Body(default=True),
    token: str = Body(default=None)
):
    get_firebase_app()  # Ensure Firebase is initialized
    responses = []
    logging.info(f"Push notification request: title={title}, body={body}, data={data}, send_to_all={send_to_all}, token={token}")
    
    # Custom targeting logic
    target = data.get('target', 'all')  # 'all', 'anonymous', 'logged_in'
    query = {}
    if send_to_all:
        if target == 'anonymous':
            query = {'user_id': 'anonymous'}
        elif target == 'logged_in':
            query = {'user_id': {'$ne': 'anonymous'}}
        # else: all users
        tokens_cursor = DB.db['fcm_tokens'].find(query, {'_id': 0, 'token': 1})
        tokens = [doc['token'] for doc in await tokens_cursor.to_list(length=1000) if doc.get('token')]
        logging.info(f"Sending to tokens: {tokens}")
        for t in tokens:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                token=t,
                data=data
            )
            try:
                response = messaging.send(message)
                logging.info(f"FCM response for token {t}: {response}")
                responses.append({"token": t, "response": response})
            except Exception as e:
                logging.error(f"FCM error for token {t}: {e}")
                responses.append({"token": t, "error": str(e)})
        # Log push notification history
        await log_notification(
            DB.db,
            title,
            body,
            "mobile",
            tokens,
            data.get("actionType"),
            data.get("link"),
            data.get("route")
        )
        return {"success": True, "results": responses, "count": len(tokens)}
    elif token:
        logging.info(f"Sending to single token: {token}")
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            token=token,
            data=data
        )
        try:
            response = messaging.send(message)
            logging.info(f"FCM response for token {token}: {response}")
            return {"success": True, "response": response}
        except Exception as e:
            logging.error(f"FCM error for token {token}: {e}")
            return {"success": False, "error": str(e)}
    else:
        logging.warning("No token provided and send_to_all is False.")
        return {"success": False, "error": "No token provided and send_to_all is False."}


# Schedule a notification for future delivery
@router.post('/schedule-notification')
async def api_schedule_notification(
    title: str = Body(...),
    body: str = Body(...),
    scheduled_time: str = Body(...),
    send_to_all: bool = Body(default=True),
    token: str = Body(default=None),
    data: dict = Body(default={})
):
    payload = {
        "title": title,
        "body": body,
        "scheduled_time": scheduled_time,
        "send_to_all": send_to_all,
        "token": token,
        "data": data,
        "sent": False
    }
    notification_id = await schedule_notification(DB.db, payload)
    return {"success": True, "id": notification_id}

# List all scheduled notifications
@router.get('/scheduled-notifications')
async def api_get_scheduled_notifications():
    notifications = await get_scheduled_notifications(DB.db)
    # Convert ObjectId to string for each notification
    for n in notifications:
        if '_id' in n:
            n['_id'] = str(n['_id'])
    return notifications

# Remove a scheduled notification
@router.delete('/scheduled-notification/{notification_id}')
async def api_remove_scheduled_notification(notification_id: str):
    success = await remove_scheduled_notification(DB.db, notification_id)
    return {"success": success}
