from mongo.firebase_sync import FirebaseSyncer
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler
from pydantic import BaseModel
from fastapi import Request
from typing import Optional, List, Dict, Literal
from datetime import datetime
import re
from datetime import datetime, timezone
from bson import ObjectId
from firebase_admin import auth
import traceback
from models.user import get_family_member_by_id, AddressSchema
from models.membership_request import get_membership_request_by_uid, explicit_update_membership_request

NAME_RE = re.compile(r"^[A-Za-z][A-Za-z .'\-]{0,49}$")
PHONE_RE = re.compile(r"^\+?[0-9\s().-]{7,}$")


class MyPermsRequest(BaseModel):
    user_assignable_roles: bool
    event_editor_roles: bool
    user_role_ids: bool

class PersonalInfo(BaseModel):
    first_name: str
    last_name: str
    email: str
    membership: bool
    birthday: Optional[datetime]
    gender: Optional[str]

class ContactInfo(BaseModel):
    phone: Optional[str]
    address: AddressSchema

class DetailedUserInfo(BaseModel):
    uid: str
    verified: bool
    personal_info: PersonalInfo
    contact_info: ContactInfo

class UsersSearchParams(BaseModel):
    page: int
    pageSize: int
    searchField: Literal["email", "name"] = "email"
    searchTerm: str = ""
    sortBy: Literal["email", "name", "createdOn", "uid"] = "createdOn"
    sortDir: Literal["asc", "desc"] = "asc"
    hasRolesOnly: bool = False

AUTOMATIC_REQUEST_REASON = "REQUEST AUTOMATICALLY HANDLED. Reason: Somebody specifically changed the user member status from user detailed view while request was active, therefore it was handled as resolving the request."



def is_valid_name(s: str) -> bool:
    if not s:
        return False
    return bool(NAME_RE.match(s))

def is_over_13(bday: datetime) -> bool:
    today = datetime.now(timezone.utc).date()
    d = bday.date()
    age = today.year - d.year - ((today.month, today.day) < (d.month, d.day))
    return age >= 13

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

async def fetch_users_with_role_id(role_id: str):
    try:
        users = await UserHandler.fetch_focused_user_content_with_role_id(role_id)
        return {"success": True, "users": users}
    except ValueError:
        return {"success": False, "msg": "Invalid role_id"}
    except Exception as e:
        return {"success": False, "msg": f"Error fetching users by role: {str(e)}"}


async def search_users_paged(params: UsersSearchParams):
    total, users = await UserHandler.search_users_paged(params)
    # Normalize down to the fields the UI already uses in /get-users
    items = [
        {
            "uid": u.get("uid"),
            "first_name": u.get("first_name"),
            "last_name": u.get("last_name"),
            "email": u.get("email"),
            "membership": u.get("membership"),
            "roles": u.get("roles", []),
        }
        for u in users
    ]
    return {
        "success": True,
        "items": items,
        "total": total,
        "page": params.page,
        "pageSize": params.pageSize,
    }

async def search_logical_users_paged(params: UsersSearchParams):
    # Force hasRolesOnly True at controller level for safety
    params.hasRolesOnly = True
    return await search_users_paged(params)
    
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

async def get_is_init(request: Request):
    user = request.state.user
    birthday = user.get("birthday")
    gender = user.get("gender")
    verified = user.get("verified")
    init = False
    if birthday is None or gender is None:
        msg = "This user has not initialized their profile!"
    else:
        init = True
        msg = "This user has initialized their profile!"
    if not verified:
        msg = " However, they have not verified their email!"
    return {"init": init, "verified":verified, "msg":msg}
    

async def fetch_profile_info(request: Request):
    user = request.state.user

    profile_info = PersonalInfo(
        first_name=user.get("first_name", ""),
        last_name=user.get("last_name", ""),
        email=user.get("email", ""),
        membership = user.get("membership", ""),
        birthday=user.get("birthday"),
        gender=user.get("gender")
    )

    contact_info = ContactInfo(
        phone = user.get("phone", ""),
        address = user.get("address")
    )

    return {
        "success": True,
        "profile_info": profile_info.model_dump(),
        "contact_info": contact_info.model_dump()
    }

async def fetch_detailed_user(uid: str):
    user = await UserHandler.find_by_uid(uid)

    if not user:
        return {"success":False, "msg":"Could not find user!"}

    try:
        profile_info_load = PersonalInfo(
            first_name=user.get("first_name", ""),
            last_name=user.get("last_name", ""),
            email=user.get("email", ""),
            membership = user.get("membership", ""),
            birthday=user.get("birthday"),
            gender=user.get("gender"),
        )

        contact_info_load = ContactInfo(
            phone = user.get("phone", ""),
            address = user.get("address")
        )

        detailed_info = DetailedUserInfo(
            uid=uid,
            verified = user.get("verified"),
            personal_info=profile_info_load,
            contact_info=contact_info_load,
        )
    except Exception as e:
        print(e)
        return {"success":False, "msg":"Could not form detailed info!"}
    
    return {"success":True, "msg":"Detailed info returned!", "info":detailed_info.model_dump()}

async def change_user_member_status(uid:str, set:bool, fromUserPatch:bool = False):
    old_user = await UserHandler.find_by_uid(uid)

    if not old_user:
        return {"success":False, "msg": "Could not find user!"}
    
    if old_user.get("membership") == set:
        return {"success":True, "msg": "Trivial success. Requested membership status is the same as current."}
    
    update_data = {
        "membership":set
    }

    # Update the user information
    modified = await UserHandler.update_user({"uid": uid}, update_data)
    if not modified:
        return {"success": False, "msg": "Error in changing membership status!"}
    
    # Only if we are coming from the case where we aren't explicitly responding to a request approval/deny, check to see if any requests exist
    if fromUserPatch:
        print("user patch!")

        # Try to find request
        request = await get_membership_request_by_uid(uid)
        # If request exists
        if request:
            # If request hasn't already been responded to, we need to update
            if request.get("resolved") == False:

                # Assemble update information
                update_request = {
                    "resolved":True,
                    "approved":set,
                    "reason": AUTOMATIC_REQUEST_REASON,
                }

                modified = await explicit_update_membership_request({"uid":uid}, update_request)

    
    return {"success":True, "msg":"Successfully updated membership status!"}

    

async def execute_patch_detailed_user(uid:str, details: DetailedUserInfo):

    # First try membership patch
    membership_try = await change_user_member_status(uid, details.personal_info.membership, True)

    if not membership_try['success']:
        return {"success":False, "msg": "Could not make any updates!: " + membership_try['msg']}
    
    # Then try profile patch
    profile_try = await update_profile(uid, details.personal_info)

    if not profile_try['success']:
        return {"success":False, "msg": "Successfully changed membership status! But failed on profile/contact update! Profile failure: " + profile_try['msg']}
    
    # Finally try contact info patch
    contact_try = await update_contact(uid, details.contact_info)
    if not contact_try['success']:
        return {"success":False, "msg":"Successfully changed membership status and profile! But failed on contact update! Contact failure: " + contact_try['msg']}
    
    # Return success
    return {"success":True, "msg":"Updates are successful to the user!"}



async def update_contact(uid:str, contact_info: ContactInfo):

    # Get an old user for comparison
    old_user = await UserHandler.find_by_uid(uid)
    
    if not old_user:
        return {"success":False, "msg":"Could not find original user!"}

    # Ensure phone number is a reasonable input
    safe_phone = contact_info.phone
    if not safe_phone:
        safe_phone = ""
    safe_phone = safe_phone.strip().replace(" ", "")

    if safe_phone != "" and not PHONE_RE.fullmatch(safe_phone):
        msg = 'Please enter a valid phone number!'
        return {"success":False, "msg":msg}
    
    # Account for safety of not saving without alteration
    if safe_phone == old_user.get("phone") and contact_info.address.model_dump() == old_user.get("address"):
        return {
            "success": True,
            "msg": "Profile detail update success!",
            "contact_info": contact_info.model_dump()
        }


    # Get update data
    update_data = {
        "phone": safe_phone,
        "address": contact_info.address.model_dump(),
    }

    # Update the user information
    modified = await UserHandler.update_user({"uid": uid}, update_data)
    if not modified:
        return {"success": False, "msg": "Error in changing contact info!"}
    
    # Re-fetch and return the latest contact data data for dynamic updating purposes
    updated = await UserHandler.find_by_uid(uid)
    if not updated or updated == False:
        return {"success": False, "msg": "Error retrieving updated contact info!"}
    
    refreshed = ContactInfo(
        phone = updated.get("phone", ""),
        address = updated.get("address")
    )

    return {
        "success":True,
        "msg":"Contact info update success!",
        "contact_info":refreshed.model_dump()
    }
    


async def update_profile(uid:str, profile_info: PersonalInfo):

    # Get an old user for comparison
    old_user = await UserHandler.find_by_uid(uid)
    
    if not old_user:
        return {"success":False, "msg":"Could not find original user!"}


    # Excluding Email because we never want to change email from the profile changing section, so we may as well prune it here.
    # Same situation with "Membership". This will be modified via a different subroutine
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
    if gender is None or (isinstance(gender, str) and gender.lower() not in ['m', 'f']):
        return {"success":False, "msg":"Please select a gender for your account so we may determine your event eligibility!"}
    
    comp_birthday = old_user.get("birthday")
    if comp_birthday and comp_birthday.tzinfo is None:
        comp_birthday = comp_birthday.replace(tzinfo = timezone.utc)

    # Trivial Case (No Changes Made, just to not return an error)
    if update_data['first_name'] == old_user.get("first_name") and update_data['last_name'] == old_user.get("last_name") and update_data['birthday'] == comp_birthday and update_data['gender'] == old_user.get("gender"):
        return {
            "success": True,
            "msg": "Profile detail update success!",
            "profile_info": update_data
        }

    # Update the user information
    modified = await UserHandler.update_user({"uid": uid}, update_data)
    if not modified:
        return {"success": False, "msg": "Error in changing profile details!"}

    # Re-fetch and return the latest profile data for dynamic updating purposes
    updated = await UserHandler.find_by_uid(uid)
    if not updated or updated == False:
        return {"success": False, "msg": "Error retrieving updated profile details!"}
    
    refreshed = PersonalInfo(
        first_name=updated.get("first_name", ""),
        last_name=updated.get("last_name", ""),
        email=updated.get("email", ""),
        membership = updated.get("membership", ""),
        birthday=updated.get("birthday"),
        gender=updated.get("gender"),
    )

    return {
        "success": True,
        "msg": "Profile detail update success!",
        "profile_info": refreshed.model_dump()
    }


# User Resolution Functions (moved from UserResolutionHelper)

async def resolve_user_name(uid: str) -> str:
    """
    Resolve a Firebase UID to user's display name.
    Returns a fallback name if user is not found.
    """
    try:
        user = auth.get_user(uid)
        if user.display_name:
            return user.display_name
        elif user.email:
            # Fallback to email if displayName not available
            return user.email.split('@')[0].title()
        else:
            return f"User {uid[:8]}..."
    except Exception:
        return f"User {uid[:8]}..."


async def resolve_family_member_name(uid: str, person_id: ObjectId) -> Optional[str]:
    """
    Resolve a family member's name by their person_id and parent user uid.
    Returns None if family member is not found.
    """
    try:
        print(f"[FAMILY_MEMBER_DEBUG] Resolving family member - UID: {uid}, Person ID: {person_id}")
        
        # Get family member data
        member = await get_family_member_by_id(uid, str(person_id))
        print(f"[FAMILY_MEMBER_DEBUG] get_family_member_by_id returned: {member}")
        
        if member:
            # PersonOut has first_name and last_name attributes
            full_name = f"{member.first_name} {member.last_name}".strip()
            print(f"[FAMILY_MEMBER_DEBUG] Resolved name: '{full_name}'")
            return full_name
        else:
            print(f"[FAMILY_MEMBER_DEBUG] No family member found for person_id: {person_id}")
            return None
    except Exception as e:
        print(f"[FAMILY_MEMBER_DEBUG] Exception resolving family member: {e}")
        print(f"[FAMILY_MEMBER_DEBUG] Traceback: {traceback.format_exc()}")
        return None


async def create_display_name(user_uid: str, person_id: Optional[ObjectId], user_name: str, person_name: Optional[str]) -> str:
    """
    Create a display name for registration entry.
    """
    print(f"[DISPLAY_NAME_DEBUG] Creating display name - user_uid: {user_uid}, person_id: {person_id}, user_name: '{user_name}', person_name: '{person_name}'")
    
    if person_id is None:
        # This is the user themselves
        print(f"[DISPLAY_NAME_DEBUG] Using user name: '{user_name}'")
        return user_name
    elif person_name:
        # This is a family member with a known name
        print(f"[DISPLAY_NAME_DEBUG] Using family member name: '{person_name}'")
        return person_name
    else:
        # Family member exists but name couldn't be resolved
        print(f"[DISPLAY_NAME_DEBUG] Falling back to 'Family Member' for person_id: {person_id}")
        return "Family Member"


async def resolve_registration_display_names(attendees: List[Dict]) -> List[Dict]:
    """
    Resolve display names for a list of event attendees.
    Returns enhanced attendee list with resolved names and display information.
    """
    enhanced_attendees = []
    
    # Batch resolve user names to avoid N+1 queries
    user_uids = list(set(attendee.get('user_uid') for attendee in attendees if attendee.get('user_uid')))
    user_name_cache = {}
    
    for uid in user_uids:
        if uid:  # Only process valid UIDs
            user_name_cache[uid] = await resolve_user_name(uid)
    
    for attendee in attendees:
        user_uid = attendee.get('user_uid')
        person_id = attendee.get('person_id')
        
        if not user_uid:
            continue
        
        user_name = user_name_cache.get(user_uid, f"User {user_uid[:8]}...")
        person_name = None
        
        # Resolve family member name if this is a family member registration
        if person_id:
            person_name = await resolve_family_member_name(user_uid, person_id)
        
        # Create display name
        display_name = await create_display_name(user_uid, person_id, user_name, person_name)
        
        # Create enhanced attendee entry
        enhanced_attendee = {
            "user_uid": user_uid,
            "user_name": user_name,
            "person_id": str(person_id) if person_id else None,
            "person_name": person_name,
            "display_name": display_name,
            "registered_on": attendee.get('addedOn', datetime.now()),
            "kind": attendee.get('kind', 'rsvp')
        }
        
        enhanced_attendees.append(enhanced_attendee)
    
    return enhanced_attendees