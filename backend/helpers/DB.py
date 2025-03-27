import os

from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

class DB:
    client = None
    db = None

    @staticmethod
    def init_db():
        DB.client = AsyncIOMotorClient(os.getenv("MONGODB_URL") or "mongodb://localhost:27017")
        DB.db = DB.client["SSBC_DB"]

    @staticmethod
    def close_db():
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

    @staticmethod
    async def create_document(collection_name, document):
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

### Testing connection to mongodb service, works on my machine with compass
async def main():
    ## Main usage:
    DB.init_db()
    print(await DB.is_connected())

    print(type(DB.db))

    ## Generic usage:
    # Insert a document into a collection
    user_example = {
        "name": "John Doe",
        "age": 30,
        "email": "john@example.com"
    }
    await DB.create_document("users", user_example)

    # Find documents
    john = await DB.find_documents("users", {"name": "John Doe"}, limit=5)
    print("Users named 'John Doe'", john)

    # Update documents
    updated = await DB.update_document("users", {"name": "John Doe"}, {"age": 999})
    print(f"Updated {updated} documents")

    # Delete documents
    deleted = await DB.delete_documents("users", {"name": "John Doe"})
    print(f"Deleted {deleted} documents")

    DB.close_db()

if __name__ == "__main__":
    asyncio.run(main())