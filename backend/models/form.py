from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from bson import ObjectId

from mongo.database import DB
from models.base.ssbc_base_model import MongoBaseModel

logger = logging.getLogger(__name__)


DEFAULT_FORM_WIDTH = "100"
FORM_WIDTH_ALLOWED = {"100", "85", "70", "55", "40", "25", "15"}
FORM_WIDTH_ALLOWED_LIST = sorted(FORM_WIDTH_ALLOWED, key=int, reverse=False)
FORM_WIDTH_ALLOWED_MESSAGE = ", ".join(FORM_WIDTH_ALLOWED_LIST)

def _validate_slug(v: Optional[str], allow_none: bool = True) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if s == "":
        return None
    # only allow lowercase letters, numbers and dashes
    if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", s):
        raise ValueError("Invalid slug format: only lowercase letters, numbers and dashes allowed")
    if len(s) > 200:
        raise ValueError("Slug too long")
    return s


def _validate_data_is_list(v: Any, allow_none: bool = True) -> Any:
    if v is None:
        return [] if not allow_none else None
    if not isinstance(v, list):
        raise ValueError("Form data must be an array of field definitions")
    return v


def _normalize_form_width_value(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    raw = str(v).strip()
    if raw == "":
        return None
    if raw in FORM_WIDTH_ALLOWED:
        return raw
    raise ValueError(f"Invalid form width value. Allowed values: {FORM_WIDTH_ALLOWED_MESSAGE}")


def _validate_form_width(v: Optional[str]) -> Optional[str]:
    normalized = _normalize_form_width_value(v)
    if normalized is None:
        return None
    if normalized not in FORM_WIDTH_ALLOWED:
        raise ValueError(f"Invalid form width value. Allowed values: {FORM_WIDTH_ALLOWED_MESSAGE}")
    return normalized

class FormBase(BaseModel):
    title: str = Field(...)
    folder: Optional[str] = Field(None)
    description: Optional[str] = Field(None)
    visible: bool = Field(True)
    slug: Optional[str] = Field(None)
    expires_at: Optional[datetime] = Field(None)
    form_width: Optional[str] = Field(None)
    
    # Payment configuration fields
    requires_payment: bool = Field(False)
    payment_amount: Optional[float] = Field(None)
    payment_type: Optional[str] = Field("fixed")  # "fixed" | "donation" | "variable"
    payment_description: Optional[str] = Field(None)
    min_payment_amount: Optional[float] = Field(None)
    max_payment_amount: Optional[float] = Field(None)

    @field_validator("form_width", mode="before")
    def validate_form_width(cls, v):
        return _validate_form_width(v)


class FormCreate(FormBase):
    data: Any = Field(default_factory=list)

    @field_validator("data", mode="before")
    def validate_data_is_list(cls, v):
        return _validate_data_is_list(v, allow_none=False)

    @field_validator("slug", mode="before")
    def validate_slug(cls, v):
        return _validate_slug(v)


class FormUpdate(BaseModel):
    title: Optional[str] = None
    folder: Optional[str] = None
    description: Optional[str] = None
    visible: Optional[bool] = None
    slug: Optional[str] = None
    expires_at: Optional[datetime] = None
    data: Optional[Any] = None
    form_width: Optional[str] = None
    
    # Payment configuration fields
    requires_payment: Optional[bool] = None
    payment_amount: Optional[float] = None
    payment_type: Optional[str] = None
    payment_description: Optional[str] = None
    min_payment_amount: Optional[float] = None
    max_payment_amount: Optional[float] = None

    @field_validator("slug", mode="before")
    def validate_slug_update(cls, v):
        return _validate_slug(v)

    @field_validator("data", mode="before")
    def validate_update_data_is_list(cls, v):
        return _validate_data_is_list(v, allow_none=True)

    @field_validator("form_width", mode="before")
    def validate_form_width_update(cls, v):
        return _validate_form_width(v)


class Form(MongoBaseModel, FormBase):
    user_id: str
    data: Any = Field(default_factory=list)
    slug: Optional[str]
    form_width: Optional[str]
    
    # Payment configuration fields
    requires_payment: bool = Field(False)
    payment_amount: Optional[float] = Field(None)
    payment_type: Optional[str] = Field("fixed")
    payment_description: Optional[str] = Field(None)
    min_payment_amount: Optional[float] = Field(None)
    max_payment_amount: Optional[float] = Field(None)
    expires_at: Optional[datetime]


class FormOut(BaseModel):
    id: str
    title: str
    folder: Optional[str]
    folder_name: Optional[str] = None
    description: Optional[str]
    user_id: str
    visible: bool
    slug: Optional[str]
    data: Any
    expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    form_width: Optional[str]
    
    # Payment configuration fields
    requires_payment: bool = Field(False)
    payment_amount: Optional[float] = Field(None)
    payment_type: Optional[str] = Field("fixed")
    payment_description: Optional[str] = Field(None)
    min_payment_amount: Optional[float] = Field(None)
    max_payment_amount: Optional[float] = Field(None)


def _doc_to_out(doc: dict) -> FormOut:
    try:
        normalized_width = _normalize_form_width_value(doc.get("form_width"))
    except ValueError:
        normalized_width = None
    folder_value = doc.get("folder")
    if isinstance(folder_value, ObjectId):
        folder_value = str(folder_value)
    return FormOut(
        id=str(doc.get("_id")),
        title=doc.get("title"),
        folder=folder_value,
        folder_name=doc.get("folder_name"),
        description=doc.get("description"),
        slug=doc.get("slug"),
        user_id=doc.get("user_id"),
        visible=doc.get("visible", True),
        expires_at=doc.get("expires_at"),
        data=doc.get("data", []),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
        form_width=normalized_width or DEFAULT_FORM_WIDTH,
        requires_payment=doc.get("requires_payment", False),
        payment_amount=doc.get("payment_amount"),
        payment_type=doc.get("payment_type", "fixed"),
        payment_description=doc.get("payment_description"),
        min_payment_amount=doc.get("min_payment_amount"),
        max_payment_amount=doc.get("max_payment_amount"),
    )


def _normalize_folder_value(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    if isinstance(raw, ObjectId):
        return str(raw)
    if isinstance(raw, str):
        cleaned = raw.strip()
        return cleaned or None
    return str(raw)


async def _attach_folder_metadata(documents: List[dict]) -> List[dict]:
    if not documents:
        return documents

    folder_ids: set[str] = set()
    for doc in documents:
        folder_value = _normalize_folder_value(doc.get("folder"))
        doc["folder"] = folder_value
        if folder_value:
            folder_ids.add(folder_value)

    object_ids: List[ObjectId] = []
    for fid in folder_ids:
        try:
            object_ids.append(ObjectId(fid))
        except Exception:
            continue

    folder_name_map: Dict[str, Optional[str]] = {}
    if object_ids:
        cursor = DB.db.form_folders.find({"_id": {"$in": object_ids}})
        folder_docs = await cursor.to_list(length=None)
        for folder_doc in folder_docs:
            folder_name_map[str(folder_doc.get("_id"))] = folder_doc.get("name")

    for doc in documents:
        folder_value = doc.get("folder")
        if folder_value:
            folder_name = folder_name_map.get(folder_value) or folder_value
        else:
            folder_name = None
        doc["folder_name"] = folder_name

    return documents


############################
# CRUD operations
############################


async def create_form(form: FormCreate, user_id: str) -> Optional[FormOut]:
    try:
        width = _normalize_form_width_value(getattr(form, "form_width", None)) or DEFAULT_FORM_WIDTH
        # Normalize expires_at: if provided and tz-aware, convert to local naive datetime
        expires_val = getattr(form, 'expires_at', None)
        if isinstance(expires_val, datetime) and expires_val.tzinfo is not None:
            try:
                expires_val = expires_val.astimezone().replace(tzinfo=None)
            except Exception:
                # fallback to the original value
                expires_val = getattr(form, 'expires_at', None)

        doc = {
            "title": (form.title or "").strip() or "Untitled Form",
            "folder": form.folder,
            "description": form.description,
            "slug": form.slug,
            "user_id": user_id,
            "visible": form.visible if hasattr(form, "visible") else True,
            "data": (form.data),
            "expires_at": expires_val,
            "form_width": width,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            # Payment configuration fields
            "requires_payment": getattr(form, "requires_payment", False),
            "payment_amount": getattr(form, "payment_amount", None),
            "payment_type": getattr(form, "payment_type", "fixed"),
            "payment_description": getattr(form, "payment_description", None),
            "min_payment_amount": getattr(form, "min_payment_amount", None),
            "max_payment_amount": getattr(form, "max_payment_amount", None),
        }
        result = await DB.db.forms.insert_one(doc)
        if result.inserted_id:
            created = await DB.db.forms.find_one({"_id": result.inserted_id})
            if created:
                return _doc_to_out(created)
        return None
    except Exception as e:
        logger.error(f"Error creating form: {e}")
        return None


async def list_forms(user_id: str, skip: int = 0, limit: int = 100) -> List[FormOut]:
    try:
        cursor = DB.db.forms.find({"user_id": user_id}).skip(skip).limit(limit).sort([("created_at", -1)])
        docs = await cursor.to_list(length=limit)
        docs = await _attach_folder_metadata(docs)
        return [_doc_to_out(d) for d in docs]
    except Exception as e:
        logger.error(f"Error listing forms: {e}")
        return []


async def list_all_forms(skip: int = 0, limit: int = 100) -> List[FormOut]:
    try:
        cursor = DB.db.forms.find({}).skip(skip).limit(limit).sort([("created_at", -1)])
        docs = await cursor.to_list(length=limit)
        docs = await _attach_folder_metadata(docs)
        return [_doc_to_out(d) for d in docs]
    except Exception as e:
        logger.error(f"Error listing all forms: {e}")
        return []


async def search_forms(user_id: str, name: Optional[str] = None, folder: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[FormOut]:
    try:
        query: dict = {"user_id": user_id}
        if name:
            # case-insensitive partial match on title
            query["title"] = {"$regex": name, "$options": "i"}
        if folder:
            folder_values = [folder]
            try:
                folder_values.append(ObjectId(folder))
            except Exception:
                pass
            query["folder"] = {"$in": folder_values}

        cursor = DB.db.forms.find(query).skip(skip).limit(limit).sort([("created_at", -1)])
        docs = await cursor.to_list(length=limit)
        docs = await _attach_folder_metadata(docs)
        return [_doc_to_out(d) for d in docs]
    except Exception as e:
        logger.error(f"Error searching forms: {e}")
        return []


async def search_all_forms(name: Optional[str] = None, folder: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[FormOut]:
    try:
        query: dict = {}
        if name:
            query["title"] = {"$regex": name, "$options": "i"}
        if folder:
            folder_values = [folder]
            try:
                folder_values.append(ObjectId(folder))
            except Exception:
                pass
            query["folder"] = {"$in": folder_values}

        cursor = DB.db.forms.find(query).skip(skip).limit(limit).sort([("created_at", -1)])
        docs = await cursor.to_list(length=limit)
        docs = await _attach_folder_metadata(docs)
        return [_doc_to_out(d) for d in docs]
    except Exception as e:
        logger.error(f"Error searching all forms: {e}")
        return []


async def list_visible_forms(skip: int = 0, limit: int = 100) -> List[FormOut]:
    try:
        now = datetime.now()
        cursor = (
            DB.db.forms.find({"visible": True, "$or": [{"expires_at": {"$exists": False}}, {"expires_at": None}, {"expires_at": {"$gt": now}}]})
            .skip(skip)
            .limit(limit)
            .sort([("created_at", -1)])
        )
        docs = await cursor.to_list(length=limit)
        docs = await _attach_folder_metadata(docs)
        return [_doc_to_out(d) for d in docs]
    except Exception as e:
        logger.error(f"Error listing visible forms: {e}")
        return []


async def search_visible_forms(
    name: Optional[str] = None,
    folder: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[FormOut]:
    try:
        now = datetime.now()
        query: dict = {"visible": True, "$or": [{"expires_at": {"$exists": False}}, {"expires_at": None}, {"expires_at": {"$gt": now}}]}
        if name:
            query["title"] = {"$regex": name, "$options": "i"}
        if folder:
            folder_values = [folder]
            try:
                folder_values.append(ObjectId(folder))
            except Exception:
                pass
            query["folder"] = {"$in": folder_values}

        cursor = (
            DB.db.forms.find(query)
            .skip(skip)
            .limit(limit)
            .sort([("created_at", -1)])
        )
        docs = await cursor.to_list(length=limit)
        docs = await _attach_folder_metadata(docs)
        return [_doc_to_out(d) for d in docs]
    except Exception as e:
        logger.error(f"Error searching visible forms: {e}")
        return []


###########################
# Folder management
###########################


async def create_folder(user_id: str, name: str) -> Optional[dict]:
    try:
        # Prevent duplicate folder names for the same user (case-insensitive)
        existing = await DB.db.form_folders.find_one({"user_id": user_id, "name": {"$regex": f"^{name}$", "$options": "i"}})
        if existing:
            return None

        doc = {"user_id": user_id, "name": name, "created_at": datetime.now()}
        result = await DB.db.form_folders.insert_one(doc)
        if result.inserted_id:
            created = await DB.db.form_folders.find_one({"_id": result.inserted_id})
            if created:
                return {"_id": str(created.get("_id")), "name": created.get("name"), "created_at": created.get("created_at")}
        return None
    except Exception as e:
        logger.error(f"Error creating folder: {e}")
        return None


async def list_folders(user_id: str) -> List[dict]:
    try:
        cursor = DB.db.form_folders.find({"user_id": user_id}).sort([("created_at", -1)])
        docs = await cursor.to_list(length=None)
        # Convert ObjectId to string for JSON serialization
        out = []
        for d in docs:
            out.append({"_id": str(d.get("_id")), "name": d.get("name"), "created_at": d.get("created_at")})
        return out
    except Exception as e:
        logger.error(f"Error listing folders: {e}")
        return []


async def delete_folder(user_id: str, folder_id: str) -> bool:
    try:
        try:
            folder_obj_id = ObjectId(folder_id)
        except Exception:
            return False

        result = await DB.db.form_folders.delete_one({"_id": folder_obj_id, "user_id": user_id})
        return result.deleted_count > 0
    except Exception as e:
        logger.error(f"Error deleting folder: {e}")
        return False


async def get_form_by_id(form_id: str, user_id: str) -> Optional[FormOut]:
    try:
        doc = await DB.db.forms.find_one({"_id": ObjectId(form_id), "user_id": user_id})
        if not doc:
            return None
        annotated = await _attach_folder_metadata([doc])
        return _doc_to_out(annotated[0])
    except Exception as e:
        logger.error(f"Error fetching form: {e}")
        return None


async def get_form_by_slug(slug: str) -> Optional[FormOut]:
    try:
        now = datetime.now()
        doc = await DB.db.forms.find_one({"slug": slug, "visible": True, "$or": [{"expires_at": {"$exists": False}}, {"expires_at": None}, {"expires_at": {"$gt": now}}]})
        if not doc:
            return None
        annotated = await _attach_folder_metadata([doc])
        return _doc_to_out(annotated[0])
    except Exception as e:
        logger.error(f"Error fetching form by slug: {e}")
        return None


async def check_form_slug_status(slug: str) -> Tuple[str, Optional[dict]]:
    """Return a tuple (status, doc) where status is one of:
       - 'ok' : visible and not expired (doc returned)
       - 'not_found' : no form with that slug
       - 'expired' : form exists but has expired or is not currently visible
       - 'not_visible' : form exists but visible flag is False
    """
    try:
        # Try to find any form with the slug regardless of visibility/expiry
        doc_any = await DB.db.forms.find_one({"slug": slug})
        if not doc_any:
            return "not_found", None
        # Check visible flag first
        if not doc_any.get("visible", False):
            return "not_visible", doc_any
        # If visible, check expiry
        now = datetime.now()
        expires = doc_any.get("expires_at")
        if expires is None:
            return "ok", doc_any
        try:
            # If stored as string, attempt parse
            if isinstance(expires, str):
                expires_dt = datetime.fromisoformat(expires)
            else:
                expires_dt = expires
        except Exception:
            return "ok", doc_any
        if expires_dt <= now:
            return "expired", doc_any
        return "ok", doc_any
    except Exception as e:
        logger.error(f"Error checking form slug status: {e}")
        return "not_found", None


async def get_form_by_id_unrestricted(form_id: str) -> Optional[FormOut]:
    try:
        doc = await DB.db.forms.find_one({"_id": ObjectId(form_id)})
        if not doc:
            return None
        annotated = await _attach_folder_metadata([doc])
        return _doc_to_out(annotated[0])
    except Exception as e:
        logger.error(f"Error fetching form by id: {e}")
        return None


async def get_visible_form_by_id(form_id: str) -> Optional[FormOut]:
    try:
        now = datetime.now()
        doc = await DB.db.forms.find_one({"_id": ObjectId(form_id), "visible": True, "$or": [{"expires_at": {"$exists": False}}, {"expires_at": None}, {"expires_at": {"$gt": now}}]})
        if not doc:
            return None
        annotated = await _attach_folder_metadata([doc])
        return _doc_to_out(annotated[0])
    except Exception as e:
        logger.error(f"Error fetching visible form by id: {e}")
        return None


async def list_visible_folders() -> List[dict]:
    try:
        cursor = DB.db.form_folders.find({}).sort([("name", 1)])
        docs = await cursor.to_list(length=None)
        output: List[dict] = []
        seen_ids: set[str] = set()

        for doc in docs:
            folder_id = str(doc.get("_id")) if doc.get("_id") else None
            name = doc.get("name")
            output.append({
                "_id": folder_id,
                "name": name,
                "created_at": doc.get("created_at"),
            })
            if folder_id:
                seen_ids.add(folder_id)

        distinct_folders = await DB.db.forms.distinct(
            "folder", {"folder": {"$exists": True, "$ne": None, "$ne": ""}}
        )
        for value in distinct_folders:
            normalized = _normalize_folder_value(value)
            if not normalized or normalized in seen_ids:
                continue
            output.append({"_id": normalized, "name": normalized, "created_at": None})
            seen_ids.add(normalized)

        output.sort(key=lambda item: (item.get("name") or "").lower())
        return output
    except Exception as e:
        logger.error(f"Error listing visible folders: {e}")
        return []


def _get_schema_fields(schema_data: Any) -> List[dict]:
    if isinstance(schema_data, list):
        return schema_data
    raise ValueError("Unsupported form schema: expected an array of field definitions")


def _is_present(value: Any) -> bool:
    return value is not None and value != ""


def _validate_field(field: dict, value: Any) -> Tuple[bool, Optional[str]]:
    t = field.get("type")
    component_name = field.get("label") or field.get("component_name")
    # Text/textarea
    if t in ("text", "textarea"):
        if field.get("required") and not _is_present(value):
            return False, f"{component_name} is required"
        if value is None:
            return True, None
        if not isinstance(value, str):
            return False, f"{component_name} must be a string"
        if field.get("minLength") is not None and len(value) < field.get("minLength"):
            return False, f"{component_name} must be at least {field.get('minLength')} characters"
        if field.get("maxLength") is not None and len(value) > field.get("maxLength"):
            return False, f"{component_name} must be at most {field.get('maxLength')} characters"
        if field.get("pattern"):
            if not re.match(field.get("pattern"), value):
                return False, f"{component_name} is invalid"
        return True, None

    if t == "email":
        if field.get("required") and not _is_present(value):
            return False, f"{component_name} is required"
        if value is None:
            return True, None
        email_re = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
        if not isinstance(value, str) or not email_re.match(value):
            return False, f"{component_name} must be a valid email"
        return True, None

    if t == "number":
        if field.get("required") and value is None:
            return False, f"{component_name} is required"
        if value is None:
            return True, None
        try:
            n = float(value)
        except Exception:
            return False, f"{component_name} must be a number"
        if field.get("min") is not None and n < field.get("min"):
            return False, f"{component_name} must be >= {field.get('min')}"
        if field.get("max") is not None and n > field.get("max"):
            return False, f"{component_name} must be <= {field.get('max')}"
        # allowedValues CSV
        if field.get("allowedValues"):
            try:
                allowed = [float(x.strip()) for x in field.get("allowedValues").split(",") if x.strip()]
                if allowed and n not in allowed:
                    return False, f"{component_name} must be one of: {', '.join(str(int(x)) if x.is_integer() else str(x) for x in allowed)}"
            except Exception:
                pass
        return True, None

    if t in ("checkbox", "switch"):
        if field.get("required") and not value:
            return False, f"{component_name} must be checked"
        return True, None

    if t in ("select", "radio"):
        if field.get("required"):
            if value is None:
                return False, f"{component_name} is required"
            if isinstance(value, list) and len(value) == 0:
                return False, f"{component_name} is required"
            if isinstance(value, str) and value == "":
                return False, f"{component_name} is required"
        return True, None

    if t == "date":
        # expect ISO date strings for single date, or {from,to} for range
        from datetime import datetime as _dt
        fcfg = field
        if fcfg.get("mode") == "range":
            if fcfg.get("required"):
                if not value or not value.get("from") or not value.get("to"):
                    return False, f"{component_name} is required"
            if not value:
                return True, None
            try:
                fr = _dt.fromisoformat(value.get("from")) if value.get("from") else None
                to = _dt.fromisoformat(value.get("to")) if value.get("to") else None
            except Exception:
                return False, f"{component_name} has invalid date format"
            if fr and to and to < fr:
                return False, f"{component_name} end date must be on or after start date"
            if fcfg.get("minDate"):
                try:
                    minD = _dt.fromisoformat(fcfg.get("minDate")) if isinstance(fcfg.get("minDate"), str) else fcfg.get("minDate")
                    if fr and fr < minD:
                        return False, f"{component_name} must be on or after {minD.date()}"
                except Exception:
                    pass
            if fcfg.get("maxDate"):
                try:
                    maxD = _dt.fromisoformat(fcfg.get("maxDate")) if isinstance(fcfg.get("maxDate"), str) else fcfg.get("maxDate")
                    if to and to > maxD:
                        return False, f"{component_name} must be on or before {maxD.date()}"
                except Exception:
                    pass
            return True, None
        else:
            if field.get("required") and not _is_present(value):
                return False, f"{component_name} is required"
            if not _is_present(value):
                return True, None
            try:
                _dt.fromisoformat(value)
                return True, None
            except Exception:
                return False, f"{component_name} has invalid date format"

    if t == "time":
        if field.get("required") and not _is_present(value):
            return False, f"{component_name} is required"
        if not _is_present(value):
            return True, None

        if not re.match(r"^([01]\d|2[0-3]):([0-5]\d)$", value):
            return False, f"{component_name} has invalid time format"
        return True, None

    return True, None


def _to_base_key(k: str) -> str:
    return re.sub(r"\.[a-z]{2,}$", "", k or "")


def _canonicalize_response(resp: Any) -> Any:
    """Collapse locale-suffixed keys (e.g., name.en, name.es) into a single base key ('name').
    Preference order: exact base key if present, else '.en' if present, else the first available locale value.
    """
    if not isinstance(resp, dict):
        return resp
    canonical: dict = {}
    buckets: dict[str, dict[str, Any]] = {}
    for k, v in resp.items():
        base = _to_base_key(k)
        # If the exact base key exists, prefer it and don't overwrite
        if k == base:
            if base not in canonical:
                canonical[base] = v
            # No need to add to buckets; base wins
            continue
        # Collect localized variants
        if base not in buckets:
            buckets[base] = {}
        buckets[base][k] = v

    # For any base not already set by exact key, choose a localized value
    for base, variants in buckets.items():
        if base in canonical:
            continue
        # Prefer '.en' if present
        en_key = f"{base}.en"
        if en_key in variants:
            canonical[base] = variants[en_key]
            continue
        # Else take the first variant in sorted key order for stability
        first_key = sorted(variants.keys())[0]
        canonical[base] = variants[first_key]
    return canonical


async def add_response_by_slug(slug: str, response: Any, user_id: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """Validate the response against the stored form schema and append it to a single
    aggregated response document for the form (one document per form_id) in the
    form_responses collection under the `responses` array.

    Returns (True, response_identifier) or (False, error_message). The identifier is
    the ISO timestamp of when the response was recorded.
    """
    try:
        status_str, doc_any = await check_form_slug_status(slug)
        if status_str == "not_found":
            return False, "Form not found"
        if status_str == "not_visible":
            return False, "Form not available"
        if status_str == "expired":
            return False, "Form expired"
        doc = doc_any
        if not doc:
            return False, "Form not found"
        form_id = doc.get("_id")
        try:
            schema_fields = _get_schema_fields(doc.get("data"))
        except ValueError as ve:
            return False, str(ve)

        # Canonicalize the response to collapse locale-specific keys
        response_canon = _canonicalize_response(response or {})

        # Validate each declared field against the provided response payload
        for f in schema_fields:
            name = f.get("name")
            # value may be under exact name or localized variants; response_canon already collapsed
            value = response_canon.get(name)
            valid, err = _validate_field(f, value)
            if not valid:
                return False, err

        # Upsert a single aggregated responses document per form_id and push the new response
        now = datetime.now()
        # Build response entry and include user_id if provided
        entry: dict = {"response": response_canon, "submitted_at": now}
        if user_id:
            try:
                entry["user_id"] = ObjectId(user_id)
            except Exception:
                # fallback to plain string if not a valid ObjectId
                entry["user_id"] = user_id

        update_result = await DB.db.form_responses.update_one(
            {"form_id": form_id},
            {"$push": {"responses": entry}},
            upsert=True,
        )
        if update_result.matched_count == 0 and update_result.upserted_id is None:
            # Shouldn't happen, but indicates failure
            return False, "Failed to store response"
        # Return the timestamp as a stable identifier for the recorded response
        return True, now.isoformat()
    except Exception as e:
        logger.error(f"Error adding response for slug {slug}: {e}")
        return False, "Server error"


async def update_form(form_id: str, user_id: str, update: FormUpdate) -> Optional[FormOut]:
    try:
        update_doc = {"updated_at": datetime.now()}
        if update.title is not None:
            update_doc["title"] = update.title
        if update.description is not None:
            update_doc["description"] = update.description
        if update.visible is not None:
            update_doc["visible"] = update.visible
        if update.data is not None:
            update_doc["data"] = (update.data)
        if update.expires_at is not None:
            # Normalize tz-aware datetimes to local naive datetime before storing
            expires_val = update.expires_at
            if isinstance(expires_val, datetime) and expires_val.tzinfo is not None:
                try:
                    expires_val = expires_val.astimezone().replace(tzinfo=None)
                except Exception:
                    pass
            update_doc["expires_at"] = expires_val
        
        # Handle payment configuration updates
        if update.requires_payment is not None:
            update_doc["requires_payment"] = update.requires_payment
        if update.payment_amount is not None:
            update_doc["payment_amount"] = update.payment_amount
        if update.payment_type is not None:
            update_doc["payment_type"] = update.payment_type
        if update.payment_description is not None:
            update_doc["payment_description"] = update.payment_description
        if update.min_payment_amount is not None:
            update_doc["min_payment_amount"] = update.min_payment_amount
        if update.max_payment_amount is not None:
            update_doc["max_payment_amount"] = update.max_payment_amount
        
        try:
            provided = update.model_dump(exclude_unset=True)
        except Exception:
            provided = {k: getattr(update, k) for k in update.__dict__.keys()}
        if "folder" in provided:
            update_doc["folder"] = provided.get("folder")
        if "slug" in provided:
            update_doc["slug"] = provided.get("slug")
        if "form_width" in provided:
            update_doc["form_width"] = _normalize_form_width_value(provided.get("form_width")) or DEFAULT_FORM_WIDTH
        if "expires_at" in provided:
            # Provided value may be a datetime; normalize similarly
            provided_val = provided.get("expires_at")
            if isinstance(provided_val, datetime) and provided_val.tzinfo is not None:
                try:
                    provided_val = provided_val.astimezone().replace(tzinfo=None)
                except Exception:
                    pass
            update_doc["expires_at"] = provided_val

        result = await DB.db.forms.update_one({"_id": ObjectId(form_id), "user_id": user_id}, {"$set": update_doc})
        if result.matched_count:
            doc = await DB.db.forms.find_one({"_id": ObjectId(form_id)})
            return _doc_to_out(doc) if doc else None
        return None
    except Exception as e:
        logger.error(f"Error updating form: {e}")
        return None


async def delete_form(form_id: str, user_id: str) -> bool:
    try:
        try:
            form_obj_id = ObjectId(form_id)
        except Exception:
            return False

        result = await DB.db.forms.delete_one({"_id": form_obj_id, "user_id": user_id})
        if result.deleted_count > 0:
            await DB.db.form_responses.delete_one({"form_id": form_obj_id})
            return True
        return False
    except Exception as e:
        logger.error(f"Error deleting form: {e}")
        return False


async def delete_form_responses(form_id: str, user_id: str) -> bool:
    try:
        try:
            form_obj_id = ObjectId(form_id)
        except Exception:
            return False

        owned_form = await DB.db.forms.find_one({"_id": form_obj_id, "user_id": user_id})
        if not owned_form:
            return False

        await DB.db.form_responses.delete_one({"form_id": form_obj_id})
        return True
    except Exception as e:
        logger.error(f"Error deleting form responses: {e}")
        return False


async def get_form_responses(form_id: str, user_id: str, skip: int = 0, limit: int | None = None) -> Optional[dict]:
    """Return responses for a form owned by the given user.

    Results include total count and a slice of items sorted by submitted_at DESC.
    The submitted_at values are returned as ISO strings for JSON serialization.
    """
    try:
        agg_doc = await DB.db.form_responses.find_one({"form_id": ObjectId(form_id)})
        if not agg_doc:
            return {"form_id": form_id, "count": 0, "items": []}

        responses = agg_doc.get("responses", []) or []
        # Sort by submitted_at desc (handle missing gracefully)
        def _to_dt(x):
            return x.get("submitted_at") or datetime.min

        responses_sorted = sorted(responses, key=_to_dt, reverse=True)

        total = len(responses_sorted)
        # Apply pagination
        start = max(0, int(skip))
        if limit is None:
            # No limit - return all items from start
            page_items = responses_sorted[start:]
        else:
            end = max(start, start + int(limit))
            page_items = responses_sorted[start:end]

        items = []
        for r in page_items:
            submitted = r.get("submitted_at")
            if isinstance(submitted, datetime):
                submitted_iso = submitted.isoformat()
            else:
                submitted_iso = str(submitted) if submitted is not None else None
            # Convert user_id to string if present
            uid = r.get("user_id")
            if isinstance(uid, ObjectId):
                uid_str = str(uid)
            else:
                uid_str = str(uid) if uid is not None else None
            items.append({
                "submitted_at": submitted_iso,
                "user_id": uid_str,
                "response": _canonicalize_response(r.get("response", {})),
            })

        return {"form_id": form_id, "count": total, "items": items}
    except Exception as e:
        logger.error(f"Error getting form responses: {e}")
        return None

