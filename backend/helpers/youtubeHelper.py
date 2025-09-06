from dotenv import load_dotenv
import os
import httpx
from googleapiclient.discovery import build
import asyncio
from datetime import datetime
from mongo.database import DB
from firebase_admin import messaging
import logging


async def load_youtube_settings():
    load_dotenv()
    # Load from .env
    settings = {
        "YOUTUBE_API_KEY": os.getenv("YOUTUBE_API_KEY"),
        "PRIMARY_CHANNEL_ID": os.getenv("PRIMARY_CHANNEL_ID"),
        "PUBLIC_DOMAIN": os.getenv("PUBLIC_DOMAIN"),
        "YOUTUBE_TIMEZONE": os.getenv("YOUTUBE_TIMEZONE"),
    }
    # Notification message/title only from DB (with defaults)
    try:
        db_settings = await DB.db["settings"].find_one({"type": "youtube"})
        settings["STREAM_NOTIFICATION_MESSAGE"] = db_settings.get("STREAM_NOTIFICATION_MESSAGE", "A new stream is live!") if db_settings else "A new stream is live!"
        settings["STREAM_NOTIFICATION_TITLE"] = db_settings.get("STREAM_NOTIFICATION_TITLE", "YouTube Live Stream") if db_settings else "YouTube Live Stream"
    except Exception as e:
        logging.error(f"Could not load YouTube notification message/title from DB: {e}")
        settings["STREAM_NOTIFICATION_MESSAGE"] = "A new stream is live!"
        settings["STREAM_NOTIFICATION_TITLE"] = "YouTube Live Stream"
    return settings


def get_youtube_client(api_key):
    return build("youtube", "v3", developerKey=api_key)

def get_callback_url(public_domain):
    return f"{public_domain}/api/v1/webhook_listener/youtube_listener/live"

NOTIF_SUB_DELAY = 86400
HUB_URL = "https://pubsubhubbub.appspot.com/subscribe"




class YoutubeHelper:

    isStreaming = False
    activeStreamIDs = []

    #Currently does nothing, but this function is where we could send the notifications to the frontend
    @staticmethod
    async def pushNotifications():
        try:
            yt_settings = await load_youtube_settings()
            notification = {
                "isStreaming": YoutubeHelper.isStreaming,
                "activeStreamIDs": YoutubeHelper.activeStreamIDs,
                "timestamp": datetime.utcnow(),
                "message": yt_settings.get("STREAM_NOTIFICATION_MESSAGE", "A new stream is live!")
            }
            # Use asyncio.create_task for async insert
            asyncio.create_task(DB.insert_document("notifications", notification))

            # Send push notification to all users
            tokens_cursor = DB.db['fcm_tokens'].find({}, {'_id': 0, 'token': 1})
            tokens = [doc['token'] for doc in await tokens_cursor.to_list(length=1000) if doc.get('token')]
            for t in tokens:
                message = messaging.Message(
                    notification=messaging.Notification(
                        title=yt_settings.get("STREAM_NOTIFICATION_TITLE", "YouTube Live Stream"),
                        body=notification["message"],
                    ),
                    token=t,
                    data={
                        "link": f"https://www.youtube.com/watch?v={YoutubeHelper.activeStreamIDs[-1]}" if YoutubeHelper.activeStreamIDs else "",
                        "actionType": "link",
                        "isStreaming": str(YoutubeHelper.isStreaming),
                        "streamIDs": ",".join(YoutubeHelper.activeStreamIDs),
                        "timestamp": notification["timestamp"].isoformat() if hasattr(notification["timestamp"], "isoformat") else str(notification["timestamp"]),
                    }
                )
                try:
                    response = messaging.send(message)
                    logging.info(f"FCM response for token {t}: {response}")
                except Exception as e:
                    logging.error(f"FCM error for token {t}: {e}")
        except Exception as e:
            logging.error(f"Error saving notification to MongoDB or sending push: {e}")

        # Trigger frontend updates (placeholder)
        logging.info(f"NOTIFICATIONS PUSHED\nisStreaming: {YoutubeHelper.isStreaming}\nactiveStreamIDs: {YoutubeHelper.activeStreamIDs}")
        yt_settings = await load_youtube_settings()
        logging.info(f"Notification message: {yt_settings.get('STREAM_NOTIFICATION_MESSAGE', 'A new stream is live!')}")

    @staticmethod
    async def updateMainChannel():
        settings = await load_youtube_settings()
        api_key = settings["YOUTUBE_API_KEY"]
        channel_id = settings["PRIMARY_CHANNEL_ID"]
        youtubeClient = get_youtube_client(api_key)
        streamInfo = YoutubeHelper.checkYoutubeChannel(channel_id, youtubeClient)
        notificationsNeeded = False

        oldStreamIDs = [streamID for streamID in YoutubeHelper.activeStreamIDs if streamID not in streamInfo['streamIDs']]
        for streamID in oldStreamIDs:
            if streamID in YoutubeHelper.activeStreamIDs:
                YoutubeHelper.activeStreamIDs.remove(streamID)
        for streamID in streamInfo['streamIDs']:
            if streamID not in YoutubeHelper.activeStreamIDs:
                YoutubeHelper.activeStreamIDs.append(streamID)
                notificationsNeeded = True
        YoutubeHelper.isStreaming = streamInfo['isStreaming']
        if notificationsNeeded:
            await YoutubeHelper.pushNotifications()

    #The function checkYoutubeChannel returns a dictionary with 2 keys.
    #isStreaming is a boolean, a simple true/false that will tell you if your requested channel is currently streaming
    #streamLink is a string, it will send a link to the livestream. It will return None if the channel is not currently streaming.
    @staticmethod
    def checkYoutubeChannel(channelID, youtubeClient):
        retDict = {"isStreaming":False, "streamIDs": []}
        request = youtubeClient.search().list(
            part="id",
            channelId=channelID,
            eventType="live",
            type="video"
        )
        response = request.execute()
        if "items" in response and len(response["items"]) > 0:
            for item in response["items"]:
                retDict["streamIDs"].append(item["id"]["videoId"])
            retDict["isStreaming"] = True
        return retDict

    #This function sends the request to subscribe to the pubsubhub notifications.
    @staticmethod
    async def subscribeToMainNotifications():
        settings = await load_youtube_settings()
        channel_id = settings["PRIMARY_CHANNEL_ID"]
        callback_url = get_callback_url(settings["PUBLIC_DOMAIN"])
        async with httpx.AsyncClient() as client:
            data = {
                "hub.mode": "subscribe",
                "hub.topic": f"https://www.youtube.com/xml/feeds/videos.xml?channel_id={channel_id}",
                "hub.callback": callback_url,
                "hub.lease_seconds": 864000,  # 10 days
            }
            try:
                response = await client.post(HUB_URL, data=data)
                logging.info("Sent request to subscribe to YouTube Notifications")
                return True
            except Exception as e:
                logging.error(f"Error subscribing to notifications: {e}")
                return False

    #This function will run continuously to ensure that we are always subscribed to YouTube notifications
    #It will try to subscribe for all seconds described in NOTIF_SUB_DELAY, and when the server is first launched.
    #If there is ever a FAILURE in subscribing to notifications, the server will try to check every 10 seconds instead, until it reads a success.
    @staticmethod
    async def youtubeSubscriptionLoop():
        while True:
            SubSuccess = await YoutubeHelper.subscribeToMainNotifications()
            while SubSuccess == False:
                await asyncio.sleep(10)
                SubSuccess = await YoutubeHelper.subscribeToMainNotifications()
            await asyncio.sleep(NOTIF_SUB_DELAY)