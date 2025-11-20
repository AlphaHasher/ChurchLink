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
            "name": "users",  # name of collection
            # Unique indexes
            # - email: primary login / identity
            # - uid: Firebase / auth identity, should be globally unique
            "indexes": ["email", "uid"],
            # Non-unique indexes for searches, filters, and pagination
            "compound_indexes": [
                # Role-based filters and permission resolution
                ["roles"],

                # Default admin pagination sort
                ["createdOn", "uid"],

                # Name sorting + exact first/last lookups
                ["last_name", "first_name", "email"],

                # Membership-based sorting / filtering
                ["membership"],

                # Direct lookups by phone
                ["phone"],

                # Age-range queries via birthday
                ["birthday"],
            ],
        },
        {
            "name": "roles",
            # Unique role names
            "indexes": ["name"],
            # Permission-based role discovery
            "compound_indexes": [
                ["permissions.admin"],
                ["permissions.permissions_management"],
                ["permissions.web_builder_management"],
                ["permissions.mobile_ui_management"],
                ["permissions.event_editing"],
                ["permissions.media_management"],
                ["permissions.sermon_editing"],
                ["permissions.bulletin_editing"],
                ["permissions.finance"],
                ["permissions.ministries_management"],
            ],
        },
        {
            "name": "events",
            "compound_indexes": [
                # For get_publishing_events(), push_all_event_instances(), etc.
                ["currently_publishing"],

                # For get_events_with_discount_code() + remove_discount_code_from_all_events()
                ["discount_codes"],

                # For heavy admin-panel search with filters + sort on updated_on
                # (registration_allowed / hidden / members_only / rsvp_required / gender are small-cardinality filters)
                ["registration_allowed", "hidden", "members_only", "rsvp_required", "gender", "updated_on"],
            ],
        },
        {
            "name": "event_instances",
            "compound_indexes": [
                # Primary workhorse: “all instances for this event” and “upcoming for this event”
                #   - get_instances_from_event_id
                #   - get_upcoming_instances_from_event_id (with sort on scheduled_date)
                #   - search_assembled_event_instances (filters by event_id + status/time)
                ["event_id", "scheduled_date"],

                # Fast lookup by (event_id, series_index) for per-instance editing/overrides
                ["event_id", "series_index"],

                # Global upcoming/history pagination & instance search:
                #   - search_upcoming_event_instances_for_read
                #   - search_my_event_instances_for_read
                #   both sort by (scheduled_date, _id) and paginate by the same tuple
                ["scheduled_date", "_id"],
            ],
        },
        {
            "name": "event_transactions",
            "indexes": [
                # Enforce unique PayPal order id / idempotency
                "order_id",
            ],
            "compound_indexes": [
                # List by payer, newest first
                ["payer_uid", "created_at"],

                # List by instance, newest first
                ["event_instance_id", "created_at"],

                # List by event, newest first
                ["event_id", "created_at"],

                # Admin / reconciliation views by status
                ["status", "created_at"],

                # Idempotency / lookup helpers for capture & refunds
                ["items.capture_id"],
                ["items.refunds.refund_id"],
            ],
        },
        {
            "name": "discount_codes",
            "indexes": [
                # Uniqueness on normalized code (strip+upper)
                "code",
            ],
        },
        {
            "name": "ministries",
            "indexes": ["normalized_name"],
        },
        {
            "name": "sermons",
            "indexes": ["title", "video_id"],
            "compound_indexes": [
                ["published", "date_posted"],
                ["tags"],
            ],
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
            "name": "localization-info",
            "indexes": ["namespace"]
        },
        {
            "name": "bible_notes",
            "compound_indexes": [["user_id", "book", "chapter", "verse_start"]]
        },
        {
            "name": "settings",
            "indexes": ["key"]
        }
        ,
        {
            "name": "bible_plans",
            "compound_indexes": [
                # User’s own plans, newest first:
                ["user_id", "created_at"],

                # Public / discoverable plans:
                #   - get_published_reading_plans (visible=True).sort(name)
                ["visible", "name"],
            ],
        },
        {
            "name": "bible_plan_tracker",
            "compound_indexes": [
                ["uid", "plan_id"],
                ["uid", "subscribed_at"],

                # Bible plan notification pipeline:
                # find({"notification_enabled": True,
                #       "notification_time": {"$exists": True, "$ne": None}})
                ["notification_enabled", "notification_time"],
            ],
        },
        {
            "name": "bible_plan_templates",
            "indexes": ["name"]
        },
        {
            "name": "app_config",
            "indexes": ["config_type"]
        },
        {
            "name": "deviceTokens",
            "compound_indexes": [
                # Existing one – keep it:
                ["userId", "token"],

                # Bible plan reminders – quickly find “devices for user that want reminders”
                ["userId", "notification_preferences.Bible Plan Reminders"],
            ],
        },
        {
            "name": "image_data",
            "compound_indexes": [
                # Folder + bulk operations use prefix regex on path
                ["path"],

                # Listing & pagination sort by created_at
                ["created_at"],

                # Name substring search; this index may or may not be fully used
                # due to non-prefix regex, but it's cheap and future-proofs a bit
                ["name"],
            ],
        },
        {
            "name": "bulletins",
            "indexes": [
                # Enforce global uniqueness for headlines
                "headline",
            ],
            "compound_indexes": [
                # Drag-and-drop ordering and admin/public lists
                ["order"],

                # Date-based filtering: upcoming_only and explicit ranges
                ["publish_date"],

                # Ministry filter ("ministries": {"$in": [ministry]})
                ["ministries"],
            ],
        },
        {
            "name": "service_bulletins",
            "indexes": [
                # Enforce global uniqueness for service titles
                "title",
            ],
            "compound_indexes": [
                # Core visibility logic:
                # (visibility_mode, display_week) drives "always" vs "specific_weeks" for a given Monday
                ["visibility_mode", "display_week"],

                # Optional helper for queries that filter by published first
                ["published"],

                # Keep this if you want index support for the "max order" query and potential future uses
                ["order"],
            ],
        },
        {
            "name": "donation_transactions",
            "indexes": [
                # One ledger row per PayPal order id.
                # Used by:
                #   - get_donation_transaction_by_order_id
                #   - capture webhooks (find_one_and_update by paypal_order_id)
                "paypal_order_id",
            ],
            "compound_indexes": [
                # Lookup for admin/webhook refunds keyed by capture id
                ["paypal_capture_id"],
            ],
        },
        {
            "name": "donation_transactions",
            # No unique single-field index here to avoid surprises with legacy data;
            # order_id semantics live in the application.
            "compound_indexes": [
                ["donor_uid", "created_at"],        # donor history, sorted by time
                ["status", "created_at"],           # admin filters by status + date
                ["created_at"],                     # raw time-based scans
                ["paypal_order_id"],                # lookups by PayPal order id
                ["paypal_capture_id"],              # lookups by capture id (refunds)
            ],
        },
        {
            "name": "donation_subscriptions",
            "indexes": [
                "paypal_subscription_id",           # one row per subscription id
            ],
            "compound_indexes": [
                ["donor_uid", "created_at"],        # donor subscription history
                ["status", "created_at"],           # active/cancelled, sorted
                ["created_at"],                     # generic time-based scans
            ],
        },
        {
            "name": "donation_subscription_plans",
            "indexes": [
                "plan_id",                          # external plan id should be unique
            ],
            "compound_indexes": [
                ["currency", "interval", "amount"], # plan catalog browsing/search
            ],
        },
        {
            "name": "donation_subscription_payments",
            "indexes": [
                "paypal_txn_id",                    # idempotent per PayPal txn
            ],
            "compound_indexes": [
                ["donor_uid", "created_at"],        # donor renewal history
                ["paypal_subscription_id", "created_at"],  # per-subscription ledger
                ["created_at"],                     # reporting by time
            ],
        },
        {
            "name": "form_transactions",
            "compound_indexes": [
                ["user_id", "created_at"],          # per-user form payment history
                ["status", "created_at"],           # admin listing by status
                ["created_at"],                     # generic time-based scans
                ["paypal_order_id"],                # mark captured / lookup by order id
                ["paypal_capture_id"],              # refunds via capture id
                ["form_id"],                        # per-form reporting / drill-down
            ],
        },
        {
            "name": "refund_requests",
            "compound_indexes": [
                # One logical row per (uid, txn_kind, txn_id) – this helps the
                # upsert-like "create_or_update_refund_request_doc" path.
                ["uid", "txn_kind", "txn_id"],

                # "My refund requests" – filter by uid + status, sort by created_on desc
                ["uid", "responded", "resolved", "created_on"],

                # Admin browse by txn_kind + status, sorted by created_on desc
                ["txn_kind", "responded", "resolved", "created_on"],

                # Fallback for generic time-based explorations
                ["created_on"],
            ],
        },
        {
            "name": "financial_reports",
            "compound_indexes": [
                ["created_by_uid", "created_at"],   # "reports I created", by time
                ["created_at"],                     # global report listing / pruning
                ["config.name"],                    # name search (regex, prefix-friendly)
            ],
        },
        {
            "name": "notifications",
            "compound_indexes": [
                # Global scheduler usage:
                #   - scan unsent notifications due to fire, ordered/filtered by scheduled_time
                ["sent", "scheduled_time"],

                # Bible plan and analytics usage:
                #   - count_documents({
                #         "data.actionType": "bible_plan",
                #         "sent": False/True,
                #         "created_at": {"$gte": ...},
                #     })
                ["sent", "data.actionType", "created_at"],
            ],
        },
        {
            "name": "forms",
            "compound_indexes": [
                # Owner lists & search, sorted by created_at
                ["user_id", "created_at"],

                # Fast duplicate-name checks per user
                ["user_id", "title"],

                # Public/visible lists + expiry logic + created_at sort
                ["visible", "expires_at", "created_at"],

                # Slug lookups (get_form_by_slug, check_form_slug_status, slug uniqueness checks)
                ["slug"],

                # Ministry filters + created_at sort (search_all_forms/search_visible_forms)
                ["ministries", "created_at"],
            ],
        },
        {
            "name": "form_responses",
            "compound_indexes": [
                # One aggregated document per form; all reads/writes use form_id
                ["form_id"],
            ],
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

            # Get existing indexes once per collection
            existing_indexes = await DB.db[collection_name].index_information()

            # Helper to check if an index with this key pattern already exists
            def has_index_with_keys(index_fields, unique=None):
                for info in existing_indexes.values():
                    # info["key"] is a list of (field, direction) tuples
                    if info.get("key") == index_fields:
                        if unique is None:
                            return True
                        # If we care about uniqueness, match that too
                        if bool(info.get("unique", False)) == bool(unique):
                            return True
                return False

            # Create unique indexes from "indexes"
            if "indexes" in collection:
                for index in collection["indexes"]:
                    key_fields = [(index, pymongo.ASCENDING)]

                    # If a matching unique index already exists, skip
                    if has_index_with_keys(key_fields, unique=True):
                        continue

                    await DB.db[collection_name].create_indexes([
                        pymongo.IndexModel(
                            key_fields,
                            unique=True,
                            name="unique_" + index + "_index"
                        )
                    ])

            # Create compound (non-unique) indexes
            if "compound_indexes" in collection:
                for compound_index in collection["compound_indexes"]:
                    index_fields = [(field, pymongo.ASCENDING) for field in compound_index]

                    # If any index already exists with the same key pattern, skip
                    if has_index_with_keys(index_fields):
                        continue

                    # Single-field "compound" indexes: let Mongo pick the name
                    if len(compound_index) == 1:
                        index_model = pymongo.IndexModel(
                            index_fields,
                            unique=False,
                        )
                    else:
                        index_model = pymongo.IndexModel(
                            index_fields,
                            unique=False,
                            name="_".join(compound_index) + "_compound_index",
                        )

                    await DB.db[collection_name].create_indexes([index_model])

            if collection_name == "sermons":
                await DB.db[collection_name].create_index([("ministry", pymongo.ASCENDING)])
                await DB.db[collection_name].create_index([("speaker", pymongo.ASCENDING)])
                await DB.db[collection_name].create_index([("date_posted", pymongo.DESCENDING)])
                await DB.db[collection_name].create_index(
                    [("title", "text"), ("description", "text")],
                    name="sermons_text_index"
                )

            if collection_name == "bulletins":
                # Text index for search_bulletins and list_bulletins(query_text=...)
                await DB.db[collection_name].create_index(
                    [("headline", "text"), ("body", "text")],
                    name="bulletins_text_index",
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
            logging.error("Database not initialized.")
            return None
        try:
            collection = DB.db[collection_name]
            result = await collection.insert_one(document)
            return result.inserted_id
        except Exception as e:
            logging.error(f"Error inserting document into {collection_name}: {e}")
            # Also log the document for debugging (be careful with sensitive data)
            logging.error(f"Failed document keys: {list(document.keys()) if isinstance(document, dict) else 'Not a dict'}")
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
        """Get PayPal-specific settings as a dictionary."""
        settings = {}
        # Define default values for PayPal settings only
        defaults = {
            "PAYPAL_PLAN_NAME": "Church Donation Subscription",
            "PAYPAL_PLAN_DESCRIPTION": "Recurring donation to Church",
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

    @staticmethod
    async def get_church_settings():
        """Get church information settings as a dictionary."""
        settings = {}
        # Define default values for church settings
        defaults = {
            "CHURCH_NAME": "Your Church Name",
            "CHURCH_ADDRESS": "123 Main Street",
            "CHURCH_CITY": "Your City",
            "CHURCH_STATE": "ST",
            "CHURCH_POSTAL_CODE": "12345"
        }

        # Try to get settings from database, fall back to defaults
        for key, default in defaults.items():
            # Try to get from database first
            value = await DB.get_setting(key, None)

            # If not in database, use default
            if value is None:
                value = default

            settings[key] = value

        return settings

    @staticmethod
    async def get_combined_paypal_church_settings():
        """Get combined PayPal and church settings for backward compatibility."""
        paypal_settings = await DB.get_paypal_settings()
        church_settings = await DB.get_church_settings()
        
        # Combine both settings into one dictionary
        combined_settings = {**paypal_settings, **church_settings}
        return combined_settings