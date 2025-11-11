
from models.event_instance import push_all_event_instances
import asyncio
import logging

# How often EventPublisher tries to publish events
# Time interval is in seconds
# Set to 4 hours currently, tries to publish every 4 hours
PUBLISH_CHECK_INTERVAL = 14400

class EventPublisher:

    @staticmethod
    async def runEventPublishLoop():
        while True:
            try:
                push = await push_all_event_instances()
                # If distributed lock was busy, push may be a no-op; that’s fine.
                sub_success = push.get('success', False)
                while sub_success is False:
                    await asyncio.sleep(10)
                    push = await push_all_event_instances()
                    sub_success = push.get('success', False)
            except Exception:
                logging.exception("EventPublisher loop error")
            await asyncio.sleep(PUBLISH_CHECK_INTERVAL)