from fastapi import APIRouter, Request
import xml.etree.ElementTree as ET

youtube_router = APIRouter(prefix="/youtube_listener")


#Youtube may send a notif subscription verification challenge. This route handles that to handle the challenge
@youtube_router.get("/live")
async def verify_subscription(hub_mode: str, hub_challenge: str, hub_topic: str):
    if hub_mode == "subscribe":
        return hub_challenge
    return "Invalid request"

#This route is where the pubsub notification comes in to notify us of a livestream detection
@youtube_router.post("/live")
async def youtube_live_callback(request: Request):
    data = await request.body()
    xml_data = ET.fromstring(data.decode("utf-8"))

    for entry in xml_data.findall("{http://www.w3.org/2005/Atom}entry"):
        video_id = entry.find("{http://www.w3.org/2005/Atom}id").text
        print(f"A Live Stream has Started with {video_id}")

    return "OK"