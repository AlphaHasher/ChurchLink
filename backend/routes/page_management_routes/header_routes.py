from typing import Any, Dict, Tuple

from fastapi import APIRouter, Body, HTTPException, Path
from pydantic import BaseModel

from models.header import (
    Header,
    HeaderItem,
    add_dropdown,
    add_link,
    change_visibility,
    get_header,
    get_header_items,
    get_item_by_title,
    remove_item_by_name,
    reorder_items,
    update_item,
)
from models.localization_info import (
    add_locale as add_localization_locale,
    get_locales as get_localization_locales,
)
from urllib.parse import urlparse

public_header_router = APIRouter(prefix="/header", tags=["public header"])
mod_header_router = APIRouter(prefix="/header", tags=["mod header"])


class OpResult(BaseModel):
    success: bool
    msg: str = ""


def _clean(s: Any) -> str:
    return (s or "").strip()


def _nonempty(field: str, value: Any) -> Tuple[bool, str]:
    if _clean(value):
        return True, ""
    return False, f"{field} is required."


def _is_valid_url(url: str) -> Tuple[bool, str]:
    """Validate URL format and auto-add https:// if missing"""
    try:
        # Clean the URL
        url = _clean(url)
        if not url:
            return False, "URL cannot be empty"
        
        # Auto-add https:// if no protocol is present
        if not url.startswith(('http://', 'https://')):
            # Check if it looks like a domain (contains a dot or is localhost)
            if '.' in url or url.startswith('localhost'):
                url = f"https://{url}"
            else:
                return False, "Invalid URL format - must be a valid domain or include protocol"
        
        # Parse the URL
        parsed = urlparse(url)
        
        # Check if scheme is valid
        if parsed.scheme not in ['http', 'https']:
            return False, "URL must use http:// or https:// protocol"
        
        # Check if domain is present
        if not parsed.netloc:
            return False, "URL must include a valid domain"
        
        # Basic domain validation (contains at least one dot or is localhost)
        if '.' not in parsed.netloc and parsed.netloc != 'localhost':
            return False, "URL must include a valid domain"
        
        return True, url  # Return the corrected URL
        
    except Exception:
        return False, "Invalid URL format"


def _nonempty(field: str, value: Any) -> Tuple[bool, str]:
    if _clean(value):
        return True, ""
    return False, f"{field} is required."

def validate_header_link(link: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], str]:
    titles = link.get("titles")
    if not isinstance(titles, dict):
        return False, {}, "titles must be an object with at least an 'en' label"
    titles_en = titles.get("en")
    if not (isinstance(titles_en, str) and titles_en.strip()):
        return False, {}, "titles must be an object with at least an 'en' label"
    
    # Check if this is a hardcoded URL or slug-based URL
    is_hardcoded = link.get("is_hardcoded_url", False)
    
    if is_hardcoded:
        ok, msg = _nonempty("url", link.get("url"))
        if not ok:
            return False, {}, msg
        
        # Validate URL format and get corrected URL
        ok, corrected_url = _is_valid_url(link.get("url"))
        if not ok:
            return False, {}, corrected_url  # corrected_url contains error message when ok=False
        
        cleaned = {
            "titles": {k: _clean(v) for k, v in titles.items()},
            "url": corrected_url,  # Use the corrected URL with https:// added if needed
            "is_hardcoded_url": True,
            "visible": bool(link.get("visible", True)),
            "type": "link",
        }
    else:
        ok, msg = _nonempty("slug", link.get("slug"))
        if not ok:
            return False, {}, msg
        
        cleaned = {
            "titles": {k: _clean(v) for k, v in titles.items()},
            "slug": _clean(link["slug"]),
            "is_hardcoded_url": False,
            "visible": bool(link.get("visible", True)),
            "type": "link",
        }
    
    return True, cleaned, ""


def validate_header_dropdown(dd: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], str]:
    titles = dd.get("titles")
    if not isinstance(titles, dict):
        return False, {}, "titles must be an object with at least an 'en' label"
    titles_en = titles.get("en")
    if not (isinstance(titles_en, str) and titles_en.strip()):
        return False, {}, "titles must be an object with at least an 'en' label"

    items = dd.get("items") or []
    if not isinstance(items, list) or len(items) == 0:
        return False, {}, "Dropdown must contain at least one link."

    cleaned_items = []
    for i, raw in enumerate(items, start=1):
        ok, cl, msg = validate_header_link(raw)
        if not ok:
            return False, {}, f"Dropdown link #{i}: {msg}"
        cleaned_items.append(cl)

    cleaned = {
        "titles": {k: _clean(v) for k, v in titles.items()},
        "items": cleaned_items,
        "visible": bool(dd.get("visible", True)),
        "type": "dropdown",
    }
    return True, cleaned, ""


def validate_header_update_payload(updated_item: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], str]:
    if "items" in updated_item:
        return validate_header_dropdown(updated_item)
    else:
        return validate_header_link(updated_item)


# Public Routes

@public_header_router.get("", response_model=Header)
async def get_header_route():
    header = await get_header()
    if not header:
        raise HTTPException(status_code=404, detail="Header not found and could not create default")
    return header


@public_header_router.get("/items", response_model=Header)
async def get_header_items_route():
    header = await get_header_items()
    if not header:
        raise HTTPException(status_code=404, detail="Header not found and could not create default")
    return header


# web_builder_management perms necessary below

@mod_header_router.get("/locales")
async def get_header_locales_route():
    locales = await get_localization_locales("header")
    return {"locales": locales}


class LocalePayload(BaseModel):
    code: str


@mod_header_router.post("/locales", response_model=OpResult)
async def add_header_locale_route(payload: LocalePayload):
    success = await add_localization_locale("header", payload.code)
    return OpResult(success=success, msg="" if success else "Failed to add locale.")


@mod_header_router.post("/items/links", response_model=OpResult)
async def add_header_link_route(item: dict = Body(...)):
    ok, cleaned, msg = validate_header_link(item)
    if not ok:
        return OpResult(success=False, msg=msg)

    try:
        success = await add_link(cleaned)
        return OpResult(success=bool(success), msg="" if success else "Failed to add link.")
    except Exception:
        return OpResult(success=False, msg="Unexpected error while adding link.")


@mod_header_router.post("/items/dropdowns", response_model=OpResult)
async def add_header_dropdown_route(item: dict = Body(...)):
    ok, cleaned, msg = validate_header_dropdown(item)
    if not ok:
        return OpResult(success=False, msg=msg)

    try:
        success = await add_dropdown(cleaned)
        return OpResult(success=bool(success), msg="" if success else "Failed to add dropdown.")
    except Exception:
        return OpResult(success=False, msg="Unexpected error while adding dropdown.")


@mod_header_router.get("/{title}", response_model=HeaderItem)
async def get_header_item_route(title: str = Path(...)):
    item = await get_item_by_title(title)
    if not item:
        raise HTTPException(status_code=404, detail="Header not found, item not found, or update failed")
    return item


@mod_header_router.put("/items/edit/{title}", response_model=OpResult)
async def update_header_item_route(title: str = Path(...), updated_item: dict = Body(...)):
    ok, cleaned, msg = validate_header_update_payload(updated_item)
    if not ok:
        return OpResult(success=False, msg=msg)

    try:
        success = await update_item(title, cleaned)
        return OpResult(success=bool(success), msg="" if success else "Failed to update item.")
    except Exception:
        return OpResult(success=False, msg="Unexpected error while updating item.")


@mod_header_router.delete("/{title}", response_model=OpResult)
async def remove_header_item_route(title: str = Path(...)):
    try:
        success = await remove_item_by_name(title)
        return OpResult(success=bool(success), msg="" if success else "Failed to delete item.")
    except Exception:
        return OpResult(success=False, msg="Unexpected error while deleting item.")


@mod_header_router.put("/reorder", response_model=OpResult)
async def reorder_header_items_route(titles: dict = Body(...)):
    try:
        success = await reorder_items(titles.get("titles", []))
        return OpResult(success=bool(success), msg="" if success else "Failed to reorder items.")
    except Exception:
        return OpResult(success=False, msg="Unexpected error while reordering.")


@mod_header_router.put("/{title}/visibility", response_model=OpResult)
async def change_header_item_visibility_route(title: str = Path(...), visible: dict = Body(...)):
    try:
        success = await change_visibility(title, bool(visible.get("visible")))
        return OpResult(success=bool(success), msg="" if success else "Failed to change visibility.")
    except Exception:
        return OpResult(success=False, msg="Unexpected error while changing visibility.")
