
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from mongo.database import get_db
import os

router = APIRouter()

class NotificationSettings(BaseModel):
    YOUTUBE_API_KEY: str
    PRIMARY_CHANNEL_ID: str
    PUBLIC_DOMAIN: str
    STREAM_NOTIFICATION_MESSAGE: str
    YOUTUBE_TIMEZONE: str

def get_env_settings():
    env_override = os.getenv("YOUTUBE_ENV_OVERRIDE", "true").lower() == "true"
    env_api_key = os.getenv("YOUTUBE_API_KEY")
    env_channel_id = os.getenv("PRIMARY_CHANNEL_ID")
    env_public_domain = os.getenv("PUBLIC_DOMAIN")
    env_stream_message = os.getenv("STREAM_NOTIFICATION_MESSAGE")
    env_timezone = os.getenv("YOUTUBE_TIMEZONE", "America/Los_Angeles")
    if env_override and env_api_key and env_channel_id and env_public_domain:
        return {
            "YOUTUBE_API_KEY": env_api_key,
            "PRIMARY_CHANNEL_ID": env_channel_id,
            "PUBLIC_DOMAIN": env_public_domain,
            "STREAM_NOTIFICATION_MESSAGE": env_stream_message or "A new stream is live!",
            "YOUTUBE_TIMEZONE": env_timezone,
            "envOverride": True
        }
    return None

@router.get("/settings/notification")
async def get_notification_settings():
    env_settings = get_env_settings()
    if env_settings:
        return env_settings
    db = get_db()
    settings = await db.settings.find_one({"_id": "notification"})
    if not settings:
        return {
            "YOUTUBE_API_KEY": "",
            "PRIMARY_CHANNEL_ID": "",
            "PUBLIC_DOMAIN": "",
            "STREAM_NOTIFICATION_MESSAGE": "A new stream is live!",
            "YOUTUBE_TIMEZONE": "America/Los_Angeles",
            "envOverride": False
        }
    return {
        "YOUTUBE_API_KEY": settings.get("YOUTUBE_API_KEY", ""),
        "PRIMARY_CHANNEL_ID": settings.get("PRIMARY_CHANNEL_ID", ""),
        "PUBLIC_DOMAIN": settings.get("PUBLIC_DOMAIN", ""),
        "STREAM_NOTIFICATION_MESSAGE": settings.get("STREAM_NOTIFICATION_MESSAGE", "A new stream is live!"),
        "YOUTUBE_TIMEZONE": settings.get("YOUTUBE_TIMEZONE", "America/Los_Angeles"),
        "envOverride": False
    }

@router.post("/settings/notification")
async def update_notification_settings(payload: NotificationSettings):
    env_override = os.getenv("YOUTUBE_ENV_OVERRIDE", "true").lower() == "true"
    env_settings = get_env_settings()
    if env_override and env_settings:
        raise HTTPException(status_code=403, detail="Settings are managed in .env. Edit .env or disable override to allow editing from frontend.")
    db = get_db()
    await db.settings.update_one(
        {"_id": "notification"},
        {"$set": payload.dict()},
        upsert=True
    )
    return {"success": True}
