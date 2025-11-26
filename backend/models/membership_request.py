from __future__ import annotations

from typing import Optional, List, Literal, Dict, Tuple, Any
from datetime import datetime, timezone

from pydantic import BaseModel, Field
from mongo.database import DB

class MembershipRequestItem(BaseModel):
    message: Optional[str] = None
    resolved: bool
    approved: Optional[bool] = None
    reason: Optional[str] = None
    muted: bool
    created_on: datetime
    responded_to: Optional[datetime] = None

class MembershipRequest(BaseModel):
    uid: str
    message: Optional[str] = None
    resolved: bool = False
    approved: Optional[bool] = None
    reason: Optional[str] = None
    muted: bool = False
    created_on: datetime = Field(default_factory=datetime.now)
    responded_to: Optional[datetime] = None
    history: List[MembershipRequestItem] = Field(default_factory=list)

class MembershipRequestOut(MembershipRequest):
    first_name: str
    last_name: str
    email: str

class MembershipRequestIn(BaseModel):
    message: Optional[str] = None

class MembershipRequestAdminUpdate(BaseModel):
    uid: str
    approved: Optional[bool] = None
    muted: Optional[bool] = None
    reason: Optional[str] = None


class MRSearchParams(BaseModel):
    page: int
    pageSize: int
    searchField: Literal["email", "name", "message"] = "name"
    searchTerm: str = ""
    sortBy: Literal["created_on", "resolved", "approved"] = "created_on"
    sortDir: Literal["asc", "desc"] = "asc"
    status: Literal["pending", "approved", "rejected"] = "pending"

def _sort_keys_for_params(params: MRSearchParams) -> List[Tuple[str, int]]:
    d = 1 if params.sortDir == "asc" else -1
    if params.sortBy == "resolved":
        return [("resolved", d), ("created_on", 1)]
    if params.sortBy == "approved":
        return [("approved", d), ("created_on", 1)]
    return [("created_on", d)]

def _to_out(doc: Dict[str, Any], user_info: Dict[str, Any]) -> MembershipRequestOut:
    return MembershipRequestOut(
        uid=doc["uid"],
        message=doc.get("message"),
        resolved=doc.get("resolved", False),
        approved=doc.get("approved"),
        muted=doc.get("muted", False),
        reason = doc.get("reason"),
        created_on=doc.get("created_on"),
        responded_to=doc.get("responded_to"),
        history=[MembershipRequestItem(**h) for h in doc.get("history", [])],
        first_name=user_info.get("first_name", ""),
        last_name=user_info.get("last_name", ""),
        email=user_info.get("email", ""),
    )


# -----------------------------
# CREATE – entrypoint (New vs Update)
# -----------------------------

async def create_or_update_membership_request(uid: str, payload: MembershipRequestIn) -> Dict[str, Any]:
    coll = DB.db["membership_requests"]
    existing = await coll.find_one({"uid": uid})

    if not existing:
        return await _create_new(uid, payload)

    if existing.get("muted", False):
        return {"success": False, "msg": "User is muted; cannot create new membership requests."}

    return await _create_update(uid, payload)


async def _create_new(uid: str, payload: MembershipRequestIn) -> Dict[str, Any]:
    new_doc = MembershipRequest(
        uid=uid,
        message=(payload.message or "").strip()
    ).model_dump()
    res = await DB.db["membership_requests"].insert_one(new_doc)
    ok = getattr(res, "inserted_id", None) is not None
    return {"success": bool(ok), "msg": "Created new membership request" if ok else "Failed to create membership request"}

async def _create_update(uid: str, payload: MembershipRequestIn) -> Dict[str, Any]:
    coll = DB.db["membership_requests"]
    existing = await coll.find_one({"uid": uid})
    if not existing:
        return await _create_new(uid, payload)

    history_item = MembershipRequestItem(
        message=existing.get("message"),
        resolved=existing.get("resolved", False),
        approved=existing.get("approved"),
        reason=existing.get("reason"),
        muted=existing.get("muted", False),
        created_on=existing.get("created_on", datetime.now(timezone.utc)),
        responded_to=existing.get("responded_to"),
    ).model_dump()

    update = {
        "$push": {"history": history_item},
        "$set": {
            "message": (payload.message or "").strip(),
            "resolved": False,
            "approved": None,
            "reason": None,
            "responded_to": None,
            "created_on": datetime.now(timezone.utc),
        },
        "$setOnInsert": {"uid": uid, "muted": existing.get("muted", False)}
    }

    res = await coll.update_one({"uid": uid}, update, upsert=True)
    ok = (res.matched_count > 0) or (getattr(res, "upserted_id", None) is not None)
    return {"success": bool(ok), "msg": "Updated membership request with new entry" if ok else "Failed to update membership request"}


# -----------------------------
# READ – search (paged) with server-side filters
# -----------------------------

async def search_membership_requests(params: MRSearchParams) -> Dict[str, Any]:
    """
    Server-side search/paging/sort.
    Filters:
      - status: pending/approved/rejected
      - searchField: name/email/message
    """
    coll = DB.db["membership_requests"]
    term = (params.searchTerm or "").strip()

    status_match: Dict[str, Any]
    if params.status == "pending":
        status_match = {"$or": [{"approved": None}, {"resolved": False}]}
    elif params.status == "approved":
        status_match = {"resolved": True, "approved": True}
    else:
        status_match = {"resolved": True, "approved": False}

    match_pre_lookup: Dict[str, Any] = dict(status_match)
    if term and params.searchField == "message":
        match_pre_lookup["message"] = {"$regex": term, "$options": "i"}

    pipeline: List[Dict[str, Any]] = [
        {"$match": match_pre_lookup},
        {"$lookup": {
            "from": "users",
            "localField": "uid",
            "foreignField": "uid",
            "as": "user"
        }},
        {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": True}},
    ]

    if term and params.searchField in ("name", "email"):
        if params.searchField == "email":
            pipeline.append({"$match": {"user.email": {"$regex": term, "$options": "i"}}})
        else:
            pipeline.append({
                "$match": {
                    "$or": [
                        {"user.first_name": {"$regex": term, "$options": "i"}},
                        {"user.last_name": {"$regex": term, "$options": "i"}},
                        {
                            "$expr": {
                                "$regexMatch": {
                                    "input": {"$concat": ["$user.first_name", " ", "$user.last_name"]},
                                    "regex": term,
                                    "options": "i",
                                }
                            }
                        }
                    ]
                }
            })

    sort_keys = _sort_keys_for_params(params)
    if sort_keys:
        pipeline.append({"$sort": {k: v for k, v in sort_keys}})

    pipeline.extend([
        {"$facet": {
            "total": [{"$count": "count"}],
            "items": [
                {"$skip": max(0, params.page) * max(1, params.pageSize)},
                {"$limit": max(1, params.pageSize)},
                {"$project": {
                    "_id": 0,
                    "uid": 1,
                    "message": 1,
                    "resolved": 1,
                    "approved": 1,
                    "reason":1,
                    "muted": 1,
                    "created_on": 1,
                    "responded_to": 1,
                    "history": 1,
                    "first_name": "$user.first_name",
                    "last_name": "$user.last_name",
                    "email": "$user.email",
                }}
            ]
        }},
        {"$project": {
            "items": 1,
            "total": {"$ifNull": [{"$arrayElemAt": ["$total.count", 0]}, 0]}
        }}
    ])

    agg = coll.aggregate(pipeline)
    result = [doc async for doc in agg]
    bucket = result[0] if result else {"items": [], "total": 0}

    items: List[MembershipRequestOut] = [MembershipRequestOut(**i) for i in bucket.get("items", [])]

    return {
        "success": True,
        "items": [i.model_dump() for i in items],
        "total": int(bucket.get("total", 0)),
        "page": params.page,
        "pageSize": params.pageSize,
    }


# -----------------------------
# READ – by UID
# -----------------------------

async def get_membership_request_by_uid(uid):
    docs = await DB.find_documents("membership_requests", {"uid": uid}, 1)
    if len(docs) == 0:
        return False
    return docs[0]


# -----------------------------
# UPDATE – admin POV
# -----------------------------

async def update_membership_request_admin(update: MembershipRequestAdminUpdate) -> Dict[str, Any]:
    coll = DB.db["membership_requests"]
    uid = update.uid
    doc = await coll.find_one({"uid": uid})
    if not doc:
        return {"success": False, "msg": "Membership request not found"}

    updates: Dict[str, Any] = {
        "resolved": True,
        "responded_to": datetime.now(timezone.utc),
    }
    if update.approved is not None:
        updates["approved"] = update.approved
    if update.muted is not None:
        updates["muted"] = update.muted
    if update.reason is not None:
        updates["reason"] = update.reason

    res = await coll.update_one({"uid": uid}, {"$set": updates})
    if res.matched_count == 0:
        return {"success": False, "msg": "Failed to update membership request"}
    return {"success": True, "msg": "Membership request updated"}


# -----------------------------
# UPDATE – explicit update call
# -----------------------------
async def explicit_update_membership_request(filterQuery, updateData):
    return await DB.update_document("membership_requests", filterQuery, updateData)


# -----------------------------
# DELETE – by UID
# -----------------------------

async def delete_membership_request(uid: str) -> Dict[str, Any]:
    res = await DB.db["membership_requests"].delete_one({"uid": uid})
    if res.deleted_count == 0:
        return {"success": False, "msg": "Membership request not found"}
    return {"success": True, "msg": "Membership request deleted"}
