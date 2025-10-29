
from models.event_instance import push_all_event_instances
import asyncio

# How often EventPublisher tries to publish events
# Time interval is in seconds
# Set to 4 hours currently, tries to publish every 4 hours
PUBLISH_CHECK_INTERVAL = 14400

class EventPublisher:

    @staticmethod
    async def runEventPublishLoop():
        while True:
            push = await push_all_event_instances()
            SubSuccess = push['success']
            while SubSuccess == False:
                await asyncio.sleep(10)
                push = await push_all_event_instances()
                SubSuccess = push['success']
            await asyncio.sleep(PUBLISH_CHECK_INTERVAL)