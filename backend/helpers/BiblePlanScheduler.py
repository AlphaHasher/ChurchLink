import asyncio
import logging
from datetime import datetime, time, timedelta
from typing import Optional

from mongo.database import DB
from helpers.BiblePlanNotificationHelper import BiblePlanNotificationManager


class BiblePlanScheduler:
    """Handles daily scheduling of Bible plan notifications"""
    
    def __init__(self, schedule_time: time = time(6, 0, 0)):  # Default: 6:00 AM
        """
        Initialize scheduler
        
        Args:
            schedule_time: Time of day when notifications should be scheduled (defaults to 6:00 AM)
        """
        self.schedule_time = schedule_time
        self.is_running = False
    
    async def start_scheduler(self):
        """Start the daily Bible plan notification scheduler"""
        if self.is_running:
            logging.warning("Bible plan scheduler is already running")
            return
        
        self.is_running = True
        logging.info("Starting Bible plan notification scheduler")
        
        while self.is_running:
            try:
                await self._wait_until_schedule_time()
                if self.is_running:  # Check if still running after wait
                    await self._schedule_daily_notifications()
            except Exception as e:
                logging.error(f"Error in Bible plan scheduler: {e}")
                # Wait 1 hour before retrying on error
                await asyncio.sleep(3600)
    
    def stop_scheduler(self):
        """Stop the scheduler"""
        self.is_running = False
        logging.info("Bible plan scheduler stopped")
    
    async def _wait_until_schedule_time(self):
        """Wait until the next scheduled time to run notifications"""
        now = datetime.now()
        today_schedule = datetime.combine(now.date(), self.schedule_time)
        
        # If today's schedule time has passed, schedule for tomorrow
        if now >= today_schedule:
            next_schedule = today_schedule + timedelta(days=1)
        else:
            next_schedule = today_schedule
        
        wait_seconds = (next_schedule - now).total_seconds()
        logging.info(f"Next Bible plan notification scheduling at: {next_schedule}")
        
        # Wait in chunks to allow for graceful shutdown
        while wait_seconds > 0 and self.is_running:
            chunk_wait = min(wait_seconds, 60)  # Wait in 60-second chunks
            await asyncio.sleep(chunk_wait)
            wait_seconds -= chunk_wait
    
    async def _schedule_daily_notifications(self):
        """Schedule all Bible plan notifications for the day"""
        try:
            logging.info("Running daily Bible plan notification scheduling")
            count = await BiblePlanNotificationManager.schedule_daily_bible_reminders()
            logging.info(f"Successfully scheduled {count} Bible plan notifications")
        except Exception as e:
            logging.error(f"Failed to schedule daily Bible plan notifications: {e}")


# Global scheduler instance
_bible_plan_scheduler: Optional[BiblePlanScheduler] = None


async def start_bible_plan_scheduler(schedule_time: time = time(6, 0, 0)):
    """
    Start the global Bible plan scheduler
    
    Args:
        schedule_time: Time of day when notifications should be scheduled
    """
    global _bible_plan_scheduler
    
    if _bible_plan_scheduler and _bible_plan_scheduler.is_running:
        logging.warning("Bible plan scheduler is already running")
        return
    
    _bible_plan_scheduler = BiblePlanScheduler(schedule_time)
    
    # Run scheduler in background task
    asyncio.create_task(_bible_plan_scheduler.start_scheduler())
    logging.info("Bible plan scheduler started as background task")


def stop_bible_plan_scheduler():
    """Stop the global Bible plan scheduler"""
    global _bible_plan_scheduler
    
    if _bible_plan_scheduler:
        _bible_plan_scheduler.stop_scheduler()
        _bible_plan_scheduler = None


async def manual_schedule_bible_notifications():
    """Manually trigger Bible plan notification scheduling (for testing/admin use)"""
    try:
        count = await BiblePlanNotificationManager.schedule_daily_bible_reminders()
        return {"success": True, "scheduled_count": count}
    except Exception as e:
        logging.error(f"Manual Bible plan notification scheduling failed: {e}")
        return {"success": False, "error": str(e)}


# Integration point for adding to main application startup
async def initialize_bible_plan_notifications():
    """Initialize Bible plan notification system"""
    try:
        # Start the scheduler
        await start_bible_plan_scheduler()
        
        # Optionally run initial scheduling if it's past the normal schedule time
        now = datetime.now()
        schedule_time = time(6, 0, 0)  # Default schedule time
        today_schedule = datetime.combine(now.date(), schedule_time)
        
        # If we're starting the app after the normal schedule time and no notifications 
        # have been scheduled for today, run scheduling now
        if now > today_schedule:
            scheduled_today = await DB.db["notifications"].count_documents({
                "data.actionType": "bible_plan",
                "created_at": {"$gte": today_schedule.isoformat()},
                "sent": False
            })
            
            if scheduled_today == 0:
                logging.info("Running initial Bible plan notification scheduling")
                await manual_schedule_bible_notifications()
        
        logging.info("Bible plan notification system initialized successfully")
        return True
        
    except Exception as e:
        logging.error(f"Failed to initialize Bible plan notification system: {e}")
        return False