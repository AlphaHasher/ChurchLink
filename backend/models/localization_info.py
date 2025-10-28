from datetime import datetime
from typing import Dict, List

from mongo.database import DB


COLLECTION_NAME = "localization-info"


async def _ensure_entry(namespace: str) -> Dict[str, any]:
    if not namespace:
        raise ValueError("namespace is required")

    existing = await DB.db[COLLECTION_NAME].find_one({"namespace": namespace})
    if existing:
        return existing

    now = datetime.utcnow()
    entry = {
        "namespace": namespace,
        "locales": ["en"],
        "default_locale": "en",
        "created_at": now,
        "updated_at": now,
    }
    await DB.db[COLLECTION_NAME].insert_one(entry)
    return entry


async def get_localization_info(namespace: str) -> Dict[str, any]:
    entry = await _ensure_entry(namespace)
    # Normalize locales to always include "en" and remain unique
    locales = entry.get("locales") or []
    seen = []
    for code in locales:
        if code not in seen and code:
            seen.append(code)
    if "en" not in seen:
        seen.insert(0, "en")
        await DB.db[COLLECTION_NAME].update_one(
            {"namespace": namespace},
            {"$set": {"locales": seen, "updated_at": datetime.utcnow()}},
        )
        entry["locales"] = seen
    else:
        entry["locales"] = seen
    return entry


async def get_locales(namespace: str) -> List[str]:
    info = await get_localization_info(namespace)
    return info.get("locales", ["en"])


async def add_locale(namespace: str, code: str) -> bool:
    code = (code or "").strip()
    if not code:
        return False

    entry = await _ensure_entry(namespace)
    locales = list(entry.get("locales") or [])
    if code in locales:
        return True

    result = await DB.db[COLLECTION_NAME].update_one(
        {"namespace": namespace},
        {
            "$setOnInsert": {
                "created_at": datetime.utcnow(),
            },
            "$addToSet": {"locales": code},
            "$set": {"updated_at": datetime.utcnow()},
        },
        upsert=True,
    )
    return bool(result.modified_count or result.upserted_id)


async def set_locales(namespace: str, locales: List[str]) -> bool:
    if locales is None:
        locales = []

    normalized: List[str] = []
    for code in locales:
        code = (code or "").strip()
        if code and code not in normalized:
            normalized.append(code)

    if "en" not in normalized:
        normalized.insert(0, "en")

    await _ensure_entry(namespace)
    result = await DB.db[COLLECTION_NAME].update_one(
        {"namespace": namespace},
        {
            "$set": {
                "locales": normalized,
                "updated_at": datetime.utcnow(),
            }
        },
    )
    return result.modified_count > 0


async def remove_locale(namespace: str, code: str) -> bool:
    code = (code or "").strip()
    if not code or code == "en":
        return False

    await _ensure_entry(namespace)
    result = await DB.db[COLLECTION_NAME].update_one(
        {"namespace": namespace},
        {
            "$pull": {"locales": code},
            "$set": {"updated_at": datetime.utcnow()},
        },
    )
    return result.modified_count > 0


async def set_default_locale(namespace: str, code: str) -> bool:
    code = (code or "").strip() or "en"

    await _ensure_entry(namespace)
    await add_locale(namespace, code)

    result = await DB.db[COLLECTION_NAME].update_one(
        {"namespace": namespace},
        {
            "$set": {
                "default_locale": code,
                "updated_at": datetime.utcnow(),
            }
        },
    )
    return result.modified_count > 0


async def get_default_locale(namespace: str) -> str:
    info = await get_localization_info(namespace)
    default = info.get("default_locale") or "en"
    if default not in info.get("locales", []):
        await add_locale(namespace, default)
    return default


