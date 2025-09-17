from fastapi import APIRouter
from helpers.youtubeHelper import YoutubeHelper

public_youtube_router = APIRouter(prefix="/youtube", tags=["Public YouTube"])

# Public Router
# This endpoint will return a list of valid stream ids
@public_youtube_router.get("/livestreams")
async def youtube_fetch_livestreams():
    stream_ids = YoutubeHelper.activeStreamIDs
    return {"status":200, "stream_ids":stream_ids}

# Public Router
# This endpoint will swiftly fetch the ID of the current tracked channel
@public_youtube_router.get("/channel_id")
async def fetch_channel_id():
    channel_id = YoutubeHelper.default_settings['PRIMARY_CHANNEL_ID']
    return {'status':200, 'channel_id':channel_id}