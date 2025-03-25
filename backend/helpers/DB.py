from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

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

    @staticmethod
    async def connect():
        try:
            await DB.client.admin.command('ping')
            print("Successfully connected to MongoDB")
            return DB.db
        except Exception as e:
            print(f"Connection error: {e}")

    @staticmethod
    async def insert_document(collection_name, document):
        collection = DB.db[collection_name]
        result = await collection.insert_one(document)
        return result.inserted_id

    @staticmethod
    async def find_documents(collection_name, query=None, limit=None):
        collection = DB.db[collection_name]
        query = query or {}
        cursor = collection.find(query)
        if limit:
            cursor.limit(limit)
        return await cursor.to_list(length=limit) if limit else await cursor.to_list(length=None)

    @staticmethod
    async def update_document(collection_name, filter_query, update_data):
        collection = DB.db[collection_name]
        result = await collection.update_many(filter_query, {'$set': update_data})
        return result.modified_count

    @staticmethod
    async def delete_documents(collection_name, delete_query):
        collection = DB.db[collection_name]
        result = await collection.delete_many(delete_query)
        return result.deleted_count

### Testing connection to mongodb service, works on my machine with compass
async def main():
    ## Main usage:
    DB.init_db()
    await DB.connect()

    ## Generic usage:
    # Insert a document into a collection
    user_example = {
        "name": "John Doe",
        "age": 30,
        "email": "john@example.com"
    }
    await DB.insert_document("users", user_example)

    # Find documents
    john = await DB.find_documents("users", {"name": "John Doe"}, limit=5)
    print("Users named 'John Doe'", john)

    # Update documents
    updated = await DB.update_document("users", {"name": "John Doe"}, {"age": 999})
    print(f"Updated {updated} documents")

    # Delete documents
    deleted = await DB.delete_documents("users", {"name": "John Doe"})
    print(f"Deleted {deleted} documents")

if __name__ == "__main__":
    asyncio.run(main())