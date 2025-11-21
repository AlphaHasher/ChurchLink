from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Body, HTTPException, Path
from pydantic import BaseModel

from models.footer import Footer, FooterItem, FooterSubItem
from models.footer import (
    add_item,
    change_visibility,
    get_footer,
    get_footer_items,
    get_item_by_title,
    remove_item_by_name,
    reorder_items,
    update_item,
)
from models.localization_info import (
    add_locale as add_localization_locale,
    get_locales as get_localization_locales,
)

public_footer_router = APIRouter(prefix="/footer", tags=["public footer"])
mod_footer_router = APIRouter(prefix="/footer", tags=["mod footer/editing"])


class OpResult(BaseModel):
    success: bool
    msg: str = ""


def _clean(s: Any) -> str:
    return (s or "").strip()


def _nonempty(field: str, value: Any) -> Tuple[bool, str]:
    if _clean(value):
        return True, ""
    return False, f"{field} is required."


def validate_footer_item(item: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], str]:
    titles = item.get("titles")
    if not isinstance(titles, dict) or not titles.get("en"):
        return False, {}, "titles must be an object with at least an 'en' label"

    cleaned = {
        "titles": {k: _clean(v) for k, v in titles.items()},
        "url": _clean(item.get("url")),
        "slug": _clean(item.get("slug")),
        "is_hardcoded_url": bool(item.get("is_hardcoded_url", False)),
        "visible": bool(item.get("visible", True)),
    }
    return True, cleaned, ""


def validate_footer_section_update(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], str]:
    titles = payload.get("titles")
    if not isinstance(titles, dict) or not titles.get("en"):
        return False, {}, "titles must be an object with at least an 'en' label"

    items = payload.get("items") or []
    if not isinstance(items, list):
        return False, {}, "Items must be a list."

    cleaned_items: List[Dict[str, Any]] = []
    for i, raw in enumerate(items, start=1):
        ok, cl, msg = validate_footer_item(raw)
        if not ok:
            return False, {}, f"Item #{i}: {msg}"
        cleaned_items.append(cl)

    cleaned = {
        "titles": {k: _clean(v) for k, v in titles.items()},
        "items": cleaned_items,  # keep as dicts for DB
        "visible": bool(payload.get("visible", True)),
    }
    return True, cleaned, ""


# ------------------------
# Public routes
# ------------------------

@public_footer_router.get("", response_model=Footer)
async def get_footer_route():
    footer = await get_footer()
    if not footer:
        raise HTTPException(status_code=404, detail="Footer not found and could not create default")
    return footer


@public_footer_router.get("/items", response_model=Footer)
async def get_footer_items_route():
    footer = await get_footer_items()
    if not footer:
        raise HTTPException(status_code=404, detail="Footer not found and could not create default")
    return footer


# ------------------------
# web_builder_management protected routes
# ------------------------

@mod_footer_router.get("/locales")
async def get_footer_locales_route():
    locales = await get_localization_locales("footer")
    return {"locales": locales}


class LocalePayload(BaseModel):
    code: str


@mod_footer_router.post("/locales", response_model=OpResult)
async def add_footer_locale_route(payload: LocalePayload):
    success = await add_localization_locale("footer", payload.code)
    return OpResult(success=success, msg="" if success else "Failed to add locale.")


@mod_footer_router.put("/{title}/visibility", response_model=OpResult)
async def change_footer_item_visibility_route(title: str = Path(...), visible: dict = Body(...)):
    try:
        success = await change_visibility(title, bool(visible.get("visible")))
        return OpResult(success=bool(success), msg="" if success else "Failed to change visibility.")
    except Exception:
        return OpResult(success=False, msg="Unexpected error while changing visibility.")


@mod_footer_router.put("/reorder", response_model=OpResult)
async def reorder_footer_items_route(titles: dict = Body(...)):
    try:
        success = await reorder_items(titles.get("titles", []))
        return OpResult(success=bool(success), msg="" if success else "Failed to reorder items.")
    except Exception:
        return OpResult(success=False, msg="Unexpected error while reordering.")


@mod_footer_router.delete("/{title}", response_model=OpResult)
async def remove_footer_item_route(title: str = Path(...)):
    try:
        success = await remove_item_by_name(title)
        return OpResult(success=bool(success), msg="" if success else "Failed to delete section.")
    except Exception:
        return OpResult(success=False, msg="Unexpected error while deleting section.")


@mod_footer_router.post("/items", response_model=OpResult)
async def add_footer_item_route(item: FooterItem = Body(...)):
    ok, cleaned, msg = validate_footer_section_update(item.dict())
    if not ok:
        return OpResult(success=False, msg=msg)
    try:
        # Convert dicts into FooterSubItem models before calling add_item
        cleaned["items"] = [FooterSubItem(**sub) for sub in cleaned["items"]]
        success = await add_item(cleaned)
        return OpResult(success=bool(success), msg="" if success else "Failed to add section.")
    except Exception as e:
        print(f"Error adding footer section: {e}")
        return OpResult(success=False, msg="Unexpected error while adding section.")


@mod_footer_router.get("/{title}", response_model=FooterItem)
async def get_footer_item_route(title: str = Path(...)):
    item = await get_item_by_title(title)
    if not item:
        raise HTTPException(status_code=404, detail="Footer not found, item not found, or update failed")
    return item


@mod_footer_router.put("/items/edit/{title}", response_model=OpResult)
async def update_footer_item_route(title: str = Path(...), updated_item: dict = Body(...)):
    ok, cleaned, msg = validate_footer_section_update(updated_item)
    if not ok:
        return OpResult(success=False, msg=msg)
    try:
        # keep cleaned["items"] as dicts so Mongo can update safely
        success = await update_item(title, cleaned)
        return OpResult(success=bool(success), msg="" if success else "Failed to update section.")
    except Exception as e:
        print(f"Error updating footer section: {e}")
        return OpResult(success=False, msg="Unexpected error while updating section.")
