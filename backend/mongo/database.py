import os
import pymongo
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB connection settings
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "SSBC_DB")

class DB:
    client = None
    db = None
    collections = [
        {
            "name": "users", # name of collection,
            "indexes": ["email"] # array of property names to index as unique
        },
        {
            "name": "roles",
            "indexes": ["name"]
        },
        {
            "name": "events",
            "indexes": ["date", "name"]
        }
    ]

    ###########
    ## Setup ##
    ###########

    @classmethod
    async def init_db(cls):
        """Initialize the database connection and create indexes."""
        try:
            # Connect to MongoDB
            cls.client = AsyncIOMotorClient(os.getenv("MONGODB_URL") or "mongodb://localhost:27017")
            cls.db = cls.client[DB_NAME]
            
            # Drop existing indexes on events collection
            await cls.db["events"].drop_indexes()
            
            # Create new indexes
            for collection in cls.collections:
                for index in collection["indexes"]:
                    await cls.db[collection["name"]].create_index([(index, 1)])
            
            print("Database initialized successfully")
        except Exception as e:
            print(f"Error initializing database: {e}")
            raise e

    @staticmethod
    async def init_collections():
        for collection in DB.collections:
            collection_name = collection["name"]
            collection_names = await DB.db.list_collection_names()
            if collection_name not in collection_names:
                await DB.db.create_collection(collection_name)

            # Create unique indexer from schema property name
            if "indexes" in collection:
                for index in collection["indexes"]:
                    # Ensure unique field
                    await DB.db[collection_name].create_indexes([
                        pymongo.IndexModel(
                            [(index, pymongo.ASCENDING)],
                            unique=True,
                            name="unique_" + index + "_index"
                        )
                    ])

    @staticmethod
    def close_db():
        print("Closing DB client connection")
        DB.client.close()

    @staticmethod
    async def is_connected():
        try:
            await DB.client.admin.command('ping')
            print("MongoDB connected successfully")
            return True
        except Exception as e:
            print(f"Connection error: {e}")
            return False

    ##########
    ## CRUD ##
    ##########

    @staticmethod
    async def insert_document(collection_name, document):
        collection = DB.db[collection_name]
        return (await collection.insert_one(document)).inserted_id

    @staticmethod
    async def find_documents(collection_name, query=None, limit=None):
        collection = DB.db[collection_name]
        cursor = collection.find(query or {})
        if limit:
            cursor.limit(limit)
        return await cursor.to_list(length=limit) if limit else await cursor.to_list(length=None)

    @staticmethod
    async def update_document(collection_name, filter_query, update_data):
        collection = DB.db[collection_name]
        return (await collection.update_many(filter_query, {'$set': update_data})).modified_count

    @staticmethod
    async def delete_documents(collection_name, delete_query):
        collection = DB.db[collection_name]
        return (await collection.delete_many(delete_query)).deleted_count