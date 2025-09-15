from fastapi import APIRouter, Request, Query, Response
from helpers.youtubeHelper import YoutubeHelper

youtube_router = APIRouter(prefix="/youtube_listener")


#Youtube may send a notif subscription verification challenge. This route handles that to handle the challenge
@youtube_router.get("/live")
async def youtube_webhook_listener(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_topic: str = Query(..., alias="hub.topic"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
    hub_lease_seconds: int = Query(..., alias="hub.lease_seconds"),
):
    if hub_mode == "subscribe":
        return Response(content=hub_challenge, media_type="text/plain")
    
    return {"message": "Invalid request"}

#This route is where the pubsub notification comes in to notify us of a livestream detection. When a notification is received, we know we need to check for livestreams.
@youtube_router.post("/live")
async def youtube_live_callback(request: Request):
    await YoutubeHelper.updateMainChannel()

    return "OK"