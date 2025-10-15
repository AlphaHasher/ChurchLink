#!/usr/bin/env python3
"""
Event Data Cleanup Script

This script cleans all event registration and payment data while preserving:
- Event definitions and details
- User accounts and profiles
- Family member data
- Other non-event related data

Collections cleaned:
- transactions (completely removed)
- donations_subscriptions (completely removed) 
- bulk_registrations (completely removed if exists)
- events.attendees, events.attendee_keys, events.seats_taken (reset)
- users.my_events (cleared)

Usage:
    python cleanup_event_data.py [--dry-run]
"""

import asyncio
import sys
import argparse
from datetime import datetime
from mongo.database import DB
from bson import ObjectId


class EventDataCleanup:
    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.stats = {
            'collections_dropped': 0,
            'events_cleaned': 0,
            'users_cleaned': 0,
            'total_registrations_removed': 0
        }

    async def connect_db(self):
        """Initialize database connection"""
        print("🔌 Connecting to MongoDB...")
        await DB.connect_to_database()
        print("✅ Connected to database")

    async def cleanup_payment_collections(self):
        """Remove all payment-related collections completely"""
        payment_collections = [
            'transactions',
            'donations_subscriptions', 
            'bulk_registrations'
        ]
        
        print("\n🗑️  Cleaning payment collections...")
        
        for collection_name in payment_collections:
            try:
                # Check if collection exists
                collection_names = await DB.db.list_collection_names()
                if collection_name in collection_names:
                    if self.dry_run:
                        doc_count = await DB.db[collection_name].count_documents({})
                        print(f"   [DRY RUN] Would drop collection '{collection_name}' ({doc_count} documents)")
                    else:
                        doc_count = await DB.db[collection_name].count_documents({})
                        await DB.db[collection_name].drop()
                        print(f"   ✅ Dropped collection '{collection_name}' ({doc_count} documents)")
                        self.stats['collections_dropped'] += 1
                else:
                    print(f"   ℹ️  Collection '{collection_name}' doesn't exist - skipping")
            except Exception as e:
                print(f"   ❌ Error dropping collection '{collection_name}': {e}")

    async def cleanup_event_attendees(self):
        """Clean attendee data from events while preserving event definitions"""
        print("\n🎪 Cleaning event attendee data...")
        
        try:
            # Find all events with attendee data
            events_cursor = DB.db["events"].find({
                "$or": [
                    {"attendees": {"$exists": True, "$ne": []}},
                    {"attendee_keys": {"$exists": True, "$ne": []}},
                    {"seats_taken": {"$gt": 0}}
                ]
            })
            
            events_with_attendees = await events_cursor.to_list(length=None)
            
            if not events_with_attendees:
                print("   ℹ️  No events with attendee data found")
                return

            print(f"   Found {len(events_with_attendees)} events with attendee data")

            if self.dry_run:
                for event in events_with_attendees:
                    attendee_count = len(event.get('attendees', []))
                    print(f"   [DRY RUN] Would clean event '{event.get('name', 'Unknown')}' ({attendee_count} attendees)")
            else:
                # Clean attendee data from all events
                result = await DB.db["events"].update_many(
                    {},  # Update all events
                    {
                        "$set": {
                            "attendees": [],
                            "attendee_keys": [],
                            "seats_taken": 0
                        }
                    }
                )
                
                print(f"   ✅ Cleaned attendee data from {result.modified_count} events")
                self.stats['events_cleaned'] = result.modified_count

        except Exception as e:
            print(f"   ❌ Error cleaning event attendees: {e}")

    async def cleanup_user_registrations(self):
        """Clean user event registrations (my_events field)"""
        print("\n👥 Cleaning user event registrations...")
        
        try:
            # Find users with event registrations
            users_cursor = DB.db["users"].find({
                "my_events": {"$exists": True, "$ne": []}
            })
            
            users_with_events = await users_cursor.to_list(length=None)
            
            if not users_with_events:
                print("   ℹ️  No users with event registrations found")
                return

            # Count total registrations for stats
            total_registrations = sum(len(user.get('my_events', [])) for user in users_with_events)
            self.stats['total_registrations_removed'] = total_registrations

            print(f"   Found {len(users_with_events)} users with {total_registrations} total registrations")

            if self.dry_run:
                for user in users_with_events:
                    reg_count = len(user.get('my_events', []))
                    email = user.get('email', 'Unknown')
                    print(f"   [DRY RUN] Would clear {reg_count} registrations for user {email}")
            else:
                # Clear my_events field from all users
                result = await DB.db["users"].update_many(
                    {"my_events": {"$exists": True}},
                    {"$set": {"my_events": []}}
                )
                
                print(f"   ✅ Cleared event registrations from {result.modified_count} users")
                self.stats['users_cleaned'] = result.modified_count

        except Exception as e:
            print(f"   ❌ Error cleaning user registrations: {e}")

    async def verify_event_data_preserved(self):
        """Verify that event definitions are still intact"""
        print("\n✅ Verifying event data preservation...")
        
        try:
            events_count = await DB.db["events"].count_documents({})
            print(f"   📊 {events_count} events preserved")
            
            # Check a sample event to ensure core data is intact
            sample_event = await DB.db["events"].find_one({})
            if sample_event:
                required_fields = ['name', 'description', 'date', 'location', 'price']
                missing_fields = [field for field in required_fields if field not in sample_event]
                
                if missing_fields:
                    print(f"   ⚠️  Warning: Sample event missing fields: {missing_fields}")
                else:
                    print("   ✅ Event structure verified - core data intact")
                    
                # Check that attendee fields are cleaned
                attendees = sample_event.get('attendees', [])
                seats_taken = sample_event.get('seats_taken', 0)
                if len(attendees) == 0 and seats_taken == 0:
                    print("   ✅ Attendee data successfully cleaned")
                else:
                    print(f"   ⚠️  Warning: Sample event still has attendee data")

        except Exception as e:
            print(f"   ❌ Error verifying event data: {e}")

    async def print_summary(self):
        """Print cleanup summary"""
        print("\n" + "="*50)
        print("🧹 CLEANUP SUMMARY")
        print("="*50)
        
        if self.dry_run:
            print("   🔍 DRY RUN - No actual changes made")
        else:
            print(f"   🗑️  Collections dropped: {self.stats['collections_dropped']}")
            print(f"   🎪 Events cleaned: {self.stats['events_cleaned']}")
            print(f"   👥 Users cleaned: {self.stats['users_cleaned']}")
            print(f"   📝 Total registrations removed: {self.stats['total_registrations_removed']}")
            
        print("\n✨ Event list preserved and refreshed!")
        print("🚀 Ready for fresh event registrations!")

    async def run_cleanup(self):
        """Run the complete cleanup process"""
        start_time = datetime.now()
        
        print("🧹 EVENT DATA CLEANUP STARTING")
        print("="*50)
        
        if self.dry_run:
            print("🔍 RUNNING IN DRY-RUN MODE - No changes will be made")
            print("="*50)
        
        try:
            await self.connect_db()
            await self.cleanup_payment_collections()
            await self.cleanup_event_attendees()
            await self.cleanup_user_registrations()
            await self.verify_event_data_preserved()
            await self.print_summary()
            
        except Exception as e:
            print(f"\n❌ Cleanup failed: {e}")
            return False
        
        finally:
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            print(f"\n⏱️  Total time: {duration:.2f} seconds")
        
        return True


async def main():
    parser = argparse.ArgumentParser(description='Clean event registration and payment data')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Show what would be cleaned without making changes')
    
    args = parser.parse_args()
    
    cleanup = EventDataCleanup(dry_run=args.dry_run)
    
    if not args.dry_run:
        print("⚠️  WARNING: This will permanently delete all event registration and payment data!")
        print("   Events themselves will be preserved, but all attendees and payments will be removed.")
        response = input("   Are you sure you want to continue? (type 'yes' to confirm): ")
        
        if response.lower() != 'yes':
            print("❌ Cleanup cancelled")
            return
    
    success = await cleanup.run_cleanup()
    
    if success:
        print("\n🎉 Cleanup completed successfully!")
        if not args.dry_run:
            print("   Event registration system is now fresh and ready!")
    else:
        print("\n💥 Cleanup failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())