
from models.event_instance import push_all_event_instances
import asyncio
import logging

# How often EventPublisher tries to publish events
# Time interval is in seconds
# Set to 4 hours currently, tries to publish every 4 hours
PUBLISH_CHECK_INTERVAL = 14400

# Max attempt count is how many times the inner loop will try to push events again before giving up and waiting for next 4 hour interval
MAX_ATTEMPTS = 10

class EventPublisher:

    @staticmethod
    async def runEventPublishLoop():
        while True:
            try:
                push = await push_all_event_instances()
                # If distributed lock was busy, push may be a no-op; that’s fine.
                sub_success = push.get('success', False)
                attempt_count = 0
                while sub_success is False and attempt_count < MAX_ATTEMPTS:
                    await asyncio.sleep(10)
                    push = await push_all_event_instances()
                    sub_success = push.get('success', False)
                    attempt_count += 1
                if not sub_success:
                    logging.error(f"EventPublisher failed after {MAX_ATTEMPTS} retries, will retry in next cycle")
            except Exception:
                logging.exception("EventPublisher loop error")
            await asyncio.sleep(PUBLISH_CHECK_INTERVAL)