from bson import ObjectId

from mongo.database import DB
from datetime import datetime
from mongo.roles import RoleHandler

class UserHandler:
    @staticmethod
    async def is_user(uid):
        return len(await DB.find_documents("users", {"uid": uid})) > 0

    ################
    ## Operations ##
    ################
    @staticmethod
    async def create_schema(first_name:str, last_name:str, email:str, uid:str, roles:list, phone=None, birthday=None, address=None):
        return {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "uid": uid,
            "roles": await RoleHandler.names_to_ids(roles),
            "phone": phone,
            "birthday": birthday,
            "gender": None,
            "address": address or {
                "address": None,
                "suite": None,
                "city": None,
                "state": None,
                "country": None,
                "postal_code": None
            },

            "people": [],
            "my_events": [],
            "bible_notes": [],
            "createdOn": datetime.now(),
        }

    @staticmethod
    async def create_user(first_name, last_name, email, uid, roles, phone=None, birthday=None, address=None):
        """
        'roles' is a list of role names
        """
        if await UserHandler.is_user(uid):
            print(f"User with this uid already exists: {uid}")
            return

        try:
            await DB.insert_document("users", await UserHandler.create_schema(
                first_name,
                last_name,
                email,
                uid,
                roles,
                phone,
                birthday,
                address
            ))
        except Exception as e:
            print(f"An error occurred:\n {e}")

    @staticmethod
    def create_person_schema(first_name: str, last_name: str, gender: str, date_of_birth):
        """
        date_of_birth: a datetime (or date) object you pass in.
        gender: consider normalizing/validating to an allowed set, e.g. {"male","female","nonbinary","unspecified"}.
        """
        return {
            "_id": ObjectId(),       # local id for this embedded person
            "first_name": first_name,
            "last_name": last_name,
            "gender": gender,
            "date_of_birth": date_of_birth,   # (aka DOB)
            "createdOn": datetime.now(),
        }

    @staticmethod
    def create_event_ref_schema(
        event_id: ObjectId,
        reason: str,            # "watch" | "rsvp"  (RSVP not implemented here, but future-proof)
        scope: str,             # "series" | "occurrence"
        series_id: ObjectId = None,   # optional: if your model separates series vs instances
        occurrence_id: ObjectId = None,  # optional: if occurrences are stored as docs
        occurrence_start=None,  # optional: datetime for the chosen occurrence time
        meta: dict | None = None,
        person_id: ObjectId = None  # optional: for family member registrations
    ):
        """
        A normalized reference to an event the user is 'involved in'.

        Uniqueness key ensures add/remove is easy and duplicates are prevented.
        """
        # Build a stable “composite key” to enforce uniqueness inside the array
        parts = [
            str(event_id),
            scope,
            str(series_id) if series_id else "",
            str(occurrence_id) if occurrence_id else "",
            occurrence_start.isoformat() if occurrence_start else "",
            reason
        ]
        unique_key = "|".join(parts)

        return {
            "_id": ObjectId(),          # local id of the embedded record
            "event_id": event_id,       # required
            "person_id": person_id,     # optional: for family member registrations
            "reason": reason,           # "watch" or (later) "rsvp"
            "scope": scope,             # "series" or "occurrence"
            "series_id": series_id,     # optional
            "occurrence_id": occurrence_id,   # optional
            "occurrence_start": occurrence_start,  # optional datetime
            "key": unique_key,          # used with $addToSet / $pull
            "meta": meta or {},         # room for notification prefs, etc.
            "addedOn": datetime.now(),
        }

    @staticmethod
    async def find_all_users():
        return await DB.find_documents("users", {})

    @staticmethod
    async def find_users_with_role_id(role_id):
        return await DB.find_documents("users", {"roles": role_id})

    @staticmethod
    async def find_users_with_permissions(permission_names):
        roles_with_permissions = await RoleHandler.find_roles_with_permissions(permission_names)
        role_ids = [role["_id"] for role in roles_with_permissions]
        return await DB.find_documents("users", {"roles": {"$in": role_ids}}) if role_ids else []

    @staticmethod
    async def find_by_first_name(first_name):
        return await DB.find_documents("users", {"first_name": first_name})

    @staticmethod
    async def find_by_last_name(last_name):
        return await DB.find_documents("users", {"last_name": last_name})

    @staticmethod
    async def find_by_full_name(first_name, last_name):
        return await DB.find_documents("users", {
            "first_name": first_name,
            "last_name": last_name
        })

    @staticmethod
    async def find_by_email(email):
        return await DB.find_documents("users", {"email": email})
    
    @staticmethod
    async def find_by_uid(uid):
        docs = await DB.find_documents("users", {"uid": uid}, 1)
        if len(docs) == 0:
            return False
        return docs[0]
    
    @staticmethod
    async def does_user_have_permissions(uid):
        user = await UserHandler.find_by_uid(uid)
        if user == None:
            return False
        return len(user['roles']) > 0


    @staticmethod
    async def find_by_phone(phone):
        return await DB.find_documents("users", {"phone": phone})

    @staticmethod
    async def find_by_age(age):
        today = datetime.now()
        start_date = datetime(today.year - age - 1, today.month, today.day)
        end_date = datetime(today.year - age, today.month, today.day)
        return await DB.find_documents("users", {
            "birthday": {
                "$gte": start_date,
                "$lt": end_date
            }
        })
    
    @staticmethod
    async def get_person(uid: str, person_id: ObjectId):
        doc = await DB.db["users"].find_one(
            {"uid": uid, "people._id": person_id},
            {"people.$": 1}  # project only the matched element
        )
        if not doc or "people" not in doc or not doc["people"]:
            return None
        return doc["people"][0]
    
    @staticmethod
    async def list_my_events(uid: str, expand: bool = False, person_id: ObjectId = None):
        """
        If expand=True, join with 'events' to return full event docs alongside refs.
        If person_id is provided, filter events for specific family member.
        """
        if not expand:
            user = await DB.db["users"].find_one({"uid": uid}, {"_id": 0, "my_events": 1})
            events = (user or {}).get("my_events", [])
            if person_id:
                events = [event for event in events if event.get("person_id") == person_id]
            return events

        pipeline = [
            {"$match": {"uid": uid}},
            {"$unwind": {"path": "$my_events", "preserveNullAndEmptyArrays": False}},
        ]

        # Add person_id filter if specified
        if person_id:
            pipeline.append({"$match": {"my_events.person_id": person_id}})

        pipeline.extend([
            {"$lookup": {
                "from": "events",
                "localField": "my_events.event_id",
                "foreignField": "_id",
                "as": "event"
            }},
            {"$unwind": "$event"},
            {"$replaceRoot": {"newRoot": {
                "$mergeObjects": [
                    "$my_events",
                    {"event": "$event"}
                ]
            }}}
        ])
        cursor = DB.db["users"].aggregate(pipeline)
        return [doc async for doc in cursor]
    
    @staticmethod
    async def list_people(uid: str):
        doc = await DB.db["users"].find_one({"uid": uid}, {"people": 1, "_id": 0})
        return doc.get("people", []) if doc else []
    
    @staticmethod
    async def update_user(filterQuery, updateData):
        return await DB.update_document("users", filterQuery, updateData)

    @staticmethod
    async def update_roles(uid, roles, strapiSyncFunction):
        if not await UserHandler.is_user(uid):
            print(f"User with this uid does not exist: {uid}")
            return False

        try:
            await DB.update_document("users", {"uid": uid}, {
                    "roles": roles
            })
            return await strapiSyncFunction(uid)
        except Exception as e:
            print(f"An error occurred:\n {e}")
            return False
        
    @staticmethod
    async def update_person(uid: str, person_id: ObjectId, updates: dict):
        """
        Updates specific fields on an embedded Person by _id.
        Example 'updates': {"first_name": "New", "gender": "nonbinary"}
        """
        # Build a $set mapping like {"people.$[p].first_name": "New", ...}
        set_fields = {f"people.$[p].{k}": v for k, v in updates.items()}
        result = await DB.db["users"].update_one(
            {"uid": uid},
            {"$set": set_fields},
            array_filters=[{"p._id": person_id}]
        )
        return result.modified_count == 1
        
    @staticmethod
    async def add_to_my_events(
        uid: str,
        event_id: ObjectId,
        *,
        reason: str = "watch",            # "watch" now; "rsvp" later if needed
        scope: str = "series",            # "series" or "occurrence"
        series_id: ObjectId | None = None,
        occurrence_id: ObjectId | None = None,
        occurrence_start=None,
        meta: dict | None = None,
        person_id: ObjectId = None        # optional: for family member registrations
    ):
        ref = UserHandler.create_event_ref_schema(
            event_id=event_id,
            reason=reason,
            scope=scope,
            series_id=series_id,
            occurrence_id=occurrence_id,
            occurrence_start=occurrence_start,
            meta=meta,
            person_id=person_id
        )

        result = await DB.db["users"].update_one(
           {"uid": uid},
           {"$addToSet": {"my_events": ref}}
        )
        # Only return ref if we actually added it (not when it was a duplicate)
        return ref if result.modified_count == 1 else None
    
    @staticmethod
    async def add_person_to_user(uid: str, first_name: str, last_name: str, gender: str, date_of_birth):
        """
        Appends a Person to a user's embedded 'people' array.
        Returns the embedded person's _id if successful, or None if user not found.
        """
        person = UserHandler.create_person_schema(first_name, last_name, gender, date_of_birth)
        result = await DB.db["users"].update_one(
            {"uid": uid},
            {"$push": {"people": person}}
        )
        return person["_id"] if result.modified_count == 1 else None

    @staticmethod
    async def delete_user(email):
        try:
            await DB.delete_documents("users", {"email": email})
        except Exception as e:
            print(f"An error occurred:\n {e}")

    @staticmethod
    async def remove_from_my_events(uid: str, *, key: str = None, event_id: ObjectId = None,
                                    reason: str = None, scope: str = None,
                                    occurrence_id: ObjectId = None, occurrence_start=None,
                                    series_id: ObjectId = None, person_id: ObjectId = None, _person_id_provided: bool = False):
        """
        Remove by the stable 'key' (recommended) OR by matching fields.
        
        Important: When person_id is None and _person_id_provided is True, it means we want to remove
        entries for the main user (no person_id). When _person_id_provided is False, person_id is ignored.
        """
        if key:
            criteria = {"key": key}
        else:
            # build a precise matcher
            criteria = {"event_id": event_id}
            if reason is not None:
                criteria["reason"] = reason
            if scope is not None:
                criteria["scope"] = scope
            if series_id is not None:
                criteria["series_id"] = series_id
            if occurrence_id is not None:
                criteria["occurrence_id"] = occurrence_id
            if occurrence_start is not None:
                criteria["occurrence_start"] = occurrence_start
            
            # Handle person_id with proper distinction between None and not provided
            if _person_id_provided:
                if person_id is not None:
                    # Remove entry for specific family member
                    criteria["person_id"] = person_id
                else:
                    # Remove entry for main user (no person_id or person_id is null)
                    criteria["$or"] = [
                        {"person_id": {"$exists": False}},
                        {"person_id": None}
                    ]

        result = await DB.db["users"].update_one(
            {"uid": uid},
            {"$pull": {"my_events": criteria}}
        )
        return result.modified_count == 1
    
    @staticmethod
    async def remove_person(uid: str, person_id: ObjectId):
        """
        Remove a family member and clean up their event registrations.
        """
        try:
            # First, get all events this family member is registered for
            family_member_events = await UserHandler.list_my_events(uid, expand=False, person_id=person_id)
            
            # Remove the person from the people array
            result = await DB.db["users"].update_one(
                {"uid": uid},
                {"$pull": {"people": {"_id": person_id}}}
            )

            if result.modified_count == 1:
                # Clean up event registrations from user's my_events
                cleanup_result = await DB.db["users"].update_one(
                    {"uid": uid},
                    {"$pull": {"my_events": {"person_id": person_id}}}
                )
                print(f"Cleaned up {cleanup_result.modified_count} event registrations from user my_events for family member {person_id}")

                # Now remove the family member from all event attendee lists
                from models.event import rsvp_remove_person
                events_cleaned = 0
                for event_record in family_member_events:
                    event_id = str(event_record.get("event_id"))
                    if event_id:
                        try:
                            # Use the existing rsvp_remove_person function to clean up event attendee lists
                            removed = await rsvp_remove_person(event_id, uid, person_id)
                            if removed:
                                events_cleaned += 1
                        except Exception as e:
                            print(f"Warning: Failed to remove family member {person_id} from event {event_id}: {e}")
                
                print(f"Cleaned up family member {person_id} from {events_cleaned} event attendee lists")

            return result.modified_count == 1
        except Exception as e:
            print(f"Error removing person {person_id}: {e}")
            return False
    
    