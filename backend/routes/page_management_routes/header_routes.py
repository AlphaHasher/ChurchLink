from typing import Dict, Tuple, Any
from fastapi import APIRouter, HTTPException, Body, Path
from pydantic import BaseModel
from models.header import *

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

def validate_header_link(link: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], str]:
    ok, msg = _nonempty("title", link.get("title"))
    if not ok:
        return False, {}, msg
    ok, msg = _nonempty("russian_title", link.get("russian_title"))
    if not ok:
        return False, {}, msg
    ok, msg = _nonempty("url", link.get("url"))
    if not ok:
        return False, {}, msg

    cleaned = {
        "title": _clean(link["title"]),
        "russian_title": _clean(link["russian_title"]),
        "url": _clean(link["url"]),
        "visible": bool(link.get("visible", True)),
        "type": "link",
    }
    return True, cleaned, ""


def validate_header_dropdown(dd: Dict[str, Any]) -> Tuple[bool, Dict[str, Any], str]:
    ok, msg = _nonempty("title", dd.get("title"))
    if not ok:
        return False, {}, msg
    ok, msg = _nonempty("russian_title", dd.get("russian_title"))
    if not ok:
        return False, {}, msg

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
        "title": _clean(dd["title"]),
        "russian_title": _clean(dd["russian_title"]),
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


# layout_management perms necessary below

@mod_header_router.post("/items/links", response_model=OpResult)
async def add_header_link_route(item: HeaderLink = Body(...)):
    ok, cleaned, msg = validate_header_link(dict(item))
    if not ok:
        return OpResult(success=False, msg=msg)

    try:
        success = await add_link(cleaned)
        return OpResult(success=bool(success), msg="" if success else "Failed to add link.")
    except Exception:
        return OpResult(success=False, msg="Unexpected error while adding link.")


@mod_header_router.post("/items/dropdowns", response_model=OpResult)
async def add_header_dropdown_route(item: HeaderDropdown = Body(...)):
    ok, cleaned, msg = validate_header_dropdown(dict(item))
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
