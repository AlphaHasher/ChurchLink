import time
import logging
from typing import Callable, Optional, Dict, Any
from BulkTranslator.savedGoogleTrans import Translator
from BulkTranslator.savedGoogleTrans.constants import LANGUAGES

logger = logging.getLogger(__name__)
translator = Translator()


class BulkTranslator:
    # Global throttling callback - can be set to notify when rate limiting occurs
    throttling_callback: Optional[Callable[[Dict[str, Any]], None]] = None

    @classmethod
    def set_throttling_callback(cls, callback: Callable[[Dict[str, Any]], None]):
        """Set a callback function to be called when rate limiting/throttling occurs"""
        cls.throttling_callback = callback

    @staticmethod
    def translateFromEnglish(items: list, dest: str):
        try:
            results = translator.translate(items, dest=dest, src="en")
            return results.text
        except Exception as e:
            if "Rate limited" in str(e) or "CAPTCHA" in str(e) or "429" in str(e):
                # Notify about throttling
                if BulkTranslator.throttling_callback:
                    BulkTranslator.throttling_callback({
                        "type": "rate_limited",
                        "error": str(e),
                        "timestamp": time.time(),
                        "method": "translateFromEnglish",
                        "items_count": len(items),
                        "src": "en",
                        "dest": dest
                    })
            raise

    @staticmethod
    def translateFromOther(items: list, src: str, dest: str):
        try:
            results = translator.translate(items, dest=dest, src=src)
            return results.text
        except Exception as e:
            if "Rate limited" in str(e) or "CAPTCHA" in str(e) or "429" in str(e):
                # Notify about throttling
                if BulkTranslator.throttling_callback:
                    BulkTranslator.throttling_callback({
                        "type": "rate_limited",
                        "error": str(e),
                        "timestamp": time.time(),
                        "method": "translateFromOther",
                        "items_count": len(items),
                        "src": src,
                        "dest": dest
                    })
            raise

    @staticmethod
    def translateFromEnglishMulti(texts: list, dest_languages=None):
        """
        Translate texts from English to multiple languages.

        Args:
            texts: List of English texts to translate
            dest_languages: List of destination language codes. If None, translates to all languages.

        Returns:
            Dictionary mapping original texts to their translations in each language
        """
        local_translator = Translator()

        try:
            # Use specific languages if provided, otherwise use all available languages
            if dest_languages is None:
                dest_languages = [code for code in LANGUAGES.keys() if code != "en"]

            # Translate to multiple languages
            result = local_translator.translate_multi_language(texts, dest_languages, src="en")

            return result
        except Exception as e:
            if "Rate limited" in str(e) or "CAPTCHA" in str(e) or "429" in str(e):
                # Notify about throttling
                if BulkTranslator.throttling_callback:
                    BulkTranslator.throttling_callback({
                        "type": "rate_limited",
                        "error": str(e),
                        "timestamp": time.time(),
                        "method": "translateFromEnglishMulti",
                        "items_count": len(texts),
                        "src": "en",
                        "dest_languages": dest_languages
                    })
            raise
        finally:
            # Close the translator
            local_translator.close()

    @staticmethod
    def translateFromOtherMulti(items: list, src: str, dest_languages: list):
        """
        Translate items from source language to multiple languages in a single request.

        Args:
            items: List of strings to translate
            src: Source language code
            dest_languages: List of destination language codes (or None/empty list for all languages)

        Returns:
            Dictionary mapping each word to a dict of language: translation
            Example: {"hello": {"es": "Hola", "fr": "Bonjour", "de": "Hallo"}}
        """
        # If dest_languages is empty, set to None to translate to all languages
        if not dest_languages:
            dest_languages = None

        try:
            results = translator.translate_multi_language(items, dest_languages, src=src)
            return results
        except Exception as e:
            if "Rate limited" in str(e) or "CAPTCHA" in str(e) or "429" in str(e):
                # Notify about throttling
                if BulkTranslator.throttling_callback:
                    BulkTranslator.throttling_callback({
                        "type": "rate_limited",
                        "error": str(e),
                        "timestamp": time.time(),
                        "method": "translateFromOtherMulti",
                        "items_count": len(items),
                        "src": src,
                        "dest_languages": dest_languages
                    })
            raise

    @staticmethod
    def close():
        """Close the translator client"""
        translator.close()


    
