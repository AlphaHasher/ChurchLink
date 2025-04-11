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
            "indexes": ["name", "date"]
            # Consider adding a text index for search_events if not already present
            # Example: {"name": "text", "description": "text"}
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
        existing_collections = await DB.db.list_collection_names()
        for collection_spec in DB.collections:
            collection_name = collection_spec["name"]
            
            if collection_name not in existing_collections:
                print(f"Creating collection: {collection_name}")
                await DB.db.create_collection(collection_name)
            else:
                print(f"Collection {collection_name} already exists.")

            # Create defined indexes
            if "indexes" in collection_spec:
                collection = DB.db[collection_name]
                # Fetch existing indexes to avoid recreating them (optional but good practice)
                existing_indexes = await collection.index_information()
                
                for index_field in collection_spec["indexes"]:
                    index_name = f"{index_field}_1" # Default name format for single field ascending index
                    unique_index_name = f"unique_{index_field}_index"
                    
                    # Check if a similar index already exists
                    if index_name not in existing_indexes and unique_index_name not in existing_indexes:
                        try:
                            print(f"Creating index on {collection_name}.{index_field}")
                            await collection.create_index([(index_field, pymongo.ASCENDING)], name=index_name)
                             # If uniqueness is desired, uncomment the unique index creation below
                            # print(f"Creating unique index on {collection_name}.{index_field}")
                            # await collection.create_index(
                            #     [(index_field, pymongo.ASCENDING)],
                            #     unique=True,
                            #     name=unique_index_name
                            # )
                        except Exception as e:
                             print(f"Error creating index on {collection_name}.{index_field}: {e}")
                    # else:
                    #     print(f"Index on {collection_name}.{index_field} already exists.")
            
            # Example: Ensure text index for events (if needed for search_events)
            if collection_name == "events":
                collection = DB.db[collection_name]
                existing_indexes = await collection.index_information()
                text_index_name = "event_text_search_index"
                # Define fields for text index
                text_index_fields = [("name", "text"), ("description", "text")] 
                # Check if a text index already exists
                if text_index_name not in existing_indexes and not any(v.get('text') for v in existing_indexes.values()):
                    print(f"Creating text index on {collection_name} for fields: name, description")
                    try:
                        await collection.create_index(text_index_fields, name=text_index_name, default_language='english')
                    except Exception as e:
                         print(f"Error creating text index on {collection_name}: {e}")
                # else:
                #      print(f"Text index on {collection_name} already exists.")


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
        if not DB.db:
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
        if not DB.db:
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
        if not DB.db:
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
        if not DB.db:
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