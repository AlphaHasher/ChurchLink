
from __future__ import annotations

import logging
from typing import Dict, Optional, List

from bson import ObjectId
from pymongo import ASCENDING, ReturnDocument

from pydantic import BaseModel

from mongo.database import DB


# This is a class that can be sent as http body for admins to create or update discount codes.
class DiscountCodeUpdate(BaseModel):
    name: str
    # Description represents the description so an admin can view the code and understand what its purpose is
    description: Optional[str]
    # This is the actual code itself, that the user would type. E.G. 20FORTACOS
    code: str
    # Defines if bool is percentage off or not. If true, the numerical value will represent a percentage, else, a raw value of a discount
    is_percent: bool
    # Discount amount. E.g., "2.5" represents 2.5% off if is_percent and $2.50 off if is_percent is false
    discount: float
    # Max uses. This is the maximum amount of uses (with 1 use being 1 person rather than 1 sign up)
    # Can be set to None for unlimited uses
    max_uses: Optional[int]
    # This is a boolean that determines if a discount code is active. Can always be flipped on or off from the admin panel.
    active: bool

# This is the class that actually denotates the DiscountCode that gets stored in the DB and will be sent to admins when
class DiscountCode(DiscountCodeUpdate):
    # ID of the code
    id: str
    # Usage history of a DiscountCode works so that way whenever a user uses one for the first time:
    # Into this dictionary, the key of their UID gets initialized to the value of the number of people they are signing up with it.
    # Any continued use will increase the value.
    # This is what allows us to ensure max_uses is never exceeded.
    usage_history: Dict[str, int]


async def do_discount_code_validation(code: DiscountCodeUpdate):

    # Normalize the code by ensuring that it has no leading or trailing spaces and store it as uppercase
    normalized_code= code.code.strip().upper()
    code.code = normalized_code

    # Ensure that code length is between 3 and 10 inclusive
    if len(code.code) < 3:
        return {'success':False, 'msg':'The Discount Code must be at least 3 characters long!'}
    if len(code.code) > 10:
        return {'success':False, 'msg':'The Discount Code must be at most 10 characters long!'}
    
    # Ensure that the discount code actually has a valid discount
    if code.discount <= 0:
        return {'success':False, 'msg':'This Discount Code has a value equal to or less than zero! Please include a discount that is greater than zero.'}
    
    # Special validation to ensure that a percentage based code does not have a percentage discount above 100
    if code.is_percent:
        if code.discount > 100:
            return {'success':False, 'msg':'This Discount Code has a discount of more than 100 percent off! A percentage discount can have a value of at most 100'}
    
    # Ensure a valid max uses
    if code.max_uses is not None and code.max_uses <= 0:
        return {'success':False, 'msg':'The Maximum uses of a Discount Code must be at least 1! If you don\'t want a maximum number of uses, simply leave Max Uses blank.'}

    # Return success and also return validated code that has modified the actual discount code.
    return {'success':True, 'msg':'Discount Code validated!', 'validated_code': code}

# ----------------------------
# Indexes
# ----------------------------

# TODO: MOVE THIS TO MONGO.DB, THIS IS A REFERENCE FOR NOW
async def ensure_discount_code_indexes() -> None:
    """
    Call once at startup. Ensures uniqueness on the normalized 'code' field.
    Your validator already strips/uppercases 'code', so a unique index on 'code' is sufficient.
    """
    await DB.db["discount_codes"].create_index(
        [("code", ASCENDING)],
        unique=True,
        name="uniq_code"
    )


# ----------------------------
# CRUD Operations
# ----------------------------

async def create_discount_code(payload: DiscountCodeUpdate) -> Dict[str, object]:
    """
    Create: validate, enforce uniqueness, and insert a new discount code.
    Initializes usage_history server-side.
    Returns: {success: bool, msg: str, code: DiscountCode (on success)}
    """
    try:
        # 1) Validate + normalize (uppercases/strips .code in-place)
        validation = await do_discount_code_validation(payload)
        if not validation.get("success"):
            return {"success": False, "msg": validation.get("msg", "Validation failed")}
        validated: DiscountCodeUpdate = validation["validated_code"]

        # 2) Uniqueness on normalized code
        existing = await DB.db["discount_codes"].find_one({"code": validated.code})
        if existing:
            return {"success": False, "msg": "A discount code with this code already exists."}

        # 3) Build document (server-owned usage_history)
        doc = validated.model_dump()
        doc["usage_history"] = {}

        # 4) Insert + read-back
        res = await DB.db["discount_codes"].insert_one(doc)
        created = await DB.db["discount_codes"].find_one({"_id": res.inserted_id})
        if not created:
            return {"success": False, "msg": "Failed to read back created discount code."}

        created["id"] = str(created.pop("_id"))
        return {"success": True, "msg": "Discount code created!", "code": DiscountCode(**created)}
    except Exception as e:
        logging.exception("Error creating discount code")
        return {"success": False, "msg": f"Error creating discount code: {e}"}


async def update_discount_code(code_id: str, payload: DiscountCodeUpdate) -> Dict[str, object]:
    """
    Update: validate and update an existing discount code by ID.
    - Preserves existing usage_history.
    - Enforces uniqueness for the (normalized) code, excluding this document.
    Returns: {success: bool, msg: str, code: DiscountCode (on success)}
    """
    try:
        # 0) Fetch current doc (to preserve usage_history)
        existing = await DB.db["discount_codes"].find_one({"_id": ObjectId(code_id)})
        if not existing:
            return {"success": False, "msg": "Discount code not found."}

        # 1) Validate + normalize
        validation = await do_discount_code_validation(payload)
        if not validation.get("success"):
            return {"success": False, "msg": validation.get("msg", "Validation failed")}
        validated: DiscountCodeUpdate = validation["validated_code"]

        # 2) Uniqueness on normalized code (exclude current)
        dup = await DB.db["discount_codes"].find_one(
            {"code": validated.code, "_id": {"$ne": existing["_id"]}}
        )
        if dup:
            return {"success": False, "msg": "Another discount code already uses this code."}

        # 3) Build $set, do NOT accept usage_history from client
        to_set = validated.model_dump()

        # 4) Update
        doc = await DB.db["discount_codes"].find_one_and_update(
            {"_id": existing["_id"]},
            {"$set": to_set},
            return_document=ReturnDocument.AFTER,
        )
        if not doc:
            return {"success": False, "msg": "Failed to update discount code."}

        doc["id"] = str(doc.pop("_id"))
        # Backfill usage_history for any older docs that might not have it
        doc.setdefault("usage_history", existing.get("usage_history", {}))
        return {"success": True, "msg": "Discount code updated!", "code": DiscountCode(**doc)}
    except Exception as e:
        logging.exception(f"Error updating discount code {code_id}")
        return {"success": False, "msg": f"Error updating discount code: {e}"}
    
async def delete_discount_code(code_id: str) -> Dict[str, object]:
    """
    Delete a discount code by _id.
    Returns: {success: bool, msg: str}
    """
    try:
        oid = ObjectId(code_id)
    except Exception:
        return {"success": False, "msg": "Invalid discount code id."}

    res = await DB.db["discount_codes"].delete_one({"_id": oid})
    if res.deleted_count == 0:
        return {"success": False, "msg": "Discount code not found or already deleted."}
    return {"success": True, "msg": "Discount code deleted."}


async def get_discount_code_by_id(code_id: str) -> Optional[DiscountCode]:
    """
    Get a single discount code by ID. Returns None if not found.
    """
    try:
        doc = await DB.db["discount_codes"].find_one({"_id": ObjectId(code_id)})
        if not doc:
            return None
        doc["id"] = str(doc.pop("_id"))
        doc.setdefault("usage_history", {})
        return DiscountCode(**doc)
    except Exception:
        logging.exception(f"Error fetching discount code id={code_id}")
        return None
    
async def get_discount_code_by_code(raw_code: str) -> Optional[DiscountCode]:
    """
    Look up a discount code document by its human-entered code string.
    Normalizes to the stored format (strip + upper) before querying.
    Returns a DiscountCode or None if not found.
    """
    try:
        # normalize the same way validation/uniqueness do
        norm = (raw_code or "").strip().upper()
        if not norm:
            return None

        doc = await DB.db["discount_codes"].find_one({"code": norm})
        if not doc:
            return None

        doc["id"] = str(doc.pop("_id"))
        doc.setdefault("usage_history", {})
        return DiscountCode(**doc)
    except Exception:
        logging.exception("Error fetching discount code by code=%r", raw_code)
        return None
    
async def get_discount_code_by_id(code_id: str) -> Optional[DiscountCode]:
    """
    Get a single discount code by ID. Returns None if not found.
    """
    try:
        doc = await DB.db["discount_codes"].find_one({"_id": ObjectId(code_id)})
        if not doc:
            return None
        doc["id"] = str(doc.pop("_id"))
        doc.setdefault("usage_history", {})
        return DiscountCode(**doc)
    except Exception:
        logging.exception(f"Error fetching discount code id={code_id}")
        return None


async def get_all_discount_codes() -> List[DiscountCode]:
    """
    Get all discount codes. If the list may grow large, add pagination later.
    """
    try:
        cur = DB.db["discount_codes"].find({})
        rows = await cur.to_list(length=None)
        out: List[DiscountCode] = []
        for r in rows:
            r["id"] = str(r.pop("_id"))
            r.setdefault("usage_history", {})
            out.append(DiscountCode(**r))
        return out
    except Exception:
        logging.exception("Error fetching all discount codes")
        return []
    
async def increment_discount_usage(code_id: str, uid: str, inc: int) -> bool:
    """
    Atomically bump usage_history for a user on a discount code.
    Returns True if the code exists and was updated, False otherwise.
    """
    if inc <= 0:
        return True
    try:
        res = await DB.db["discount_codes"].update_one(
            {"_id": ObjectId(code_id)},
            {"$inc": {f"usage_history.{uid}": inc}}
        )
        return res.matched_count == 1
    except Exception:
        logging.exception("Error incrementing discount usage for code_id=%s uid=%s", code_id, uid)
        return False