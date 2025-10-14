import logging
import re
import httpx
import inspect
from datetime import datetime
from mongo.database import DB
from firebase_admin import messaging
from mongo.scheduled_notifications import (
	schedule_notification, get_scheduled_notifications, remove_scheduled_notification, get_notification_history, log_notification
)


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
		tokens_cursor = DB.db['deviceTokens'].find({}, {'_id': 0, 'token': 1, 'notification_preferences': 1})
		tokens_docs = await tokens_cursor.to_list(length=1000)
		filtered_tokens = []
		for doc in tokens_docs:
			t = doc.get('token')
			prefs = doc.get('notification_preferences', {})
			allow = True  # Default allow to True
			if actionType == 'event':
				allow = prefs.get('Event Notification', True)
			elif actionType in ['text', 'link', 'route']:
				allow = prefs.get('App Announcements', True)
			elif route == 'youtube_live_stream_notification':
				allow = prefs.get('Live Stream Alerts', True)
			elif actionType == 'bible_plan':
				allow = prefs.get('Bible Plan Reminders', True)
			if t and allow:
				filtered_tokens.append(t)
		for t in filtered_tokens:
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
		await log_notification(DB.db, title, body, "mobile", filtered_tokens, actionType, link, route, eventId)
		return {"success": True, "results": responses, "count": len(filtered_tokens)}
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

async def register_device_token(token, platform, appVersion, userId=None):
	# Validate required fields
	if not token or not platform or not appVersion:
		return {"success": False, "error": "Missing required fields."}

	# Compose document for upsert
	doc = {
		"token": token,
		"platform": platform,
		"appVersion": appVersion,
		"userId": userId,
		"lastSeenAt": datetime.utcnow(),
		"createdAt": datetime.utcnow(),
	}
	# Add notification_preferences if provided
	frame = inspect.currentframe()
	try:
		caller_locals = frame.f_back.f_locals
		notification_preferences = caller_locals.get('notification_preferences', None)
	finally:
		del frame
	if notification_preferences is not None:
		doc["notification_preferences"] = notification_preferences

	# If notification_preferences is provided, add/update it
	# This expects the caller to pass notification_preferences as a keyword argument
	frame = inspect.currentframe()
	try:
		# Get caller's local variables
		caller_locals = frame.f_back.f_locals
		notification_preferences = caller_locals.get('notification_preferences', None)
	finally:
		del frame

	if notification_preferences is not None:
		doc["notification_preferences"] = notification_preferences

	await DB.db["deviceTokens"].update_one({"token": token}, {"$set": doc}, upsert=True)
	return {"success": True, "doc": doc}


# Device-based notification preferences helpers
async def fetch_device_notification_preferences(token: str):
	doc = await DB.db["deviceTokens"].find_one({"token": token})
	prefs = doc.get("notification_preferences", {}) if doc else {}
	return {"success": True, "notification_preferences": prefs}

async def update_device_notification_preferences(token: str, preferences: dict):
	# Flatten if nested structure is received from frontend
	if isinstance(preferences, dict) and 'preferences' in preferences:
		preferences = preferences['preferences']
	logging.info(f"Updating notification preferences for token: {token} with preferences: {preferences}")
	result = await DB.db["deviceTokens"].update_one(
		{"token": token},
		{"$set": {"notification_preferences": preferences}},
		upsert=True
	)
	logging.info(f"MongoDB update result: matched={result.matched_count}, modified={result.modified_count}, upserted_id={result.upserted_id}")
	updated_doc = await DB.db["deviceTokens"].find_one({"token": token})
	if updated_doc and '_id' in updated_doc:
		updated_doc['_id'] = str(updated_doc['_id'])
	logging.info(f"Updated deviceTokens document: {updated_doc}")
	return {"success": result.modified_count > 0 or result.upserted_id is not None, "doc": updated_doc}


async def send_notification_to_user(userId: str, title: str, body: str, data: dict = None, actionType: str = None, link: str = None, route: str = None, eventId: str = None):
	"""Send push notification to all devices of a specific user"""
	if data is None:
		data = {}
	
	# Get all device tokens for the user that allow the specific notification type
	query = {"userId": userId}
	if actionType:
		# Check notification preferences based on actionType
		if actionType == 'bible_plan':
			query["notification_preferences.Bible Plan Reminders"] = {"$ne": False}
		elif actionType == 'event':
			query["notification_preferences.Event Notification"] = {"$ne": False}
		elif actionType in ['text', 'link', 'route']:
			query["notification_preferences.App Announcements"] = {"$ne": False}
	
	tokens_cursor = DB.db['deviceTokens'].find(query, {'_id': 0, 'token': 1})
	tokens_docs = await tokens_cursor.to_list(length=100)
	user_tokens = [doc.get('token') for doc in tokens_docs if doc.get('token')]
	
	if not user_tokens:
		return {"success": False, "error": "No eligible device tokens found for user"}
	
	responses = []
	for token in user_tokens:
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
			responses.append({"token": token, "response": response})
		except Exception as e:
			responses.append({"token": token, "error": str(e)})
			if "not found" in str(e).lower() or "invalid" in str(e).lower() or "expired" in str(e).lower():
				await DB.db['deviceTokens'].delete_many({"token": token})
	
	await log_notification(DB.db, title, body, "mobile", user_tokens, actionType, link, route, eventId)
	return {"success": True, "results": responses, "sent_to_tokens": len(user_tokens)}


async def get_available_notification_preferences():
	"""Get all available notification preference types"""
	return {
		"success": True,
		"preferences": {
			"Event Notification": {
				"description": "Notifications for church events and activities",
				"default": True
			},
			"App Announcements": {
				"description": "General announcements and app updates",
				"default": True
			},
			"Live Stream Alerts": {
				"description": "Notifications when live streams start",
				"default": True
			},
			"Bible Plan Reminders": {
				"description": "Daily reminders for Bible reading plans",
				"default": True
			}
		}
	}