"""
ran into weird errors so had claude cook
"""

from bson import ObjectId
from typing import Any, Dict, List, Union


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