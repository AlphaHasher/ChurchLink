from dotenv import load_dotenv
import os
from googleapiclient.discovery import build

load_dotenv()
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
SSBC_YOUTUBE_CHANNEL_ID = os.getenv("SSBC_YOUTUBE_CHANNEL_ID")

youtubeClient = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)

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


# Test Code Below:
print(checkYoutubeChannel("UCeY0bbntWzzVIaj2z3QigXg"))