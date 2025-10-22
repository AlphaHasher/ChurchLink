import os
import json
import pymongo
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from datetime import datetime
from bson import ObjectId
import logging

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
            "name": "ministries",
            "indexes": ["normalized_name"],
        },
        {
            "name": "sermons",
            "indexes": ["title", "video_id"],
            "compound_indexes": [["published", "date_posted"]],
        },
        {
            "name": "pages",
            "indexes": ["title"]
        },
        {
            "name": "header-items",
            "indexes": ["title"]
        },
        {
            "name": "footer-items",
            "indexes": ["title"]
        },
        {
            "name": "bible_notes",
            "compound_indexes": [["user_id", "book", "chapter", "verse_start"]]
        },
        {
            "name": "donations_subscriptions",
            "indexes": ["subscription_id"]
        },
        {
            "name": "transactions",
            "indexes": ["transaction_id"]
        },
        {
            "name": "settings",
            "indexes": ["key"]
        }
        ,
        {
            "name": "bible_plans",
            "compound_indexes": [["user_id", "created_at"]],
        },
        {
            "name": "bible_plan_tracker",
            "compound_indexes": [["uid", "plan_id"], ["uid", "subscribed_at"]],
        },
        {
            "name": "bible_plan_templates",
            "indexes": ["name"]
        },
        {
            "name": "app_config",
            "indexes": ["config_type"]
        },
    ]

    ###########
    ## Setup ##
    ###########

    @staticmethod
    async def init_db(name=None):
        try:
            print(f"Connecting to MongoDB at: {MONGODB_URL}")

            # Create client with connection timeout
            DB.client = AsyncIOMotorClient(
                MONGODB_URL,
                serverSelectionTimeoutMS=5000,  # 5 second timeout
                connectTimeoutMS=5000,
                socketTimeoutMS=5000
            )
            DB.db = DB.client[name or DB_NAME]

            # Test the connection
            connection_success = await DB.is_connected()
            if not connection_success:
                raise Exception("Failed to connect to MongoDB - connection test failed")

            # Schema validation and index creation
            await DB.init_collections()
            print("Database initialized successfully")

        except Exception as e:
            error_msg = f"Failed to connect to MongoDB at {MONGODB_URL}: {str(e)}"
            print(error_msg)
            print("Make sure MongoDB is running and accessible")
            raise Exception(error_msg)

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

            # Create compound indexes (non-unique)
            if "compound_indexes" in collection:
                for compound_index in collection["compound_indexes"]:
                    index_fields = [(field, pymongo.ASCENDING) for field in compound_index]
                    await DB.db[collection_name].create_indexes([
                        pymongo.IndexModel(
                            index_fields,
                            unique=False,
                            name="_".join(compound_index) + "_compound_index"
                        )
                    ])

            if collection_name == "sermons":
                await DB.db[collection_name].create_index([("ministry", pymongo.ASCENDING)])
                await DB.db[collection_name].create_index([("speaker", pymongo.ASCENDING)])
                await DB.db[collection_name].create_index([("date_posted", pymongo.DESCENDING)])
                await DB.db[collection_name].create_index(
                    [("title", "text"), ("description", "text")],
                    name="sermons_text_index"
                )

            # Import migration data if collection is empty
            await DB.import_migration_data(collection_name)

    @staticmethod
    def convert_mongodb_extended_json(data):
        """Convert MongoDB extended JSON format ($oid, $date) to Python objects"""
        if isinstance(data, dict):
            converted = {}
            for key, value in data.items():
                if key == "_id" and isinstance(value, dict) and "$oid" in value:
                    # Convert $oid to ObjectId
                    converted[key] = ObjectId(value["$oid"])
                elif isinstance(value, dict) and "$date" in value:
                    # Convert $date to datetime
                    if isinstance(value["$date"], str):
                        # Parse ISO format date string
                        converted[key] = datetime.fromisoformat(value["$date"].replace('Z', '+00:00'))
                    else:
                        converted[key] = value["$date"]
                elif isinstance(value, dict) and "$oid" in value:
                    # Convert $oid to ObjectId for any field
                    converted[key] = ObjectId(value["$oid"])
                else:
                    # Recursively convert nested structures
                    converted[key] = DB.convert_mongodb_extended_json(value)
            return converted
        elif isinstance(data, list):
            return [DB.convert_mongodb_extended_json(item) for item in data]
        else:
            return data

    @staticmethod
    async def import_migration_data(collection_name: str):
        """Import migration data from JSON files if collection is empty"""
        try:
            # Check if collection has any documents
            doc_count = await DB.db[collection_name].count_documents({})
            if doc_count > 0:
                print(f"Collection '{collection_name}' already has {doc_count} documents, skipping migration")
                return

            # Look for migration file
            migration_file = Path(__file__).parent.parent / "migrations" / f"SSBC_DB.{collection_name}.json"

            if not migration_file.exists():
                print(f"No migration file found for collection '{collection_name}'")
                return

            # Load and parse migration data
            with open(migration_file, 'r', encoding='utf-8') as f:
                migration_data = json.load(f)

            if not migration_data:
                print(f"Migration file for '{collection_name}' is empty")
                return

            # Convert MongoDB extended JSON format to Python objects
            converted_data = DB.convert_mongodb_extended_json(migration_data)

            # Insert migration data
            result = await DB.db[collection_name].insert_many(converted_data)
            print(f"Imported {len(result.inserted_ids)} documents into '{collection_name}' collection")

        except Exception as e:
            print(f"Error importing migration data for '{collection_name}': {e}")

    @staticmethod
    def close_db():
        if DB.client:
            print("Closing DB client connection")
            DB.client.close()

    @staticmethod
    async def is_connected():
        if DB.client is None:
            print("DB client not initialized.")
            return False
        try:
            await DB.client.admin.command('ping')
            print("MongoDB connected successfully")
            return True
        except Exception as e:
            print(f"MongoDB connection failed: {e}")
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

    @staticmethod
    async def get_setting(key: str, default_value=None):
        """Get a setting from the database by key."""
        if DB.db is None:
            logging.warning("Database not initialized.")
            return default_value
        try:
            setting = await DB.db["settings"].find_one({"key": key})
            if setting:
                return setting["value"]
            return default_value
        except Exception as e:
            logging.error(f"Error getting setting {key}: {e}")
            return default_value

    @staticmethod
    async def set_setting(key: str, value):
        """Set or update a setting in the database."""
        if DB.db is None:
            logging.warning("Database not initialized.")
            return False
        try:
            result = await DB.db["settings"].update_one(
                {"key": key},
                {"$set": {"key": key, "value": value, "updated_at": datetime.now().isoformat()}},
                upsert=True
            )
            return result.modified_count > 0 or result.upserted_id is not None
        except Exception as e:
            logging.error(f"Error setting {key}: {e}")
            return False

    @staticmethod
    async def get_paypal_settings():
        """Get all PayPal settings as a dictionary."""
        settings = {}
        # Define default values
        defaults = {
            "PAYPAL_PLAN_NAME": "Church Donation Subscription",
            "PAYPAL_PLAN_DESCRIPTION": "Recurring donation to Church",
            "CHURCH_NAME": "Church",
            "ALLOWED_FUNDS": ["General", "Building", "Missions", "Youth", "Other"]
        }

        # Try to get settings from database, fall back to defaults or env vars
        for key, default in defaults.items():
            # Try to get from database first
            value = await DB.get_setting(key, None)

            # If not in database, use default (keep environment variables separate)
            if value is None:
                value = default

            settings[key] = value

        return settings