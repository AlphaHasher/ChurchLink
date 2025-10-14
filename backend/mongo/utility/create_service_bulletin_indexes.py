"""
MongoDB Index Creation Script for Service Bulletins Collection

This script documents and creates the required indexes for the service_bulletins collection.

Required indexes:
1. {display_week: -1, order: 1} - For efficient weekly retrieval and ordering
2. {published: 1, display_week: -1} - For filtering published services by week
3. {title: 1, display_week: -1} - Unique constraint to prevent duplicate titles per week
4. {service_time: 1} - For filtering upcoming services

Run this script once to create indexes:
    python backend/mongo/utility/create_service_bulletin_indexes.py
"""

import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from mongo.database import DB


async def create_service_bulletin_indexes():
	"""Create indexes for service_bulletins collection"""
	if DB.db is None:
		print("Error: Database connection not initialized")
		return False

	collection = DB.db["service_bulletins"]
	
	print("Creating indexes for service_bulletins collection...")
	
	try:
		# Index 1: Efficient weekly retrieval with ordering
		await collection.create_index(
			[("display_week", -1), ("order", 1)],
			name="idx_display_week_order"
		)
		print("✓ Created index: idx_display_week_order")
		
		# Index 2: Published filter with week sorting
		await collection.create_index(
			[("published", 1), ("display_week", -1)],
			name="idx_published_week"
		)
		print("✓ Created index: idx_published_week")
		
		# Index 3: Unique constraint - prevent duplicate titles per week
		await collection.create_index(
			[("title", 1), ("display_week", -1)],
			unique=True,
			name="idx_unique_title_per_week"
		)
		print("✓ Created unique index: idx_unique_title_per_week")
		
		# Index 4: Service time for upcoming filters
		await collection.create_index(
			[("service_time", 1)],
			name="idx_service_time"
		)
		print("✓ Created index: idx_service_time")
		
		print("\n✅ All indexes created successfully!")
		return True
		
	except Exception as e:
		print(f"\n❌ Error creating indexes: {e}")
		return False


async def list_existing_indexes():
	"""List all existing indexes on service_bulletins collection"""
	if DB.db is None:
		print("Error: Database connection not initialized")
		return
	
	collection = DB.db["service_bulletins"]
	
	print("\nExisting indexes on service_bulletins collection:")
	print("-" * 60)
	
	try:
		indexes = await collection.list_indexes().to_list(length=None)
		for idx in indexes:
			print(f"Name: {idx.get('name')}")
			print(f"Keys: {idx.get('key')}")
			if idx.get('unique'):
				print("Unique: True")
			print("-" * 60)
	except Exception as e:
		print(f"Error listing indexes: {e}")


async def main():
	"""Main function to initialize DB and create indexes"""
	print("Service Bulletin Indexes Migration Script")
	print("=" * 60)
	
	# Initialize database connection
	await DB.init_db()
	
	if DB.db is None:
		print("Failed to initialize database connection")
		return
	
	# List existing indexes
	await list_existing_indexes()
	
	# Create new indexes
	success = await create_service_bulletin_indexes()
	
	# List indexes after creation
	if success:
		await list_existing_indexes()


if __name__ == "__main__":
	asyncio.run(main())
