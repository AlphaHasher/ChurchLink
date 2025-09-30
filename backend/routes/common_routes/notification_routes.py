
from fastapi import APIRouter, Body
from helpers.NotificationHelper import (
    update_notification_settings as helper_update_notification_settings,
    notification_history as helper_notification_history,
    send_push_notification as helper_send_push_notification,
    api_schedule_notification as helper_api_schedule_notification,
    api_get_scheduled_notifications as helper_api_get_scheduled_notifications,
    api_remove_scheduled_notification as helper_api_remove_scheduled_notification,
    register_device_token as helper_register_device_token
)

from mongo.database import DB


public_notification_router = APIRouter(prefix="/notification", tags=["Notification Public Route"])
private_notification_router = APIRouter(prefix="/notification", tags=["Notification Auth Route"], dependencies=[])


@public_notification_router.post('/registerToken')
async def register_device_token(
    token: str = Body(...),
    platform: str = Body(...),
    appVersion: str = Body(...),
    userId: str = Body(default=None)
):
    return await helper_register_device_token(
        token=token,
        platform=platform,
        appVersion=appVersion,
        userId=userId
    )


@private_notification_router.post('/settings')
async def update_notification_settings(streamNotificationMessage: str = Body(...), streamNotificationTitle: str = Body(...)):
    return await helper_update_notification_settings(streamNotificationMessage, streamNotificationTitle)

@private_notification_router.get('/settings')
async def get_notification_settings():
    doc = await DB.db["settings"].find_one({"type": "youtube"})
    if doc:
        doc.pop('_id', None)
    return doc or {}

@private_notification_router.get('/history')
async def notification_history(limit: int = 100):
    return await helper_notification_history(limit)

@private_notification_router.post('/send')
async def send_push_notification(
    title: str = Body(...),
    body: str = Body(...),
    data: dict = Body(default={}),
    send_to_all: bool = Body(default=True),
    token: str = Body(default=None),
    eventId: str = Body(default=None),
    link: str = Body(default=None),
    route: str = Body(default=None),
    actionType: str = Body(default="text")
):
    return await helper_send_push_notification(title, body, data, send_to_all, token, eventId, link, route, actionType)

@private_notification_router.post('/schedule')
async def api_schedule_notification(
    title: str = Body(...),
    body: str = Body(...),
    scheduled_time: str = Body(...),
    send_to_all: bool = Body(default=True),
    token: str = Body(default=None),
    data: dict = Body(default={}),
    eventId: str = Body(default=None),
    link: str = Body(default=None),
    route: str = Body(default=None),
    actionType: str = Body(default="text")
):
    return await helper_api_schedule_notification(title, body, scheduled_time, send_to_all, token, data, eventId, link, route, actionType)

@private_notification_router.get('/scheduled')
async def api_get_scheduled_notifications():
    return await helper_api_get_scheduled_notifications()

@private_notification_router.delete('/scheduled/{notification_id}')
async def api_remove_scheduled_notification(notification_id: str):
    return await helper_api_remove_scheduled_notification(notification_id)