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
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
PRIMARY_CHANNEL_ID = os.getenv("PRIMARY_CHANNEL_ID")
PUBLIC_DOMAIN = os.getenv("PUBLIC_DOMAIN")

#Notif sub delay is how often we will send another request to subscribe to pubsub notifications in seconds. The value chosen by default, currently is 86400 seconds, or once per day.
NOTIF_SUB_DELAY = 86400

HUB_URL = "https://pubsubhubbub.appspot.com/subscribe"
CALLBACK_URL = f"{PUBLIC_DOMAIN}/api/v1/webhook_listener/youtube_listener/live"

youtubeClient = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)




class YoutubeHelper:

    isStreaming = False
    activeStreamIDs = []

    #Currently does nothing, but this function is where we could send the notifications to the frontend
    @staticmethod
    def pushNotifications():
        # Send a push with the current values of YoutubeHelper.currentlyStreaming and YoutubeHelper.activeStreamIDs
        # You do not need to check for the values, by this point it is already done for you.
        # You can implement this function somewhere else, this is just for the sake of it.
        print(f"NOTIFICATIONS NEEDED TEST PRINTOUT\nisStreaming: {YoutubeHelper.isStreaming}\nactiveStreamIDs: {YoutubeHelper.activeStreamIDs}")
        pass

    @staticmethod
    async def updateMainChannel():
        #Make an API check to the primary channel
        streamInfo = YoutubeHelper.checkYoutubeChannel(PRIMARY_CHANNEL_ID)
        notificationsNeeded = False

        #First, collect all streamIDs that are present in our active stream IDs but not in the API check we made.
        #This represents livestreams that are no longer active.
        oldStreamIDs = []
        for streamID in YoutubeHelper.activeStreamIDs:
            if streamID not in streamInfo['streamIDs']:
                oldStreamIDs.append(streamID)

        #Remove all of these inactive livestreams from the active list.
        for streamID in oldStreamIDs:
            if streamID in YoutubeHelper.activeStreamIDs:
                YoutubeHelper.activeStreamIDs.remove(streamID)

        #For all new streams that appear in the API check we don't yet know about, add them to our list of active stream IDs
        for streamID in streamInfo['streamIDs']:
            if streamID not in YoutubeHelper.activeStreamIDs:
                YoutubeHelper.activeStreamIDs.append(streamID)
                #Only in the case of a new stream going live do we need to send a notification out
                notificationsNeeded = True

        YoutubeHelper.isStreaming = streamInfo['isStreaming']

        if notificationsNeeded:
            YoutubeHelper.pushNotifications()

    #The function checkYoutubeChannel returns a dictionary with 2 keys.
    #isStreaming is a boolean, a simple true/false that will tell you if your requested channel is currently streaming
    #streamLink is a string, it will send a link to the livestream. It will return None if the channel is not currently streaming.
    @staticmethod
    def checkYoutubeChannel(channelID):

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
        async with httpx.AsyncClient() as client:
            data = {
                "hub.mode": "subscribe",
                "hub.topic": f"https://www.youtube.com/xml/feeds/videos.xml?channel_id={PRIMARY_CHANNEL_ID}",
                "hub.callback": CALLBACK_URL,
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