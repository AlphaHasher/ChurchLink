from bson import ObjectId
import re
from mongo.database import DB
from datetime import datetime
from mongo.roles import RoleHandler
from helpers.MongoHelper import serialize_objectid_deep
from typing import Tuple, List, Dict

class UserHandler:
    @staticmethod
    async def is_user(uid):
        return len(await DB.find_documents("users", {"uid": uid})) > 0

    ################
    ## Operations ##
    ################
    @staticmethod
    async def create_schema(first_name:str, last_name:str, email:str, verified:bool, uid:str, roles:list, phone=None, birthday=None, address=None, ministries=None, favorite_events=None):
        return {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "verified":verified,
            "membership": False,
            "uid": uid,
            "roles": await RoleHandler.names_to_ids(roles),
            "ministries": ministries or [],
            "favorite_events": favorite_events or [],
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
            "notification_preferences": {
                "Event Notification": True,
                "App Announcements": True,
                "Live Stream Alerts": True
            },
            "people": [],
            "my_events": [],
            "sermon_favorites": [],
            "createdOn": datetime.now(),
        }

    @staticmethod
    async def create_user(first_name, last_name, email, uid, roles, verified=False, phone=None, birthday=None, address=None, ministries=None, favorite_events=None):
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
                verified,
                uid,
                roles,
                phone,
                birthday,
                address,
                ministries,
                favorite_events
            ))
        except Exception as e:
            print(f"An error occurred:\n {e}")

    @staticmethod
    def create_person_schema(first_name: str, last_name: str, gender: str, date_of_birth):
        """
        date_of_birth: a datetime (or date) object you pass in.
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
    def create_sermon_ref_schema(
        sermon_id: ObjectId,
        *,
        reason: str = "favorite",
        meta: dict | None = None,
    ):
        return {
            "sermon_id": sermon_id,
            "reason": reason,
            "key": f"{sermon_id}|{reason}",
            "meta": meta or {},
            "addedOn": datetime.now(),
        }
    
    # Intelligent pagination search for the users in admin dash
    @staticmethod
    async def search_users_paged(params) -> Tuple[int, List[Dict]]:
        """
        Server-side search/pagination/sort for users.
        - params.searchField: "email" | "name"
        - params.searchTerm: case-insensitive "contains"
        - params.sortBy: "email" | "name" | "createdOn" | "uid" | "membership"
        - params.sortDir: "asc" | "desc"
        - params.hasRolesOnly: if True, filter to users with roles != []
        Returns: (total_count, users_list)
        """
        db = DB.db["users"]

        filt: Dict = {}

        if getattr(params, "hasRolesOnly", False):
            filt["roles"] = {"$exists": True, "$ne": []}

        term = (params.searchTerm or "").strip()
        if term:
            pat = re.escape(term)
            if params.searchField == "email":
                filt["email"] = {"$regex": pat, "$options": "i"}
            else:
                name_or = [
                    {"first_name": {"$regex": pat, "$options": "i"}},
                    {"last_name": {"$regex": pat, "$options": "i"}},
                    {
                        "$expr": {
                            "$regexMatch": {
                                "input": {"$concat": ["$first_name", " ", "$last_name"]},
                                "regex": pat,
                                "options": "i",
                            }
                        }
                    },
                ]
                filt["$or"] = name_or

        sort_dir = 1 if params.sortDir == "asc" else -1
        if params.sortBy == "email":
            sort_keys = [("email", sort_dir), ("uid", 1)]
        elif params.sortBy == "uid":
            sort_keys = [("uid", sort_dir)]
        elif params.sortBy == "membership":
            sort_keys = [("membership", sort_dir)]
        elif params.sortBy == "name":
            sort_keys = [("last_name", sort_dir), ("first_name", sort_dir), ("email", 1)]
        else:
            sort_keys = [("createdOn", sort_dir), ("uid", 1)]

        total = await db.count_documents(filt)

        skip = max(0, params.page) * max(1, params.pageSize)
        limit = max(1, params.pageSize)

        cursor = (
            db.find(
                filt,
                {
                    "_id": 0,
                    "uid": 1,
                    "first_name": 1,
                    "last_name": 1,
                    "email": 1,
                    "membership": 1,
                    "roles": 1,
                    "createdOn": 1,
                },
            )
            .sort(sort_keys)
            .skip(skip)
            .limit(limit)
        )
        users = [doc async for doc in cursor]
        return total, users

    @staticmethod
    async def find_all_users():
        return await DB.find_documents("users", {})


    @staticmethod
    async def find_users_with_role_id(role_id):
        return await DB.find_documents("users", {"roles": role_id})
    
    @staticmethod
    async def fetch_focused_user_content_with_role_id(role_id: str) -> List[Dict]:
        rid = (role_id or "").strip()
        if not rid:
            raise ValueError("invalid role_id")

        coll = DB.db["users"]

        query = {"roles": rid}

        cursor = coll.find(
            query,
            {
                "_id": 0,
                "uid": 1,
                "first_name": 1,
                "last_name": 1,
                "email": 1,
                "roles": 1,
            },
        )
        return [doc async for doc in cursor]

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
    async def add_to_sermon_favorites(
        *,
        uid: str,
        sermon_id: ObjectId,
        reason: str = "favorite",
        meta: dict | None = None,
    ):
        ref = UserHandler.create_sermon_ref_schema(
            sermon_id=sermon_id,
            reason=reason,
            meta=meta,
        )

        result = await DB.db["users"].update_one(
            {"uid": uid, "sermon_favorites.sermon_id": {"$ne": sermon_id}},
            {"$push": {"sermon_favorites": ref}},
        )
        return ref if result.modified_count == 1 else None

    @staticmethod
    async def remove_from_sermon_favorites(*, uid: str, sermon_id: ObjectId) -> bool:
        result = await DB.db["users"].update_one(
            {"uid": uid},
            {"$pull": {"sermon_favorites": {"sermon_id": sermon_id}}},
        )
        return result.modified_count == 1

    @staticmethod
    async def list_sermon_favorites(uid: str, expand: bool = False):
        if not expand:
            user = await DB.db["users"].find_one(
                {"uid": uid},
                {"_id": 0, "sermon_favorites": 1},
            )
            return (user or {}).get("sermon_favorites", [])

        pipeline = [
            {"$match": {"uid": uid}},
            {"$unwind": {"path": "$sermon_favorites", "preserveNullAndEmptyArrays": False}},
            {
                "$lookup": {
                    "from": "sermons",
                    "localField": "sermon_favorites.sermon_id",
                    "foreignField": "_id",
                    "as": "sermon",
                }
            },
            {"$unwind": "$sermon"},
            {
                "$replaceRoot": {
                    "newRoot": {
                        "$mergeObjects": [
                            "$sermon_favorites",
                            {"sermon": "$sermon"},
                        ]
                    }
                }
            },
        ]

        cursor = DB.db["users"].aggregate(pipeline)
        favorites = [serialize_objectid_deep(doc) async for doc in cursor]
        return favorites
    
    @staticmethod
    async def list_people(uid: str):
        doc = await DB.db["users"].find_one({"uid": uid}, {"people": 1, "_id": 0})
        return doc.get("people", []) if doc else []
    
    @staticmethod
    async def update_user(filterQuery, updateData):
        return await DB.update_document("users", filterQuery, updateData)

    @staticmethod
    async def update_roles(uid, roles):
        if not await UserHandler.is_user(uid):
            print(f"User with this uid does not exist: {uid}")
            return False

        try:
            await DB.update_document("users", {"uid": uid}, {
                    "roles": roles
            })
        except Exception as e:
            print(f"An error occurred:\n {e}")
            return False
        
    @staticmethod
    async def update_person(uid: str, person_id: ObjectId, updates: dict):
        """
        Updates specific fields on an embedded Person by _id.
        Example 'updates': {"first_name": "New", "gender": "M"}
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
    # TODO: THIS NEEDS REWORKING SINCE IT RELIES ON MY EVENTS DESIGN PATTERNS
    # NEED TO FIX THIS LATER
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
    
    