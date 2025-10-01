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

        for item in items:
            cached_translations = await get_cached_translations(item)
            item_result = {}

            if target_languages:
                if cached_translations:
                    for lang in target_languages:
                        if lang in cached_translations:
                            item_result[lang] = cached_translations[lang]

                missing_languages = await get_missing_translations(item, target_languages)

                if missing_languages:
                    new_translations = BulkTranslator.translateFromOtherMulti([item], src, missing_languages)

                    for lang in missing_languages:
                        if item in new_translations and lang in new_translations[item]:
                            item_result[lang] = new_translations[item][lang]

                    if cached_translations:
                        all_translations = {**cached_translations, **{lang: item_result[lang] for lang in missing_languages if lang in item_result}}
                    else:
                        all_translations = item_result.copy()

                    await update_translation_cache(item, all_translations)
            else:
                from BulkTranslator.savedGoogleTrans.constants import LANGUAGES
                all_languages = [code for code in LANGUAGES.keys() if code != src]

                if cached_translations:
                    item_result = cached_translations.copy()

                missing_languages = await get_missing_translations(item, all_languages)

                if missing_languages:
                    new_translations = BulkTranslator.translateFromOtherMulti([item], src, [])

                    if item in new_translations:
                        item_result.update(new_translations[item])

                    await update_translation_cache(item, item_result)

            result[item] = item_result

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
