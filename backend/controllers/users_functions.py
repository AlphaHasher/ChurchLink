from mongo.firebase_sync import FirebaseSyncer
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler
from pydantic import BaseModel, Field
from fastapi import Request
from typing import Optional
from datetime import datetime
import re
from datetime import datetime, timezone

NAME_RE = re.compile(r"^[A-Za-z][A-Za-z .'\-]{0,49}$")


class MyPermsRequest(BaseModel):
    user_assignable_roles: bool
    event_editor_roles: bool
    user_role_ids: bool

class PersonalInfo(BaseModel):
    first_name: str
    last_name: str
    email: str
    birthday: Optional[datetime]
    gender: Optional[str]

def is_valid_name(s: str) -> bool:
    if not s:
        return False
    return bool(NAME_RE.match(s))

def is_over_13(bday: datetime) -> int:
    today = datetime.now(timezone.utc).date()
    d = bday.date()
    return today.year - d.year - ((today.month, today.day) < (d.month, d.day))

async def process_sync_by_uid(request:Request):
    uid = request.state.uid
    syncRequest = await FirebaseSyncer.syncUserByUID(uid)
    if syncRequest:
        return { "verified": True }
    else:
        return {'verified': False}
    
async def fetch_users():
    raw_users = await UserHandler.find_all_users()
    users = [
        {   
            "uid": u.get("uid"),
            "first_name": u.get("first_name"),
            "last_name": u.get("last_name"),
            "email": u.get("email"),
            "roles": u.get("roles", [])
        }
        for u in raw_users
    ]
    return {"success": True, "users": users}
    
async def get_my_permissions(payload: MyPermsRequest, request:Request):
    user = request.state.user
    perms = request.state.perms

    retDict = {"success":True, "perms":perms, "msg":"", "user_assignable_roles":[], "event_editor_roles":[], "user_role_ids":[]}

    if payload.user_assignable_roles:
        raw_roles = await RoleHandler.get_user_assignable_roles(perms)
        roles = [
            {"_id" :str(r.get("_id")),
                "name": r.get("name"),
                "permissions": r.get("permissions", {})
            }
            for r in raw_roles
        ]
        retDict['user_assignable_roles'] = roles
        
    if payload.event_editor_roles:
        raw_roles = await RoleHandler.get_user_event_editor_roles(user['roles'], perms)
        roles = [
            {"_id" :str(r.get("_id")),
                "name": r.get("name"),
                "permissions": r.get("permissions", {})
            }
            for r in raw_roles
        ]
        retDict['event_editor_roles'] = roles
    if payload.user_role_ids:
        retDict['user_role_ids'] = user['roles']
    
    return retDict

async def fetch_profile_info(request: Request):
    user = request.state.user

    profile_info = PersonalInfo(
        first_name=user.get("first_name", ""),
        last_name=user.get("last_name", ""),
        email=user.get("email", ""),
        birthday=user.get("birthday"),
        gender=user.get("gender")
    )

    return {
        "success": True,
        "profile_info": profile_info.model_dump()
    }

async def update_profile(request: Request, profile_info: PersonalInfo):
    uid = request.state.uid

    # Excluding Email because we never want to change email from the profile changing section, so we may as well prune it here.
    update_data = {
        "first_name": (profile_info.first_name or "").strip(),
        "last_name": (profile_info.last_name or "").strip(),
        "birthday": profile_info.birthday,
        "gender": profile_info.gender,
    }

    # Ensure name inputs are valid and sane
    if not (is_valid_name(update_data["first_name"]) and is_valid_name(update_data["last_name"])):
        return {"success": False, "msg": "Please enter valid name inputs!"}

    # Ensure that the user provided a birthday
    bday = update_data["birthday"]
    if bday is None:
        return {"success": False, "msg": "You must be 13 years or older to register!"}

    # Ensure bday has a proper timezone for comparison
    if bday.tzinfo is None:
        bday = bday.replace(tzinfo=timezone.utc)
    
    # Ensure that the user is 13 or over
    if not is_over_13(bday):
        return {"success": False, "msg": "You must be 13 years or older to register!"}
    
    # Ensure that the user provided a gender
    gender = update_data["gender"]
    if gender is None or (type(gender) == str and gender.lower() not in ['m', 'f']):
        return {"success":False, "msg":"Please select a gender for your account so we may determine your event eligibiltiy!"}

    # Update the user information
    modified = await UserHandler.update_user({"uid": uid}, update_data)
    if not modified:
        return {"success": False, "msg": "Error in changing profile details!"}

    # Re-fetch and return the latest profile data for dynamic updating purposes
    updated = await UserHandler.find_by_uid(uid)
    refreshed = PersonalInfo(
        first_name=updated.get("first_name", ""),
        last_name=updated.get("last_name", ""),
        email=updated.get("email", ""),
        birthday=updated.get("birthday"),
        gender=updated.get("gender"),
    )

    return {
        "success": True,
        "msg": "Profile detail update success!",
        "profile_info": refreshed.model_dump()
    }
