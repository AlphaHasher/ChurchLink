import os
import pymongo
from motor.motor_asyncio import AsyncIOMotorClient

class DB:
    client = None
    db = None
    pages = None
    collections = [
        {
            "name": "users", # name of collection,
            "indexes": ["email"] # array of property names to index as unique
        },
        {
            "name": "roles",
            "indexes": ["name"]
        },
    ]

    ###########
    ## Setup ##
    ###########

    @staticmethod
    async def init_db(name=None):
        DB.client = AsyncIOMotorClient(os.getenv("MONGODB_URL") or "mongodb://localhost:27017")
        DB.db = DB.client[name or "SSBC_DB"]
        DB.pages = DB.db["pages"]
        # Sanity check
        await DB.is_connected()
        # Schema validation
        await DB.init_collections()

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