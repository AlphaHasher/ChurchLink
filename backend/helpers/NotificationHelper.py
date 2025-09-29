import logging
import re
import httpx
from datetime import datetime
from mongo.database import DB
from firebase_admin import messaging, auth as firebase_auth
from mongo.scheduled_notifications import (
	schedule_notification, get_scheduled_notifications, remove_scheduled_notification, get_notification_history, log_notification
)



async def save_fcm_token(request: dict):
		# Update by token, not just user_id, to avoid duplicate tokens
		result = await DB.db['fcm_tokens'].update_one(
			{'token': request['token']},
			{'$set': {'user_id': request['user_id']}},
			upsert=True
		)
		return {"success": True, "matched": result.matched_count, "modified": result.modified_count}

	
async def update_notification_settings(streamNotificationMessage: str, streamNotificationTitle: str):
	result = await DB.db["settings"].update_one(
		{"type": "youtube"},
		{"$set": {
			"streamNotificationMessage": streamNotificationMessage,
			"streamNotificationTitle": streamNotificationTitle
		}},
		upsert=True
	)
	return {"success": True, "matched": result.matched_count, "modified": result.modified_count}

	
async def notification_history(limit: int = 100):
	history = await get_notification_history(DB.db, limit)
	for n in history:
		if '_id' in n:
			n['_id'] = str(n['_id'])
	return history

	
async def send_push_notification(title, body, data, send_to_all, token, eventId, link, route, actionType):
	responses = []
	target = data.get('target', 'all')
	query = {}
	# Validate link if actionType is 'link'
	if actionType == "link" and link:
		error = await validate_link(link)
		if error:
			return {"success": False, "error": error}
		normalized_link = link.strip()
		if not normalized_link.startswith("http://") and not normalized_link.startswith("https://"):
			normalized_link = f"https://{normalized_link.lstrip('/')}"
		link = normalized_link
	if send_to_all:
		if target == 'anonymous':
			query = {'user_id': 'anonymous'}
		elif target == 'logged_in':
			query = {'user_id': {'$ne': 'anonymous'}}
		tokens_cursor = DB.db['fcm_tokens'].find(query, {'_id': 0, 'token': 1, 'user_id': 1})
		tokens_docs = await tokens_cursor.to_list(length=1000)
		filtered_tokens = []
		for doc in tokens_docs:
			t = doc.get('token')
			user_id = doc.get('user_id')
			if not t or not user_id:
				continue
			user = await DB.db['users'].find_one({'uid': user_id})
			prefs = (user or {}).get('notification_preferences', {})
			allow = True  # Default allow to True
			# Event Reminders: actionType == 'event' or 'navigate to event'
			if actionType == 'event':
				allow = prefs.get('Event Notification', True)
			# App Announcements: actionType in ['text', 'open link', 'open page']
			elif actionType in ['text', 'link', 'route']:
				allow = prefs.get('App Announcements', True)
			# Live Stream Alerts: route == 'youtube_live_stream_notification'
			elif route == 'youtube_live_stream_notification':
				allow = prefs.get('Live Stream Alerts', True)
			if allow:
				filtered_tokens.append(t)
		for t in filtered_tokens:
		tokens_cursor = DB.db['deviceTokens'].find(query, {'_id': 0, 'token': 1})
		tokens = [doc['token'] for doc in await tokens_cursor.to_list(length=1000) if doc.get('token')]
		for t in tokens:
			enhanced_data = {
				**{k: str(v) if v is not None else None for k, v in data.items()},
				**({"eventId": str(eventId)} if eventId is not None else {}),
				**({"link": str(link)} if link is not None else {}),
				**({"route": str(route)} if route is not None else {}),
				**({"actionType": str(actionType)} if actionType is not None else {})
			}
			message = messaging.Message(
				notification=messaging.Notification(
					title=title,
					body=body,
				),
				token=t,
				data=enhanced_data
			)
			try:
				response = messaging.send(message)
				responses.append({"token": t, "response": response})
			except Exception as e:
				responses.append({"token": t, "error": str(e)})
				if "not found" in str(e).lower() or "invalid" in str(e).lower() or "expired" in str(e).lower():
					await DB.db['deviceTokens'].delete_many({"token": t})
		await log_notification(DB.db, title, body, "mobile", tokens, actionType, link, route, eventId)
		return {"success": True, "results": responses, "count": len(tokens)}
	elif token:
		enhanced_data = {
			**{k: str(v) if v is not None else None for k, v in data.items()},
			**({"eventId": str(eventId)} if eventId is not None else {}),
			**({"link": str(link)} if link is not None else {}),
			**({"route": str(route)} if route is not None else {}),
			**({"actionType": str(actionType)} if actionType is not None else {})
		}
		message = messaging.Message(
			notification=messaging.Notification(
				title=title,
				body=body,
			),
			token=token,
			data=enhanced_data
		)
		try:
			response = messaging.send(message)
			return {"success": True, "response": response}
		except Exception as e:
			if "not found" in str(e).lower() or "invalid" in str(e).lower() or "expired" in str(e).lower():
				await DB.db['deviceTokens'].delete_many({"token": token})
			return {"success": False, "error": str(e)}
	else:
		return {"success": False, "error": "No token provided and send_to_all is False."}

	
async def api_schedule_notification(title, body, scheduled_time, send_to_all, token, data, eventId, link, route, actionType):
	if actionType == "link" and link:
		error = await validate_link(link)
		if error:
			return {"success": False, "error": error}
		normalized_link = link.strip()
		if not normalized_link.startswith("http://") and not normalized_link.startswith("https://"):
			normalized_link = f"https://{normalized_link.lstrip('/')}"
		link = normalized_link
	enhanced_data = {
		**{k: str(v) if v is not None else None for k, v in data.items()},
		**({"eventId": str(eventId)} if eventId is not None else {}),
		**({"link": str(link)} if link is not None else {}),
		**({"route": str(route)} if route is not None else {}),
		**({"actionType": str(actionType)} if actionType is not None else {})
	}
	payload = {
		"title": title,
		"body": body,
		"scheduled_time": scheduled_time,
		"send_to_all": send_to_all,
		"token": token,
		"data": enhanced_data,
		"actionType": actionType,
		"link": link,
		"route": route,
		"eventId": eventId,
		"sent": False
	}
	notification_id = await schedule_notification(DB.db, payload)
	return {"success": True, "id": notification_id}

	
async def api_get_scheduled_notifications():
	notifications = await get_scheduled_notifications(DB.db)
	for n in notifications:
		if '_id' in n:
			n['_id'] = str(n['_id'])
	return notifications

	
async def api_remove_scheduled_notification(notification_id: str):
	success = await remove_scheduled_notification(DB.db, notification_id)
	return {"success": success}


async def validate_link(link: str) -> str:
	normalized_link = link.strip()
	if not normalized_link.startswith("http://") and not normalized_link.startswith("https://"):
		normalized_link = f"https://{normalized_link.lstrip('/')}"
	file_ext_pattern = re.compile(r"\.(pdf|docx?|xlsx?|pptx?|zip|rar|jpg|jpeg|png|gif|mp4|mp3|avi|mov|txt|csv|exe|dll|js|css|html|php|py|java|c|cpp|h|json|xml|svg|webp|ico|tar|gz|7z|apk|bin|msi|bat|sh|ps1|rtf|md|log|bak|tmp|dat|db)$", re.IGNORECASE)
	if file_ext_pattern.search(normalized_link.split('?')[0]):
		return "Direct file links are not allowed."
	try:
		async with httpx.AsyncClient(timeout=5.0) as client:
			resp = await client.get(normalized_link)
			if resp.status_code < 200 or resp.status_code >= 400:
				return f"Link is not reachable: {normalized_link}"
	except Exception as e:
		return "Link validation failed. Please check the URL and try again."
	return None


async def extract_and_set_uid(request):
	"""
	Extract UID from request.state or Authorization header and set it on request.state.uid.
	"""
	uid = getattr(request.state, 'uid', None)
	if not uid:
		auth_header = request.headers.get('authorization')
		if auth_header and auth_header.lower().startswith('bearer '):
			token = auth_header.split(' ', 1)[1]
			try:
				decoded = firebase_auth.verify_id_token(token)
				uid = decoded.get('uid')
				request.state.uid = uid
			except Exception as e:
				logging.warning(f"Failed to decode Firebase token: {e}")
	else:
		request.state.uid = uid

async def fetch_notification_settings():
	settings = await DB.db["settings"].find_one({"type": "youtube"})
	if not settings:
		return {}
	return {
		"streamNotificationMessage": settings.get("streamNotificationMessage", "A new stream is live!"),
		"streamNotificationTitle": settings.get("streamNotificationTitle", "Live Stream Started"),
		"YOUTUBE_TIMEZONE": settings.get("YOUTUBE_TIMEZONE", "America/Los_Angeles"),
		"envOverride": settings.get("envOverride", False)
	}
async def register_device_token(token, platform, appVersion, userId=None):
    # Validate required fields
    if not token or not platform or not appVersion:
        return {"success": False, "error": "Missing required fields."}

    # Upsert to Firestore/mongo (example for mongo)
    doc = {
        "token": token,
        "platform": platform,
        "appVersion": appVersion,
        "userId": userId,
	"lastSeenAt": datetime.utcnow(),
	"createdAt": datetime.utcnow(),
    }
    await DB.db["deviceTokens"].update_one({"token": token}, {"$set": doc}, upsert=True)
    return {"success": True}
