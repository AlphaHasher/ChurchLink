import asyncio
import logging
import os
from datetime import datetime, timedelta, time
from typing import List, Dict, Optional
from bson import ObjectId
import pytz
import firebase_admin
from firebase_admin import credentials

from mongo.database import DB
from helpers.NotificationHelper import send_push_notification, send_notification_to_user, update_device_notification_preferences
from mongo.scheduled_notifications import schedule_notification, get_scheduled_notifications
from models.bible_plan_tracker import get_user_bible_plans


def ensure_firebase_initialized():
    """Ensure Firebase Admin SDK is initialized"""
    if not firebase_admin._apps:
        try:
            from firebase.firebase_credentials import get_firebase_credentials
            cred = credentials.Certificate(get_firebase_credentials())
            firebase_admin.initialize_app(cred)
            logging.info("Firebase Admin SDK initialized for Bible plan notifications")
        except Exception as e:
            logging.error(f"Failed to initialize Firebase Admin SDK: {e}")
            raise


def get_local_timezone():
    """Get the local timezone from environment variables"""
    timezone_name = os.getenv('LOCAL_TIMEZONE', 'UTC')
    try:
        return pytz.timezone(timezone_name)
    except pytz.UnknownTimeZoneError:
        logging.warning(f"Unknown timezone '{timezone_name}', falling back to UTC")
        return pytz.UTC


def get_local_now():
    """Get current time in the configured local timezone"""
    local_tz = get_local_timezone()
    return datetime.now(local_tz)


class BiblePlanNotificationManager:
    """Manages Bible plan notifications including scheduling and sending"""
    
    @staticmethod
    async def schedule_daily_bible_reminders():
        """
        Schedule daily Bible reading reminders for all users with active Bible plan subscriptions.
        This should be run once daily to schedule notifications for the next day.
        """
        logging.info("Starting daily Bible plan notification scheduling")
        
        # Ensure Firebase is initialized
        ensure_firebase_initialized()
        
        # Get all users with active Bible plan subscriptions
        active_subscriptions = await BiblePlanNotificationManager._get_active_subscriptions()
        
        scheduled_count = 0
        for subscription in active_subscriptions:
            if subscription.get('notification_enabled', True) and subscription.get('notification_time'):
                try:
                    await BiblePlanNotificationManager._schedule_user_notification(subscription)
                    scheduled_count += 1
                except Exception as e:
                    logging.error(f"Failed to schedule notification for user {subscription.get('uid')}: {e}")
        
        logging.info(f"Scheduled {scheduled_count} Bible plan notifications")
        return scheduled_count
    
    @staticmethod
    async def _get_active_subscriptions() -> List[Dict]:
        """Get all active Bible plan subscriptions with notification preferences"""
        cursor = DB.db["bible_plan_tracker"].find({
            "notification_enabled": True,
            "notification_time": {"$exists": True, "$ne": None}
        })
        return await cursor.to_list(length=None)
    
    @staticmethod
    async def _schedule_user_notification(subscription: Dict):
        """Schedule a notification for a specific user's Bible plan subscription"""
        uid = subscription.get('uid')
        plan_id = subscription.get('plan_id')
        notification_time = subscription.get('notification_time')
        start_date = subscription.get('start_date')
        progress = subscription.get('progress', [])
        
        if not all([uid, plan_id, notification_time, start_date]):
            logging.warning(f"Missing required fields for scheduling notification: {subscription}")
            return
        
        # Calculate current day in the plan
        current_day = BiblePlanNotificationManager._calculate_current_day(start_date, progress)
        
        # Get plan details
        plan_doc = await DB.db["bible_plans"].find_one({"_id": ObjectId(plan_id)})
        if not plan_doc:
            logging.warning(f"Bible plan not found: {plan_id}")
            return
        
        plan_name = plan_doc.get('name', 'Bible Reading Plan')
        readings = plan_doc.get('readings', {})
        
        # Check if there are readings for the current day
        day_readings = readings.get(str(current_day), [])
        if not day_readings:
            logging.info(f"No readings for day {current_day} in plan {plan_id}")
            return
        
        # Create notification content
        title, body = BiblePlanNotificationManager._create_notification_content(
            plan_name, current_day, day_readings
        )
        
        # Calculate scheduled time for tomorrow using user's timezone if available
        user_timezone = subscription.get('user_timezone')
        scheduled_time = BiblePlanNotificationManager._calculate_next_notification_time(
            notification_time, user_timezone
        )
        
        # Get user's device tokens
        user_tokens = await BiblePlanNotificationManager._get_user_device_tokens(uid)
        
        # Schedule notification for each device token
        for token in user_tokens:
            notification_data = {
                "title": title,
                "body": body,
                "scheduled_time": scheduled_time.isoformat(),
                "send_to_all": False,
                "token": token,
                "data": {
                    "actionType": "bible_plan",
                    "plan_id": plan_id,
                    "day": str(current_day),
                    "route": "bible_plan_reading"
                },
                "actionType": "bible_plan",
                "route": "bible_plan_reading",
                "eventId": None,
                "link": None,
                "sent": False
            }
            
            await schedule_notification(DB.db, notification_data)
    
    @staticmethod
    def _calculate_current_day(start_date: datetime, progress: List[Dict]) -> int:
        """Calculate the current day number for the Bible plan"""
        # Calculate days since start using local timezone
        now_local = get_local_now()
        # Convert start_date to local timezone if it's naive
        if start_date.tzinfo is None:
            local_tz = get_local_timezone()
            start_date = local_tz.localize(start_date)
        elif start_date.tzinfo != get_local_timezone():
            start_date = start_date.astimezone(get_local_timezone())
            
        days_since_start = (now_local.date() - start_date.date()).days + 1
        
        # If user has completed days beyond the calculated day, use the next incomplete day
        completed_days = [p.get('day', 0) for p in progress if p.get('is_completed', False)]
        
        if completed_days:
            # Find the next day that hasn't been completed
            max_completed = max(completed_days)
            return max_completed + 1
        
        # Return the calculated day based on start date
        return max(1, days_since_start)
    
    @staticmethod
    def _create_notification_content(plan_name: str, day: int, readings: List[Dict]) -> tuple:
        """Create notification title and body content"""
        title = f"Bible Reading: {plan_name} - Day {day}"
        
        if len(readings) == 1:
            reading = readings[0]
            body = f"Time for today's reading: {reading.get('reference', 'Bible reading')}"
        elif len(readings) <= 3:
            references = [r.get('reference', '') for r in readings if r.get('reference')]
            body = f"Today's readings: {', '.join(references[:3])}"
        else:
            body = f"You have {len(readings)} passages to read today. Tap to see your plan!"
        
        return title, body
    
    @staticmethod
    def _calculate_next_notification_time(notification_time: str, user_timezone: str = None) -> datetime:
        """Calculate the next notification time based on user preference and timezone"""
        try:
            # Parse time string (expected format: "HH:MM" or "HH:MM:SS")
            time_parts = notification_time.split(':')
            hour = int(time_parts[0])
            minute = int(time_parts[1]) if len(time_parts) > 1 else 0
            second = int(time_parts[2]) if len(time_parts) > 2 else 0
            
            # Use user timezone if provided, otherwise fall back to local timezone
            if user_timezone:
                try:
                    user_tz = pytz.timezone(user_timezone)
                except pytz.UnknownTimeZoneError:
                    logging.warning(f"Unknown timezone: {user_timezone}. Using local timezone as fallback.")
                    user_tz = get_local_timezone()
            else:
                user_tz = get_local_timezone()
            
            # Get current time in user's timezone
            now_utc = datetime.now(pytz.UTC)
            now_user = now_utc.astimezone(user_tz)
            
            # Create a naive datetime for today first, then localize it
            today_naive = datetime.combine(now_user.date(), time(hour, minute, second))
            today_user = user_tz.localize(today_naive)
            
            # If the time today has already passed, schedule for tomorrow
            if today_user <= now_user:
                # Time has passed today, schedule for tomorrow
                tomorrow = now_user.date() + timedelta(days=1)
                naive_datetime = datetime.combine(tomorrow, time(hour, minute, second))
                scheduled_user = user_tz.localize(naive_datetime)
            else:
                # Time hasn't passed today, schedule for today
                scheduled_user = today_user
            
            # Convert to UTC for storage in database (notification processor uses UTC)
            scheduled_utc = scheduled_user.astimezone(pytz.UTC)
            
            return scheduled_utc
        except (ValueError, IndexError) as e:
            logging.error(f"Invalid notification_time format: {notification_time}. Using 9:00 AM as default.")
            # Default to 9:00 AM, check if today has passed, otherwise tomorrow
            # Use user timezone if provided, otherwise fall back to local timezone
            if user_timezone:
                try:
                    fallback_tz = pytz.timezone(user_timezone)
                except pytz.UnknownTimeZoneError:
                    fallback_tz = get_local_timezone()
            else:
                fallback_tz = get_local_timezone()
            
            now_utc = datetime.now(pytz.UTC)
            now_user = now_utc.astimezone(fallback_tz)
            
            today_naive = datetime.combine(now_user.date(), time(9, 0, 0))
            today_user = fallback_tz.localize(today_naive)
            
            if today_user <= now_user:
                # 9 AM has passed today, schedule for tomorrow
                tomorrow = now_user.date() + timedelta(days=1)
                naive_datetime = datetime.combine(tomorrow, time(9, 0, 0))
                scheduled_user = fallback_tz.localize(naive_datetime)
            else:
                # 9 AM hasn't passed today, schedule for today
                scheduled_user = today_user
                
            scheduled_utc = scheduled_user.astimezone(pytz.UTC)
            return scheduled_utc
    
    @staticmethod
    async def _get_user_device_tokens(uid: str) -> List[str]:
        """Get all device tokens for a specific user that have Bible plan notifications enabled"""
        cursor = DB.db["deviceTokens"].find({
            "userId": uid,
            "notification_preferences.Bible Plan Reminders": {"$ne": False}
        }, {"token": 1, "_id": 0})
        
        docs = await cursor.to_list(length=None)
        return [doc.get('token') for doc in docs if doc.get('token')]
    
    @staticmethod
    async def send_immediate_bible_plan_notification(uid: str, plan_id: str, custom_message: str = None):
        """Send an immediate Bible plan notification to a specific user"""
        try:
            # Ensure Firebase is initialized
            ensure_firebase_initialized()
            
            # Get user's subscription
            subscription_doc = await DB.db["bible_plan_tracker"].find_one({
                "uid": uid,
                "plan_id": plan_id
            })
            
            if not subscription_doc:
                return {"success": False, "error": "User not subscribed to this plan"}
            
            # Get plan details
            plan_doc = await DB.db["bible_plans"].find_one({"_id": ObjectId(plan_id)})
            if not plan_doc:
                return {"success": False, "error": "Bible plan not found"}
            
            plan_name = plan_doc.get('name', 'Bible Reading Plan')
            
            # Create notification content
            if custom_message:
                title = f"Bible Reading: {plan_name}"
                body = custom_message
            else:
                current_day = BiblePlanNotificationManager._calculate_current_day(
                    subscription_doc.get('start_date'),
                    subscription_doc.get('progress', [])
                )
                readings = plan_doc.get('readings', {}).get(str(current_day), [])
                title, body = BiblePlanNotificationManager._create_notification_content(
                    plan_name, current_day, readings
                )
            
            # Get user's device tokens to send only to this user
            user_tokens = await BiblePlanNotificationManager._get_user_device_tokens(uid)
            
            if not user_tokens:
                return {"success": False, "error": "No device tokens found for user"}
            
            # Send notification only to the specific user's devices
            result = await send_push_notification(
                title=title,
                body=body,
                data={
                    "plan_id": plan_id,
                    "route": "bible_plan_reading",
                    "actionType": "bible_plan",
                    "uid": uid
                },
                send_to_all=False,  # Send only to specific user, not all users
                token=user_tokens[0] if len(user_tokens) == 1 else None,  # Use first token if only one
                eventId=None,
                link=None,
                route="bible_plan_reading",
                actionType="bible_plan"
            )
            
            # If user has multiple devices, send to all their tokens
            if len(user_tokens) > 1:
                additional_results = []
                for token in user_tokens[1:]:  # Send to remaining tokens
                    additional_result = await send_push_notification(
                        title=title,
                        body=body,
                        data={
                            "plan_id": plan_id,
                            "route": "bible_plan_reading",
                            "actionType": "bible_plan",
                            "uid": uid
                        },
                        send_to_all=False,
                        token=token,
                        eventId=None,
                        link=None,
                        route="bible_plan_reading",
                        actionType="bible_plan"
                    )
                    additional_results.append(additional_result)
                
                # Combine results
                if result.get("success") and additional_results:
                    all_results = [result] + additional_results
                    successful_sends = sum(1 for r in all_results if r.get("success"))
                    result = {
                        "success": successful_sends > 0,
                        "results": all_results,
                        "total_devices": len(user_tokens),
                        "successful_sends": successful_sends
                    }
            
            return result
            
        except Exception as e:
            logging.error(f"Failed to send immediate Bible plan notification: {e}")
            return {"success": False, "error": str(e)}


# Utility functions for managing Bible plan notification preferences

async def update_bible_plan_notification_preference(token: str, enabled: bool):
    """Update Bible plan notification preference for a specific device token"""
    try:
        # Get current preferences
        from helpers.NotificationHelper import fetch_device_notification_preferences
        current_prefs_result = await fetch_device_notification_preferences(token)
        current_prefs = current_prefs_result.get("notification_preferences", {})
        
        # Update Bible plan preference
        current_prefs["Bible Plan Reminders"] = enabled
        
        # Use the existing function to update preferences
        result = await update_device_notification_preferences(token, current_prefs)
        return {"success": result.get("success", False)}
    except Exception as e:
        logging.error(f"Failed to update Bible plan notification preference: {e}")
        return {"success": False, "error": str(e)}


async def get_bible_plan_notification_stats():
    """Get statistics about Bible plan notifications"""
    try:
        # Count active subscriptions with notifications enabled
        active_count = await DB.db["bible_plan_tracker"].count_documents({
            "notification_enabled": True,
            "notification_time": {"$exists": True, "$ne": None}
        })
        
        # Count total subscriptions
        total_count = await DB.db["bible_plan_tracker"].count_documents({})
        
        # Count scheduled notifications for Bible plans
        scheduled_count = await DB.db["notifications"].count_documents({
            "sent": False,
            "data.actionType": "bible_plan"
        })
        
        return {
            "active_subscriptions_with_notifications": active_count,
            "total_subscriptions": total_count,
            "scheduled_notifications": scheduled_count
        }
        
    except Exception as e:
        logging.error(f"Failed to get Bible plan notification stats: {e}")
        return {"error": str(e)}


async def get_device_bible_plan_preference(token: str):
    """Get the Bible plan notification preference for a specific device token"""
    try:
        from helpers.NotificationHelper import fetch_device_notification_preferences
        result = await fetch_device_notification_preferences(token)
        
        if result.get("success"):
            prefs = result.get("notification_preferences", {})
            bible_plan_enabled = prefs.get("Bible Plan Reminders", True)  # Default to True
            return {
                "success": True,
                "bible_plan_reminders_enabled": bible_plan_enabled,
                "all_preferences": prefs
            }
        else:
            return {"success": False, "error": "Failed to fetch preferences"}
            
    except Exception as e:
        logging.error(f"Failed to get device Bible plan preference: {e}")
        return {"success": False, "error": str(e)}


async def get_all_bible_plan_notification_preferences():
    """Get Bible plan notification preferences for all device tokens"""
    try:
        tokens = await DB.db['deviceTokens'].find({}).to_list(length=1000)
        
        preferences_summary = {
            "total_devices": len(tokens),
            "enabled_count": 0,
            "disabled_count": 0,
            "default_count": 0,
            "devices": []
        }
        
        for token_doc in tokens:
            token = token_doc.get('token')
            prefs = token_doc.get('notification_preferences', {})
            bible_plan_pref = prefs.get('Bible Plan Reminders')
            
            if bible_plan_pref is True:
                preferences_summary["enabled_count"] += 1
                status = "enabled"
            elif bible_plan_pref is False:
                preferences_summary["disabled_count"] += 1
                status = "disabled"
            else:
                preferences_summary["default_count"] += 1
                status = "default (enabled)"
            
            preferences_summary["devices"].append({
                "token": token[:20] + "..." if token else "N/A",
                "platform": token_doc.get('platform', 'unknown'),
                "bible_plan_reminders": status,
                "would_receive_notifications": bible_plan_pref if bible_plan_pref is not None else True
            })
        
        return {"success": True, **preferences_summary}
        
    except Exception as e:
        logging.error(f"Failed to get all Bible plan notification preferences: {e}")
        return {"success": False, "error": str(e)}