#!/usr/bin/env python3
"""
Backfill script: ensures 'people' and 'my_events' arrays exist on all users.

- Adds people: [] where missing or not an array
- Adds my_events: [] where missing or not an array
- Dry-run by default; pass --execute to make changes
- Can override Mongo URL/DB via CLI or env

Usage:
  python backfill_users_people_my_events.py --execute
  python backfill_users_people_my_events.py --dry-run
  python backfill_users_people_my_events.py --uri mongodb://localhost:27017 --db SSBC_DB --execute
"""

import os
import sys
import argparse
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

DEFAULT_URI = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DEFAULT_DB  = os.getenv("DB_NAME", "SSBC_DB")

def parse_args():
    p = argparse.ArgumentParser(description="Backfill users.people and users.my_events")
    p.add_argument("--uri", default=DEFAULT_URI, help=f"Mongo connection string (default from MONGODB_URL or {DEFAULT_URI})")
    p.add_argument("--db", default=DEFAULT_DB, help=f"Database name (default from DB_NAME or {DEFAULT_DB})")
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--execute", action="store_true", help="Apply changes (otherwise dry-run)")
    mode.add_argument("--dry-run", action="store_true", help="Dry-run only (default)")
    return p.parse_args()

async def count_needs_backfill_users(db):
    """
    Detect users that are missing or have non-array values for the target fields.
    """
    users = db["users"]

    # $type 4 == array
    missing_people_q = {"$or": [{"people": {"$exists": False}}, {"$and": [{"people": {"$exists": True}}, {"$expr": {"$ne": [{"$type": "$people"}, "array"]}}]}]}
    missing_my_events_q = {"$or": [{"my_events": {"$exists": False}}, {"$and": [{"my_events": {"$exists": True}}, {"$expr": {"$ne": [{"$type": "$my_events"}, "array"]}}]}]}

    people_missing = await users.count_documents(missing_people_q)
    my_events_missing = await users.count_documents(missing_my_events_q)

    return people_missing, my_events_missing, missing_people_q, missing_my_events_q

async def backfill(db, execute: bool):
    users = db["users"]

    people_missing_count, my_events_missing_count, missing_people_q, missing_my_events_q = await count_needs_backfill_users(db)

    print(f"[INFO] Users missing/incorrect 'people': {people_missing_count}")
    print(f"[INFO] Users missing/incorrect 'my_events': {my_events_missing_count}")

    if not execute:
        print("[DRY-RUN] No changes applied. Re-run with --execute to apply.")
        return

    # Set missing/non-array to []
    # Using two update_many calls keeps it simple and idempotent
    res_people = await users.update_many(missing_people_q, {"$set": {"people": []}})
    res_my_events = await users.update_many(missing_my_events_q, {"$set": {"my_events": []}})

    print(f"[APPLIED] users updated with people: [] -> {res_people.modified_count}")
    print(f"[APPLIED] users updated with my_events: [] -> {res_my_events.modified_count}")

async def sanity_check(db):
    """
    Quick follow-up counts to confirm.
    """
    users = db["users"]
    still_missing_people = await users.count_documents({"$or": [{"people": {"$exists": False}}, {"$expr": {"$ne": [{"$type": "$people"}, "array"]}}]})
    still_missing_my_events = await users.count_documents({"$or": [{"my_events": {"$exists": False}}, {"$expr": {"$ne": [{"$type": "$my_events"}, "array"]}}]})
    print(f"[CHECK] Remaining users needing people backfill: {still_missing_people}")
    print(f"[CHECK] Remaining users needing my_events backfill: {still_missing_my_events}")

async def main():
    args = parse_args()

    # Default to dry-run unless --execute explicitly provided
    execute = True if args.execute else False

    print(f"[INFO] Connecting to Mongo @ {args.uri}, DB={args.db}")
    client = AsyncIOMotorClient(args.uri)
    try:
        # sanity ping
        await client.admin.command("ping")
        print("[INFO] MongoDB ping OK")
    except Exception as e:
        print(f"[ERROR] Could not connect/ping MongoDB: {e}")
        sys.exit(1)

    db = client[args.db]

    try:
        await backfill(db, execute=execute)
        await sanity_check(db)
    finally:
        client.close()
        print("[INFO] Closed Mongo client")

if __name__ == "__main__":
    asyncio.run(main())

