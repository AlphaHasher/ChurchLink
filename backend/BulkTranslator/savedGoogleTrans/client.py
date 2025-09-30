# -*- coding: utf-8 -*-
"""
A Translation module.

You can translate text using this module.
"""
import random
import json
import time
import secrets
import typing
import urllib.parse
import httpx
from httpx import Timeout
from BulkTranslator.savedGoogleTrans.constants import (
    DEFAULT_CLIENT_SERVICE_URLS,
    DEFAULT_FALLBACK_SERVICE_URLS,
    DEFAULT_USER_AGENT,
    LANGCODES,
    LANGUAGES,
    SPECIAL_CASES,
    DEFAULT_RAISE_EXCEPTION,
)

RPC_ID = "MkEWBc"

# Type aliases (for future use)
# import typing
# ProxyTypes = typing.Union[httpx.Proxy, str]


class Translator:
    """Google Translate ajax API implementation class"""

    def __init__(self, service_urls=DEFAULT_CLIENT_SERVICE_URLS, user_agent=DEFAULT_USER_AGENT,
                 raise_exception=DEFAULT_RAISE_EXCEPTION,
                 proxies: typing.Dict[str, httpx.Proxy] = None,
                 timeout: Timeout = None,
                 http2=True,
                 use_fallback=False):

        self.client = httpx.Client(http2=http2)
        if proxies is not None:  # pragma: nocover
            self.client.proxies = proxies

        self.client.headers.update({
            'User-Agent': user_agent,
            
            'Referer': 'https://translate.google.com',
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "Origin": "https://translate.google.com",
            "X-Same-Domain": "1",
            "Host": "translate.google.com",
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9,es-US;q=0.8,es;q=0.7',
            'Priority': 'u=1, i',
        })

        if timeout is not None:
            self.client.timeout = timeout

        if use_fallback:
            self.service_urls = DEFAULT_FALLBACK_SERVICE_URLS
            self.client_type = 'gtx'
            pass
        else:
            #default way of working: use the defined values from user app
            self.service_urls = service_urls
            self.client_type = 'tw-ob'


        self.raise_exception = raise_exception
        self.max_retries = 5  # Increased retries for better reliability
        self.retry_delay = 1.0
        self.backoff_multiplier = 2.0  # Exponential backoff multiplier

    def close(self):
        """Close the client"""
        self.client.close()

    def _build_rpc_request(self, text, dest: str, src: str):
        allItems = []
        for item in text:
            allItems.append(
                [
                    RPC_ID,
                    json.dumps([[item, src, dest, 1], []], separators=(",", ":")),
                    None,
                    "generic"
                ]
            )
        return json.dumps([allItems], separators=(",", ":"))

    def _build_multi_language_rpc_request(self, text, dest_languages: list, src: str):
        """
        Build RPC request for translating text to multiple languages in a single request.
        
        Args:
            text: List of strings to translate
            dest_languages: List of destination language codes
            src: Source language code
            
        Returns:
            JSON string for the RPC request
        """
        allItems = []
        for item in text:
            for dest in dest_languages:
                allItems.append(
                    [
                        RPC_ID,
                        json.dumps([[item, src, dest, 1], []], separators=(",", ":")),
                        None,
                        "generic"
                    ]
                )
        return json.dumps([allItems], separators=(",", ":"))

    def _pick_service_url(self):
        """Randomly select a service URL"""
        if len(self.service_urls) == 1:
            return self.service_urls[0]
        return random.choice(self.service_urls)

    def _translate_with_retry(self, text, dest: str, src: str, is_multi_language=False, dest_languages=None):
        """
        Translate with retry logic for HTTP errors and CAPTCHA detection.
        
        Args:
            text: Text to translate
            dest: Destination language
            src: Source language
            is_multi_language: Whether this is a multi-language request
            dest_languages: List of destination languages for multi-language requests
            
        Returns:
            Tuple of (response_text, response_object, used_url)
        """
        used_urls = []
        
        for attempt in range(self.max_retries + 1):
            # host = self._pick_service_url()  # Not needed for current implementation
            # url = urls.TRANSLATE_RPC.format(host=host)
            url = "https://translate.google.com/_/TranslateWebserverUi/data/batchexecute"
            used_urls.append(url)
            
            try:
                # No token needed
                
                if is_multi_language:
                    data = {
                        "f.req": self._build_multi_language_rpc_request(text, dest_languages, src),
                    }
                else:
                    data = {
                        "f.req": self._build_rpc_request(text, dest, src),
                    }

                params = {
                    "rpcids": RPC_ID,
                    "source-path": "/",
                    "bl": "boq_translate-webserver_20250630.06_p1",
                    "hl": "en",
                    "soc-app": 1,
                    "soc-platform": 1,
                    "soc-device": 1,
                    "rt": "c",
                    # "tk": token,
                }

                # # Calculate Content-Length like curl does
                # encoded_data = urllib.parse.urlencode(data)
                # content_length = len(encoded_data.encode('utf-8'))
                
                # # Add Content-Length header for this specific request
                r = self.client.post(url, params=params, data=data)
                
                # Check for HTTP errors
                if r.status_code == 429:
                    # Check if this is a CAPTCHA response
                    is_captcha = 'recaptcha' in r.text.lower() or 'unusual traffic' in r.text.lower()

                    error_msg = "CAPTCHA detected - Google requires verification" if is_captcha else "Rate limited by Google Translate API"
                    if self.raise_exception:
                        raise Exception(f"{error_msg}. Used URL: {url}")
                    else:
                        return "", r, url
                
                # Check for other HTTP errors
                if r.status_code != 200:
                    if self.raise_exception:
                        raise Exception(f'Unexpected status code "{r.status_code}" from {url}')
                    else:
                        return "", r, url

                if not r.text.strip():
                    if self.raise_exception:
                        raise Exception(f"Empty response from Google Translate API (URL: {url})")
                    else:
                        return "", r, url

                return r.text, r, url

            except Exception as e:
                if attempt < self.max_retries:
                    time.sleep(self.retry_delay)
                    continue
                else:
                    if self.raise_exception:
                        raise e
                    else:
                        return "", None, url
        
        # If we get here, all retries failed
        if self.raise_exception:
            raise Exception(f"All {self.max_retries} retries failed. Used URLs: {used_urls}")
        else:
            return "", None, used_urls[-1] if used_urls else None

    def _translate(self, text, dest: str, src: str):
        """Legacy method for backward compatibility."""
        response_text, response, used_url = self._translate_with_retry(text, dest, src)
        return response_text, response

    def _translate_multi_language(self, text, dest_languages: list, src: str):
        """
        Translate text to multiple languages in a single request.
        
        Args:
            text: List of strings to translate
            dest_languages: List of destination language codes
            src: Source language code
            
        Returns:
            Tuple of (response_text, response_object)
        """
        response_text, response, used_url = self._translate_with_retry(
            text, None, src, is_multi_language=True, dest_languages=dest_languages
        )
        return response_text, response

    def findOuterArray(self, data):
        arrays = []
        token_found = False
        square_bracket_counts = [0, 0]
        resp = ""
        for line in data.split("\n"):
            token_found = token_found or f'"{RPC_ID}"' in line[:30]
            if not token_found:
                continue

            is_in_string = False
            for index, char in enumerate(line):
                if char == '"' and line[max(0, index - 1)] != "\\":
                    is_in_string = not is_in_string
                if not is_in_string:
                    if char == "[":
                        square_bracket_counts[0] += 1
                    elif char == "]":
                        square_bracket_counts[1] += 1

            resp += line
            if square_bracket_counts[0] == square_bracket_counts[1]:
                arrays.append(json.loads(resp))
                token_found = False
                square_bracket_counts = [0, 0]
                resp = ""

        arrays = self.find_arrays_with_wrb_fr(arrays)
        return arrays

    def find_arrays_with_wrb_fr(self, input_array):
        result_arrays = []
        if isinstance(input_array, list):
            if len(input_array) > 0 and input_array[0] == "wrb.fr":
                result_arrays.append(input_array)
            for subarray in input_array:
                result_arrays.extend(self.find_arrays_with_wrb_fr(subarray))
        return result_arrays

    def getKeyValueMaps(self, data):
        arrays = self.findOuterArray(data)
        maps = {}
        for item in arrays:
            workingString = json.loads(item[2])
            
            try:
                original = workingString[0][-1][0]
                
                if (len(workingString[1]) > 0 and 
                    len(workingString[1][0]) > 0 and 
                    len(workingString[1][0][0]) > 5 and
                    workingString[1][0][0][5] is not None and
                    len(workingString[1][0][0][5]) > 0):
                    
                    translation_data = workingString[1][0][0][5][0]
                    translated = translation_data[0]
                    maps[original] = translated
                    
            except Exception:
                continue
                
        return maps

    def getMultiLanguageKeyValueMaps(self, data, text, dest_languages, src):
        """
        Parse multi-language translation response and organize by language.
        
        Args:
            data: Response data from Google Translate
            text: Original text list
            dest_languages: List of destination languages
            src: Source language
            
        Returns:
            Dictionary with language codes as keys and translated text lists as values
        """
        arrays = self.findOuterArray(data)
        # Map: original_text -> {lang: translation}
        translations_map = {txt: {} for txt in text}
        for item in arrays:
            try:
                workingString = json.loads(item[2])
                original = None
                dest_lang = None
                translated = None
                if (
                    len(workingString) > 1 and
                    len(workingString[0]) > 6 and
                    isinstance(workingString[0][6], list) and
                    len(workingString[0][6]) > 0
                ):
                    original = workingString[0][6][0]
                if (
                    len(workingString[1]) > 1
                ):
                    dest_lang = workingString[1][1]
                if (
                    len(workingString[1]) > 0 and
                    len(workingString[1][0]) > 0 and
                    len(workingString[1][0][0]) > 5 and
                    workingString[1][0][0][5] is not None and
                    len(workingString[1][0][0][5]) > 0 and
                    len(workingString[1][0][0][5][0]) > 0
                ):
                    translated = workingString[1][0][0][5][0][0]
                if original and dest_lang and translated and original in translations_map:
                    translations_map[original][dest_lang] = translated
            except Exception:
                continue
        # Fill in missing translations with the original text
        for txt in translations_map:
            for lang in dest_languages:
                if lang not in translations_map[txt]:
                    translations_map[txt][lang] = txt
        return translations_map

    def translate(self, text: list, dest="en", src="auto"):
        if src != "auto" and src not in LANGUAGES:
            if src in SPECIAL_CASES:
                src = SPECIAL_CASES[src]
            elif src in LANGCODES:
                src = LANGCODES[src]
            else:
                raise ValueError("invalid source language")

        if dest not in LANGUAGES:
            if dest in SPECIAL_CASES:
                dest = SPECIAL_CASES[dest]
            elif dest in LANGCODES:
                dest = LANGCODES[dest]
            else:
                raise ValueError("invalid destination language")

        origin = text
        data, response, used_url = self._translate_with_retry(text, dest, src)

        # Check if we got a valid response
        if not data.strip():
            if self.raise_exception:
                raise Exception(f"Failed to get valid response from Google Translate API (URL: {used_url})")
            else:
                # Return original text as fallback
                class NewTranslated:
                    def __init__(self, src, dest, origin, text, response, used_url=None):
                        self.src = src
                        self.dest = dest
                        self.origin = origin
                        self.text = text
                        self.response = response
                        self.used_url = used_url
                
                return NewTranslated(
                    src=src,
                    dest=dest,
                    origin=origin,
                    text=origin,  # Return original text as fallback
                    response=response,
                    used_url=used_url
                )

        results = self.getKeyValueMaps(data)
        translationsArray = []
        for item in text:
            translationsArray.append(results.get(item, item))  # Use original if translation not found

        class NewTranslated:
            def __init__(self, src, dest, origin, text, response, used_url=None):
                self.src = src
                self.dest = dest
                self.origin = origin
                self.text = text
                self.response = response
                self.used_url = used_url

        result = NewTranslated(
            src=src,
            dest=dest,
            origin=origin,
            text=translationsArray,
            response=response,
            used_url=used_url
        )
        return result

    def translate_multi_language(self, text: list, dest_languages: list, src="auto"):
        """
        Translate text to multiple languages in a single request.
        Returns a dict: {original_text: {lang: translation, ...}, ...}
        """
        # Validate source language
        if src != "auto" and src not in LANGUAGES:
            if src in SPECIAL_CASES:
                src = SPECIAL_CASES[src]
            elif src in LANGCODES:
                src = LANGCODES[src]
            else:
                raise ValueError("invalid source language")

        if dest_languages is None:
            dest_languages = [code for code in LANGUAGES.keys() if code != src]
        validated_dest_languages = []
        for dest in dest_languages:
            if dest not in LANGUAGES:
                if dest in SPECIAL_CASES:
                    validated_dest_languages.append(SPECIAL_CASES[dest])
                elif dest in LANGCODES:
                    validated_dest_languages.append(LANGCODES[dest])
                else:
                    raise ValueError(f"invalid destination language: {dest}")
            else:
                validated_dest_languages.append(dest)

        data, response, used_url = self._translate_with_retry(
            text, None, src, is_multi_language=True, dest_languages=validated_dest_languages
        )
        
        # Check if we got a valid response
        if not data.strip():
            if self.raise_exception:
                raise Exception(f"Failed to get valid response from Google Translate API (URL: {used_url})")
            else:
                # Return original text as fallback
                return {txt: {lang: txt for lang in validated_dest_languages} for txt in text}
        
        results = self.getMultiLanguageKeyValueMaps(data, text, validated_dest_languages, src)
        return results
    



def generate_session_token():
    # Generate a secure 28-character token (similar length to example)
    token = secrets.token_urlsafe(21)  # 21 chars gives ~28-char base64 string
    # Calculate timestamp 2 days (in ms) from now
    expires_at = int((time.time() + 2 * 86400) * 1000)
    # Combine token and timestamp
    combined = f"{token}:{expires_at}"
    # URL-encode the value
    encoded = urllib.parse.quote(combined)
    return f"at={encoded}"
