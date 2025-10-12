from fastapi import APIRouter, HTTPException, Request, status

from typing import List

from models.form import (
    FormOut,
    add_response_by_slug,
    get_form_by_slug,
    check_form_slug_status,
    list_visible_forms,
)


public_forms_router = APIRouter(prefix="/forms", tags=["Forms"])


@public_forms_router.get("/slug/{slug}", response_model=FormOut)
async def get_form_by_slug_route(slug: str) -> FormOut:
    status_str, doc = await check_form_slug_status(slug)
    if status_str == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if status_str == "not_visible":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not available")
    if status_str == "expired":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form expired")

    # If ok, fetch the full form view (this will apply the same visible/expiry filters)
    form = await get_form_by_slug(slug)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return form


@public_forms_router.post("/slug/{slug}/responses")
async def submit_response_by_slug(slug: str, request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    uid = getattr(request.state, "uid", None)
    ok, info = await add_response_by_slug(slug, payload, user_id=uid)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=info or "Failed to store response")
    return {"message": "Response recorded", "response_id": info}


@public_forms_router.get("/public", response_model=List[FormOut])
async def list_public_visible_forms(skip: int = 0, limit: int = 100) -> List[FormOut]:
    """Return public forms which are visible and not expired, using server time for expiry checks."""
    forms = await list_visible_forms(skip=skip, limit=limit)
    return forms
