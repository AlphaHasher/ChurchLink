# routes_legal.py (example)
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from models.legal_pages import (
    LegalPageAdminBase, LegalPageAdminOut, LegalPagePublicOut,
    admin_get_page, admin_list_pages, admin_upsert_page, admin_delete_page,
    public_get_page
)

router = APIRouter(prefix="/legal", tags=["legal"])
admin_router = APIRouter(prefix="/admin/legal", tags=["legal-admin"])

# Public
@router.get("/{slug}", response_model=LegalPagePublicOut)
async def get_public_page(slug: str, locale: Optional[str] = None):
    page = await public_get_page(slug, locale)
    if not page:
        raise HTTPException(404, "Not found")
    return page

# Admin

@admin_router.get("", response_model=List[LegalPageAdminOut])
async def list_pages():
    return await admin_list_pages()

@admin_router.get("/{slug}", response_model=LegalPageAdminOut)
async def get_page(slug: str):
    page = await admin_get_page(slug)
    if not page:
        raise HTTPException(404, "Not found")
    return page

@admin_router.put("/{slug}", response_model=LegalPageAdminOut)
async def upsert_page(slug: str, payload: LegalPageAdminBase, user_email: str = "admin@example.com"):
    # replace user_email with your auth dependency
    return await admin_upsert_page(slug, payload, updated_by=user_email)

@admin_router.delete("/{slug}")
async def delete_page(slug: str):
    ok = await admin_delete_page(slug)
    if not ok:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
