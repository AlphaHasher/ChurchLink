import motor.motor_asyncio
import asyncio

async def drop_schemas():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["SSBC_DB"]
    
    # Drop all indexes on events collection
    await db.events.drop_indexes()
    print("Dropped all indexes on events collection")

if __name__ == "__main__":
    asyncio.run(drop_schemas())
