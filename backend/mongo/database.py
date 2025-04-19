import os
import pymongo
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB connection settings
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "SSBC_DB")

class DB:
    client: AsyncIOMotorClient = None
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
            # Reverting indexes back to original based on user feedback
            "indexes": ["name"]
        },
        {
            "name": "pages",
            "indexes": ["title"]
        },
        {
            "name": "header-items",
            "indexes": ["title"]
        }
    ]

    ###########
    ## Setup ##
    ###########

    @staticmethod
    async def init_db(name=None):
        DB.client = AsyncIOMotorClient(MONGODB_URL)
        DB.db = DB.client[name or DB_NAME]
        # Sanity check
        await DB.is_connected()
        # Schema validation and index creation
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
        if DB.client:
            print("Closing DB client connection")
            DB.client.close()

    @staticmethod
    async def is_connected():
        if not DB.client:
            print("DB client not initialized.")
            return False
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
        """Inserts a document into the specified collection and returns the inserted document's ID."""
        if DB.db is None:
            print("Database not initialized.")
            return None
        try:
            collection = DB.db[collection_name]
            result = await collection.insert_one(document)
            return result.inserted_id
        except Exception as e:
            print(f"Error inserting document into {collection_name}: {e}")
            return None

    @staticmethod
    async def find_documents(collection_name, query=None, limit=None):
        """Finds documents in the specified collection matching the query."""
        if DB.db is None:
            print("Database not initialized.")
            return [] # Return empty list on error/uninitialized
        try:
            collection = DB.db[collection_name]
            cursor = collection.find(query or {})
            if limit is not None:
                # Ensure limit is a positive integer
                limit = max(1, int(limit))
                cursor.limit(limit)
                return await cursor.to_list(length=limit)
            else:
                # Fetch all documents if no limit is specified
                return await cursor.to_list(length=None)
        except Exception as e:
            print(f"Error finding documents in {collection_name}: {e}")
            return []

    @staticmethod
    async def update_document(collection_name, filter_query, update_data):
        """Updates documents matching the filter query using $set. Uses update_many."""
        if DB.db is None:
            print("Database not initialized.")
            return 0
        try:
            collection = DB.db[collection_name]
            # Using update_many as per the provided helper function
            result = await collection.update_many(filter_query, {'$set': update_data})
            return result.modified_count
        except Exception as e:
            print(f"Error updating documents in {collection_name}: {e}")
            return 0

    @staticmethod
    async def delete_documents(collection_name, delete_query):
        """Deletes documents matching the query. Uses delete_many."""
        if DB.db is None:
            print("Database not initialized.")
            return 0
        try:
            collection = DB.db[collection_name]
            # Using delete_many as per the provided helper function
            result = await collection.delete_many(delete_query)
            return result.deleted_count
        except Exception as e:
            print(f"Error deleting documents from {collection_name}: {e}")
            return 0

# Models can now use DB helpers or interact directly with DB.db[collection_name]