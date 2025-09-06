from typing import Optional
from fastapi import HTTPException, status
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler
from bson import ObjectId
import re

#
# Some ID sanity checks so i can somewhat sleep at night know there is bare minimum validation
#

def validate_route_ids(user_id: str, family_member_id: Optional[str] = None, uid: Optional[str] = None):
    validate_mongodb_object_id(user_id, "User ID")
    if family_member_id:
        validate_family_member_id(family_member_id)
    if uid:
        validate_firebase_uid(uid)
        
def validate_mongodb_object_id(object_id: str, field_name: str = "Object ID") -> bool:
    if not object_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} cannot be empty")
    try:
        ObjectId(object_id)
        return True
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field_name} format")

def validate_firebase_uid(uid: str) -> bool:
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User authentication required")
    if len(uid) < 10 or len(uid) > 128:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")
    if not re.match(r'^[a-zA-Z0-9._-]+$', uid):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token format")
    return True

def validate_family_member_id(family_member_id: str) -> bool:
    if not family_member_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Family member ID cannot be empty")
    if len(family_member_id) > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Family member ID too long (max 100 chars)")
    if not re.match(r'^[a-zA-Z0-9._-]+$', family_member_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Family member ID contains invalid characters")
    return True

def sanitize_string_input(input_str: str, max_length: int = 255, field_name: str = "input") -> str:
    if input_str is None:
        return ""
    sanitized = input_str.strip()
    if len(sanitized) > max_length:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} exceeds max length")
    if field_name.lower() in ['first_name', 'last_name', 'name']:
        if not re.match(r"^[a-zA-Z\s\-'.]+$", sanitized):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} contains invalid characters")
    return sanitized

#
# Basic helpers for other specific route parameter validation
#

def validate_gender(gender: str) -> bool:
    allowed_genders = ["male", "female", "other"]
    if gender.lower() not in allowed_genders:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid gender value")
    return True

def validate_family_member_data(family_member_data: dict) -> dict:
    if not family_member_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Family member data required")
    
    validated_data = {}
    if "family_member_id" in family_member_data:
        validate_family_member_id(family_member_data["family_member_id"])
        validated_data["family_member_id"] = family_member_data["family_member_id"]
    
    if "first_name" in family_member_data:
        validated_data["first_name"] = sanitize_string_input(
            family_member_data["first_name"], 50, "first_name")
    
    if "last_name" in family_member_data:
        validated_data["last_name"] = sanitize_string_input(
            family_member_data["last_name"], 50, "last_name")
    
    if "gender" in family_member_data:
        validate_gender(family_member_data["gender"])
        validated_data["gender"] = family_member_data["gender"].lower()
    
    if "date_of_birth" in family_member_data:
        validated_data["date_of_birth"] = family_member_data["date_of_birth"]
    
    return validated_data
