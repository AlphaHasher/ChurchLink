import asyncio
import logging
from datetime import datetime
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from firebase_admin import messaging

NOTIFICATIONS_COLLECTION = "notifications"

async def schedule_notification(db: AsyncIOMotorDatabase, data: dict) -> str:
    """
    Schedule a notification to be sent at a future date/time.
    data should include: title, message, scheduled_time (ISO string), target (all/single), fcm_token (optional)
    """
    data["created_at"] = datetime.utcnow().isoformat()
    data["sent"] = False
    result = await db[NOTIFICATIONS_COLLECTION].insert_one(data)
    return str(result.inserted_id)

async def get_scheduled_notifications(db: AsyncIOMotorDatabase) -> List[dict]:
    """Return all notifications that are scheduled but not sent."""
    cursor = db[NOTIFICATIONS_COLLECTION].find({"sent": False})
    return await cursor.to_list(length=100)

async def remove_scheduled_notification(db: AsyncIOMotorDatabase, notification_id: str) -> bool:
    """Remove a scheduled notification by its ID."""
    result = await db[NOTIFICATIONS_COLLECTION].delete_one({"_id": ObjectId(notification_id)})
    return result.deleted_count > 0

async def get_due_notifications(db: AsyncIOMotorDatabase) -> List[dict]:
    """Return notifications whose scheduled_time <= now and not sent."""
    now = datetime.utcnow().isoformat()
    cursor = db[NOTIFICATIONS_COLLECTION].find({
        "sent": False,
        "scheduled_time": {"$lte": now}
    })
    return await cursor.to_list(length=100)

async def mark_as_sent(db: AsyncIOMotorDatabase, notification_id: str) -> bool:
    """Mark a notification as sent."""
    result = await db[NOTIFICATIONS_COLLECTION].update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"sent": True, "sent_at": datetime.utcnow().isoformat()}}
    )
    return result.modified_count > 0

async def scheduled_notification_loop(db: AsyncIOMotorDatabase):
    """Background loop to process and send scheduled notifications."""
    logging.info("Scheduled notification loop started")
    while True:
        try:
            due_notifications = await get_due_notifications(db)
            logging.info(f"Found {len(due_notifications)} due notifications.")
            for notif in due_notifications:
                logging.info(f"Processing notification: id={notif.get('_id')}, title={notif.get('title')}, sent={notif.get('sent')}, scheduled_time={notif.get('scheduled_time')}")
                if notif.get("sent"):
                    logging.info("Notification already sent, skipping.")
                    continue
                title = notif.get("title")
                body = notif.get("body")
                data = notif.get("data", {})
                send_to_all = notif.get("send_to_all", True)
                token = notif.get("token")
                responses = []
                if send_to_all:
                    tokens_cursor = db['fcm_tokens'].find({}, {'_id': 0, 'token': 1})
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
                elif token:
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
                        responses.append({"token": token, "response": response})
                    except Exception as e:
                        logging.error(f"FCM error for token {token}: {e}")
                        responses.append({"token": token, "error": str(e)})
                # Mark as sent
                await mark_as_sent(db, str(notif["_id"]))
            await asyncio.sleep(10)  # Check every 10 seconds
        except Exception:
            logging.error("Scheduled notification loop error:", exc_info=True)
            await asyncio.sleep(30)