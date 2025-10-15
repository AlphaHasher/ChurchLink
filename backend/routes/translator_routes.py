from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import time
from BulkTranslator.BulkTranslator import BulkTranslator
from models.translation_cache import (
    get_cached_translations,
    update_translation_cache,
    get_missing_translations
)

translator_router = APIRouter(prefix="/translator", tags=["Translator"])

throttling_events = []

def throttling_callback(event: Dict[str, Any]):
    """Callback function to handle throttling events"""
    throttling_events.append(event)
    if len(throttling_events) > 10:
        throttling_events.pop(0)
    print(f"🚦 Throttling event: {event['type']} in {event['method']} - {event.get('error', 'Unknown error')}")

BulkTranslator.set_throttling_callback(throttling_callback)


@translator_router.get("/languages")
async def get_supported_languages():
    """Return the list of supported language codes and names.

    Uses the LANGUAGES mapping from savedGoogleTrans constants.
    """
    try:
        from BulkTranslator.savedGoogleTrans.constants import LANGUAGES
        languages = [{"code": code, "name": name} for code, name in LANGUAGES.items()]
        return {"languages": languages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load languages: {str(e)}")


@translator_router.post("/translate-multi")
async def translate_from_other_multi(
    items: List[str],
    dest_languages: List[str] = None,
    src: str = "en"
):
    """
    Translate text items to multiple languages with intelligent caching.

    Args:
        items: List of text strings to translate
        dest_languages: List of destination language codes. If empty/None, translates to all languages
        src: Source language code (defaults to "en")

    Returns:
        Dict mapping each item to its translations in requested languages
    """
    if not src:
        src = "en"

    try:
        result = {}

        target_languages = dest_languages if dest_languages else None

        # Preload cache for all items to minimize DB roundtrips in the hot path
        cache_by_item: Dict[str, Dict[str, str]] = {}
        for item in items:
            cache_by_item[item] = await get_cached_translations(item)

        if target_languages:
            # Build a single batch request for items that are missing any target languages
            items_to_fetch = []
            langs_to_fetch = set()

            for item in items:
                cached_translations = cache_by_item.get(item) or {}
                # Seed result with any cached values for requested languages
                result[item] = {lang: cached_translations[lang] for lang in target_languages if lang in cached_translations}

                missing_languages = await get_missing_translations(item, target_languages)
                if missing_languages:
                    items_to_fetch.append(item)
                    langs_to_fetch.update(missing_languages)

            new_translations = {}
            if items_to_fetch and langs_to_fetch:
                # One call for all items and union of missing languages
                new_translations = BulkTranslator.translateFromOtherMulti(items_to_fetch, src, list(langs_to_fetch)) or {}

            # Merge new translations into results and update cache per item
            for item in items:
                cached_translations = cache_by_item.get(item) or {}
                updated = dict(result[item])  # start with already-seeded cached subset
                if item in new_translations:
                    # Filter only requested target languages
                    for lang in target_languages:
                        val = new_translations[item].get(lang)
                        if val is not None:
                            updated[lang] = val

                # Persist merged cache if we added anything new
                if updated and updated != (cached_translations or {}):
                    merged = {**cached_translations, **updated}
                    await update_translation_cache(item, merged)

                result[item] = updated
        else:
            # All languages path: compute which items are missing anything and batch once
            from BulkTranslator.savedGoogleTrans.constants import LANGUAGES
            all_languages = [code for code in LANGUAGES.keys() if code != src]

            items_to_fetch = []
            for item in items:
                cached_translations = cache_by_item.get(item) or {}
                # Seed with cached if present
                result[item] = dict(cached_translations) if cached_translations else {}

                missing_languages = await get_missing_translations(item, all_languages)
                if missing_languages:
                    items_to_fetch.append(item)

            new_translations = {}
            if items_to_fetch:
                # One call for all items; dest_languages=None means translate to all languages
                new_translations = BulkTranslator.translateFromOtherMulti(items_to_fetch, src, []) or {}

            for item in items:
                cached_translations = cache_by_item.get(item) or {}
                updated = dict(result[item])
                if item in new_translations:
                    updated.update(new_translations[item])

                if updated and updated != (cached_translations or {}):
                    await update_translation_cache(item, updated)

                result[item] = updated

        recent_throttling = [event for event in throttling_events if time.time() - event['timestamp'] < 300]

        response_data = {"translations": result}

        if recent_throttling:
            response_data["throttling_warning"] = {
                "message": "Some translations were delayed due to rate limiting from Google Translate API",
                "events": len(recent_throttling),
                "last_event": recent_throttling[-1]['timestamp'] if recent_throttling else None
            }

        return response_data
    except Exception as e:
        error_msg = str(e)
        if "Rate limited" in error_msg or "CAPTCHA" in error_msg or "429" in error_msg:
            raise HTTPException(
                status_code=429,
                detail=f"Google Translate API rate limit exceeded. Please try again later. Error: {error_msg}"
            )
        else:
            raise HTTPException(status_code=500, detail=f"Translation failed: {error_msg}")


@translator_router.get("/status")
async def get_translator_status():
    """
    Get current translator status including throttling events.

    Returns:
        Dict with operational status and recent throttling events
    """
    recent_throttling = [event for event in throttling_events if time.time() - event['timestamp'] < 300]

    return {
        "status": "operational",
        "throttling_events_last_5min": len(recent_throttling),
        "recent_events": recent_throttling[-5:] if recent_throttling else []
    }
