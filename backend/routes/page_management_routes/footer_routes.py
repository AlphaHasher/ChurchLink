from typing import Dict, Tuple, Any, List
from fastapi import APIRouter, HTTPException, Body, Path
from pydantic import BaseModel
from models.footer import Footer, FooterItem, FooterSubItem
from models.footer import (
    get_footer,
    get_footer_items,
    change_visibility,
    reorder_items,
    remove_item_by_name,
    add_item,
    get_item_by_title,
    update_item,
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
    ok, msg = _nonempty("title", item.get("title"))
    if not ok:
        return False, {}, msg
    ok, msg = _nonempty("russian_title", item.get("russian_title"))
    if not ok:
        return False, {}, msg

    cleaned = {
        "title": _clean(item["title"]),
        "russian_title": _clean(item["russian_title"]),
        "url": _clean(item.get("url")),
        "visible": bool(item.get("visible", True)),
    }
    return True, cleaned, ""


def validate_footer_section_update(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], str]:
    ok, msg = _nonempty("title", payload.get("title"))
    if not ok:
        return False, {}, msg
    ok, msg = _nonempty("russian_title", payload.get("russian_title"))
    if not ok:
        return False, {}, msg

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
        "title": _clean(payload["title"]),
        "russian_title": _clean(payload["russian_title"]),
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
# layout_management protected routes
# ------------------------

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
