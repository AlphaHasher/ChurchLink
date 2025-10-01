from typing import Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from mongo.database import DB


class TranslationCache(BaseModel):
    """Model for storing translation cache entries"""
    text: str = Field(..., description="The original text to translate")
    translations: Dict[str, str] = Field(default_factory=dict, description="Language code -> translation mapping")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


async def get_cached_translations(text: str) -> Optional[Dict[str, str]]:
    """
    Get all cached translations for a text.

    Args:
        text: The original text

    Returns:
        Dict of language -> translation for all cached languages, None if no cache exists
    """
    try:
        doc = await DB.db.translation_cache.find_one({"text": text})
        if not doc:
            return None

        return doc.get("translations", {})
    except Exception as e:
        print(f"Error getting cached translations: {e}")
        return None


async def update_translation_cache(text: str, translations: Dict[str, str]) -> bool:
    """
    Update or create translation cache entry.

    Args:
        text: The original text
        translations: Dict of language -> translation to cache

    Returns:
        True if successful, False otherwise
    """
    try:
        now = datetime.now()
        update_data = {
            "text": text,
            "translations": translations,
            "updated_at": now,
            "last_accessed": now
        }

        result = await DB.db.translation_cache.update_one(
            {"text": text},
            {"$set": update_data},
            upsert=True
        )

        return result.acknowledged
    except Exception as e:
        print(f"Error updating translation cache: {e}")
        return False


async def get_missing_translations(text: str, target_languages: List[str]) -> List[str]:
    """
    Get list of languages that need translation for a given text.

    Args:
        text: The original text
        target_languages: List of language codes requested

    Returns:
        List of language codes that need translation
    """
    cached = await get_cached_translations(text)
    if not cached:
        return target_languages  # All languages need translation

    return [lang for lang in target_languages if lang not in cached]
