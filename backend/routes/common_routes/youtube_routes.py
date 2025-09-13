from fastapi import APIRouter
from helpers.youtubeHelper import YoutubeHelper

public_youtube_router = APIRouter(prefix="/youtube", tags=["Public YouTube"])

# This endpoint will return a list of valid stream ids
@public_youtube_router.get("/livestreams")
async def youtube_fetch_livestreams():
    stream_ids = YoutubeHelper.activeStreamIDs
    return {"status":200, "stream_ids":stream_ids}