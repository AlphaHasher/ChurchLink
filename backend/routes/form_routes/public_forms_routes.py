from fastapi import APIRouter, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from helpers.Firebase_helpers import authenticate_uid
import os

from typing import List

from models.form import (
    FormOut,
    add_response_by_slug,
    get_form_by_slug,
    check_form_slug_status,
    list_visible_forms,
)

# Check if E2E test mode is enabled
E2E_TEST_MODE = os.getenv("E2E_TEST_MODE", "").lower() == "true"

public_forms_router = APIRouter(prefix="/forms", tags=["Forms"])

@public_forms_router.get("/slug/{slug}", response_model=FormOut)
async def get_form_by_slug_route(slug: str, request: Request) -> FormOut:
    # In E2E test mode, skip authentication entirely
    if not E2E_TEST_MODE:
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Authorization header")
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=parts[1])
        await authenticate_uid(creds)

    status_str, doc = await check_form_slug_status(slug)
    if status_str == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if status_str == "not_visible":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not available")
    if status_str == "expired":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form expired")

    form = await get_form_by_slug(slug)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return form


@public_forms_router.get("/public", response_model=List[FormOut])
async def list_public_visible_forms(request: Request, skip: int = 0, limit: int = 100) -> List[FormOut]:
    """Return public forms which are visible and not expired, using server time for expiry checks."""
    # In E2E test mode, skip authentication entirely
    if not E2E_TEST_MODE:
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Authorization header")
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=parts[1])
        await authenticate_uid(creds)
    
    forms = await list_visible_forms(skip=skip, limit=limit)
    return forms
