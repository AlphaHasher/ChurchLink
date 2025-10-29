"""
Form translation routes for localizing form content using the translator service.

Forms support multiple locales and use the translator endpoint to generate
translations on-demand rather than storing them inline.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from models.form import get_form_by_id_unrestricted, get_form_by_slug
from routes.translator_routes import BulkTranslator
from protected_routers.mod_protected_router import _attach_mod_user_to_state
import logging

logger = logging.getLogger(__name__)

form_translations_router = APIRouter(prefix="/forms", tags=["Forms"])


class TranslationRequest(BaseModel):
    """Request body for translation endpoint."""
    dest_languages: Optional[List[str]] = None


def extract_translatable_text(form_data: List[Dict[str, Any]]) -> List[str]:
    """
    Extract all translatable text from form field definitions.
    
    Includes: labels, placeholders, helpText, and option labels.
    """
    texts = []
    
    for field in form_data:
        # Add label
        if label := field.get("label"):
            texts.append(label)
        
        # Add placeholder
        if placeholder := field.get("placeholder"):
            texts.append(placeholder)
        
        # Add helpText
        if help_text := field.get("helpText"):
            texts.append(help_text)
        
        # Add option labels for select/radio fields
        if options := field.get("options"):
            for option in options:
                if opt_label := option.get("label"):
                    texts.append(opt_label)
        
        # Add content for static text fields
        if field.get("type") == "static":
            if content := field.get("content"):
                texts.append(content)
    
    return texts


@form_translations_router.post("/{form_id}/translate", dependencies=[Depends(_attach_mod_user_to_state)])
async def translate_form_content(
    form_id: str,
    body: TranslationRequest
) -> Dict[str, Any]:
    """
    Translate form content to specified languages.
    
    Extracts all translatable text from the form and requests translations
    via the translator service. Translations are cached by the translator.
    
    Args:
        form_id: The form ID to translate
        dest_languages: List of destination language codes. If None/empty, translates to all available languages
    
    Returns:
        Dict mapping field IDs/positions to their translations in each language
    """
    try:
        # Fetch the form
        form = await get_form_by_id_unrestricted(form_id)
        if not form:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Form not found"
            )
        
        # Extract translatable text from the form data
        form_data = form.data if isinstance(form.data, list) else []
        translatable_texts = extract_translatable_text(form_data)
        
        if not translatable_texts:
            return {
                "form_id": form_id,
                "translations": {},
                "supported_locales": form.supported_locales or []
            }
        
        # Determine target languages
        target_languages = body.dest_languages or form.supported_locales or None
        
        # Request translations from the translator service
        try:
            translation_result = BulkTranslator.translateFromOtherMulti(
                translatable_texts,
                src="en",
                dest_languages=target_languages or []
            )
        except Exception as e:
            error_msg = str(e)
            if "Rate limited" in error_msg or "CAPTCHA" in error_msg or "429" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Translation service rate limited: {error_msg}"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Translation failed: {error_msg}"
                )
        
        # Build a mapping of text positions to their translations
        # This allows the frontend to apply translations to the correct fields
        translation_map = {}
        for idx, text in enumerate(translatable_texts):
            if text in translation_result:
                translation_map[str(idx)] = translation_result[text]
        
        return {
            "form_id": form_id,
            "translations": translation_map,
            "supported_locales": form.supported_locales or []
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error translating form {form_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to translate form"
        )


@form_translations_router.post("/slug/{slug}/translate", dependencies=[Depends(_attach_mod_user_to_state)])
async def translate_form_by_slug(
    slug: str,
    body: TranslationRequest
) -> Dict[str, Any]:
    """
    Translate form content by slug to specified languages.
    
    Similar to translate_form_content but looks up the form by slug instead of ID.
    
    Args:
        slug: The form slug to translate
        dest_languages: List of destination language codes
    
    Returns:
        Dict mapping field positions to their translations in each language
    """
    try:
        # Fetch the form by slug
        form = await get_form_by_slug(slug)
        if not form:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Form not found"
            )
        
        # Extract translatable text from the form data
        form_data = form.data if isinstance(form.data, list) else []
        translatable_texts = extract_translatable_text(form_data)
        
        if not translatable_texts:
            return {
                "slug": slug,
                "translations": {},
                "supported_locales": form.supported_locales or []
            }
        
        # Determine target languages
        target_languages = body.dest_languages or form.supported_locales or None
        
        # Request translations from the translator service
        try:
            translation_result = BulkTranslator.translateFromOtherMulti(
                translatable_texts,
                src="en",
                dest_languages=target_languages or []
            )
        except Exception as e:
            error_msg = str(e)
            if "Rate limited" in error_msg or "CAPTCHA" in error_msg or "429" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Translation service rate limited: {error_msg}"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Translation failed: {error_msg}"
                )
        
        # Build a mapping of text positions to their translations
        translation_map = {}
        for idx, text in enumerate(translatable_texts):
            if text in translation_result:
                translation_map[str(idx)] = translation_result[text]
        
        return {
            "slug": slug,
            "translations": translation_map,
            "supported_locales": form.supported_locales or []
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error translating form by slug {slug}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to translate form"
        )


__all__ = ["form_translations_router"]
