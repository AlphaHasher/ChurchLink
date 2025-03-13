from dotenv import load_dotenv
import os
import requests
from googleapiclient.discovery import build


load_dotenv()

#Loads Some necessary stuff from the ENV
#YOUTUBE_API_KEY, is naturally the API key used to handle the requests, based on the project.churchlink@gmail.com email address
#Each YouTube channel has a more "cryptic" id in a way, think of this like how discord has the integer ID in addition to the usernames, the YouTube API utilizes these IDs, so it's helpful to have the main ID loaded as it is the primarily used channel
#You can use various websites to get YouTube channel ID from Youtube @ links for testing purposes
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
PRIMARY_CHANNEL_ID = os.getenv("PRIMARY_CHANNEL_ID")

youtubeClient = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)



class YoutubeHelper:
    #The function checkYoutubeChannel returns a dictionary with 2 keys.
    #isStreaming is a boolean, a simple true/false that will tell you if your requested channel is currently streaming
    #streamLink is a string, it will send a link to the livestream. It will return None if the channel is not currently streaming.
    def checkYoutubeChannel(channelID):

        retDict = {"isStreaming":False, "streamLink":None}

        request = youtubeClient.search().list(
            part="id",
            channelId=channelID,
            eventType="live",
            type="video"
        )
        response = request.execute()

        if "items" in response and len(response["items"]) > 0:
            video_id = response["items"][0]["id"]["videoId"]
            retDict["isStreaming"] = True
            retDict["streamLink"] = f"https://www.youtube.com/watch?v={video_id}"
        
        return retDict


    # Test Code Below, uncomment and optionally replace the channel ID with a livestreaming channel to check:
    # This will be deleted later, it was just used by me to ensure that the API call functions
    #print(checkYoutubeChannel(PRIMARY_CHANNEL_ID))


    def subscribeToMainNotifications():
        HUB_URL = "https://pubsubhubbub.appspot.com/subscribe"
        CALLBACK_URL = "https://yourdomain.com/youtube/live"
        data = {
        "hub.mode": "subscribe",
        "hub.topic": f"https://www.youtube.com/xml/feeds/videos.xml?channel_id={PRIMARY_CHANNEL_ID}",
        "hub.callback": CALLBACK_URL,
        "hub.lease_seconds": 864000,  # 10 days
        }
        response = requests.post(HUB_URL, data=data)
        print(response.status_code, response.text)

    subscribeToMainNotifications()