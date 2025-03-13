from motor.motor_asyncio import AsyncIOMotorClient

class DB:
    client = None
    db = None


    @staticmethod
    def init_db():
        DB.client = AsyncIOMotorClient("mongodb://localhost:27017")
        DB.db = DB.client["SSBC_DB"]


    @staticmethod
    def close_db():
        DB.client.close()