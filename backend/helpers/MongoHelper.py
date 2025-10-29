from bson import ObjectId
from typing import Any, Dict, List, Union
import uuid
from datetime import datetime, timezone


def serialize_objectid(obj: Any) -> Any:
    """
    Helper function to convert ObjectId to string in nested structures.
    
    Recursively traverses dictionaries and lists to convert any ObjectId instances
    to their string representation for JSON serialization.
    """
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {k: serialize_objectid(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_objectid(item) for item in obj]
    else:
        return obj


def serialize_objectid_deep(obj: Any) -> Any:
    return serialize_objectid(obj)


def generate_unique_id(prefix: str = "") -> str:
    """
    Generate a unique ID with optional prefix
    
    Args:
        prefix: Optional prefix for the ID (e.g., "RFD" for refunds)
        
    Returns:
        Unique string ID in format: PREFIX_YYYYMMDD_HHMMSS_UUID4
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    unique_part = str(uuid.uuid4())[:8].upper()  # First 8 chars of UUID4
    
    if prefix:
        return f"{prefix}_{timestamp}_{unique_part}"
    else:
        return f"{timestamp}_{unique_part}"