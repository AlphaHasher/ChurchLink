from dotenv import load_dotenv
import os
import httpx
from googleapiclient.discovery import build
import asyncio


load_dotenv()

#Loads Some necessary stuff from the ENV
#YOUTUBE_API_KEY, is naturally the API key used to handle the requests, based on the project.churchlink@gmail.com email address
#Each YouTube channel has a more "cryptic" id in a way, think of this like how discord has the integer ID in addition to the usernames, the YouTube API utilizes these IDs, so it's helpful to have the main ID loaded as it is the primarily used channel
#You can use various websites to get YouTube channel ID from Youtube @ links for testing purposes

# Settings loader: supports .env and dynamic overrides
def load_youtube_settings():
    from mongo.database import get_db
    env_api_key = os.getenv("YOUTUBE_API_KEY")
    env_channel_id = os.getenv("PRIMARY_CHANNEL_ID")
    env_public_domain = os.getenv("PUBLIC_DOMAIN")
    env_stream_message = os.getenv("STREAM_NOTIFICATION_MESSAGE")
    if env_api_key and env_channel_id and env_public_domain:
        return {
            "YOUTUBE_API_KEY": env_api_key,
            "PRIMARY_CHANNEL_ID": env_channel_id,
            "PUBLIC_DOMAIN": env_public_domain,
            "STREAM_NOTIFICATION_MESSAGE": env_stream_message or "A new stream is live!"
        }
    # Try to load from DB if not in env
    db = get_db()
    settings = db.settings.find_one({"_id": "notification"})
    return {
        "YOUTUBE_API_KEY": settings.get("YOUTUBE_API_KEY", ""),
        "PRIMARY_CHANNEL_ID": settings.get("PRIMARY_CHANNEL_ID", ""),
        "PUBLIC_DOMAIN": settings.get("PUBLIC_DOMAIN", ""),
        "STREAM_NOTIFICATION_MESSAGE": settings.get("STREAM_NOTIFICATION_MESSAGE", "A new stream is live!")
    } if settings else {
        "YOUTUBE_API_KEY": "",
        "PRIMARY_CHANNEL_ID": "",
        "PUBLIC_DOMAIN": "",
        "STREAM_NOTIFICATION_MESSAGE": "A new stream is live!"
    }

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
    def pushNotifications():
        # Save notification to MongoDB
        try:
            from datetime import datetime
            from mongo.database import DB, get_db
            from firebase_admin import messaging
            settings = load_youtube_settings()
            notification = {
                "isStreaming": YoutubeHelper.isStreaming,
                "activeStreamIDs": YoutubeHelper.activeStreamIDs,
                "timestamp": datetime.utcnow(),
                "message": settings.get("STREAM_NOTIFICATION_MESSAGE", "A new stream is live!")
            }
            # Use asyncio.create_task for async insert
            asyncio.create_task(DB.insert_document("notifications", notification))

            # Send push notification to all users
            db = get_db()
            tokens_cursor = db['fcm_tokens'].find({}, {'_id': 0, 'token': 1})
            tokens = [doc['token'] for doc in tokens_cursor if doc.get('token')]
            for t in tokens:
                message = messaging.Message(
                    notification=messaging.Notification(
                        title="YouTube Live Stream",
                        body=notification["message"],
                    ),
                    token=t,
                    data={
                        "link": f"https://www.youtube.com/watch?v={YoutubeHelper.activeStreamIDs[-1]}" if YoutubeHelper.activeStreamIDs else ""
                    }
                )
                try:
                    response = messaging.send(message)
                    print(f"FCM response for token {t}: {response}")
                except Exception as e:
                    print(f"FCM error for token {t}: {e}")
        except Exception as e:
            print(f"Error saving notification to MongoDB or sending push: {e}")

        # Trigger frontend updates (placeholder)
        print(f"NOTIFICATIONS PUSHED\nisStreaming: {YoutubeHelper.isStreaming}\nactiveStreamIDs: {YoutubeHelper.activeStreamIDs}")
        print(f"Notification message: {load_youtube_settings().get('STREAM_NOTIFICATION_MESSAGE', 'A new stream is live!')}")

    @staticmethod
    async def updateMainChannel():
        settings = load_youtube_settings()
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
            YoutubeHelper.pushNotifications()

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
        settings = load_youtube_settings()
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
                print("Sent request to subscribe to YouTube Notifications")
                return True
            except Exception as e:
                print(f"Error subscribing to notifications: {e}")
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