from __future__ import annotations
from typing import Optional, Dict, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field, ConfigDict
from mongo.database import DB 


# ---------------------------
# Pydantic models (admin + public)
# ---------------------------

class LegalPageAdminBase(BaseModel):
    """
    Admin-editable shape. Canonical content is markdown per locale.
    If you don't localize yet, just store: {"en": "..."}.
    """
    title: str
    content_by_locale: Dict[str, str] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class LegalPageAdminOut(LegalPageAdminBase):
    """
    Full shape for admin UI reads.
    """
    id: str
    slug: str
    updated_at: datetime
    updated_by: Optional[str] = None


class LegalPagePublicOut(BaseModel):
    """
    Public read shape (used by React site & Flutter app).
    Markdown only; clients render as needed.
    """
    slug: str
    title: str
    locale: str
    content_markdown: str
    updated_at: datetime


# ---------------------------
# Helpers
# ---------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _choose_locale(available: List[str], requested: Optional[str]) -> str:
    """
    Simple locale negotiation:
    - if requested is present, use it
    - else prefer 'en' if available
    - else first available (or 'en' if none exist)
    """
    if requested and requested in available:
        return requested
    if "en" in available:
        return "en"
    return available[0] if available else "en"


# ---------------------------
# Collection handles
# ---------------------------

COL = lambda: DB.db["legal_pages"]
SNAP_COL = lambda: DB.db["legal_page_snapshots"]  # minimal safety net (optional)


# ---------------------------
# Setup & seed
# ---------------------------

async def ensure_indexes():
    """Call once at startup to guarantee unique slugs."""
    await COL().create_index("slug", unique=True)


async def seed_initial_pages():
    """
    Idempotent seed: create 'terms', 'privacy', 'refunds' if missing.
    Stores simple Markdown in English; expand locales later as needed.
    """
    default_pages = [
        ("terms", "Terms & Conditions"),
        ("privacy", "Privacy Policy"),
        ("refunds", "Refund Policy"),
    ]
    for slug, title in default_pages:
        exists = await COL().find_one({"slug": slug})
        if not exists:
            await COL().insert_one({
                "slug": slug,
                "title": title,
                "content_by_locale": {"en": f"# {title}\n\n(Replace this with your content.)"},
                "updated_at": _now(),
                "updated_by": None,
            })


# ---------------------------
# Admin operations
# ---------------------------

async def admin_get_page(slug: str) -> Optional[LegalPageAdminOut]:
    doc = await COL().find_one({"slug": slug})
    if not doc:
        return None
    return LegalPageAdminOut(
        id=str(doc["_id"]),
        slug=doc["slug"],
        title=doc.get("title", slug.title()),
        content_by_locale=doc.get("content_by_locale", {}),
        updated_at=doc.get("updated_at", _now()),
        updated_by=doc.get("updated_by"),
    )


async def admin_list_pages() -> List[LegalPageAdminOut]:
    cursor = COL().find().sort("slug", 1)
    docs = await cursor.to_list(length=100)
    outs: List[LegalPageAdminOut] = []
    for d in docs:
        outs.append(
            LegalPageAdminOut(
                id=str(d["_id"]),
                slug=d["slug"],
                title=d.get("title", d["slug"].title()),
                content_by_locale=d.get("content_by_locale", {}),
                updated_at=d.get("updated_at", _now()),
                updated_by=d.get("updated_by"),
            )
        )
    return outs


async def admin_upsert_page(slug: str, payload: LegalPageAdminBase, updated_by: Optional[str]) -> LegalPageAdminOut:
    """
    Replace current content (simple CMS style).
    Writes a minimal snapshot before overwriting (optional but handy).
    """
    prev = await COL().find_one({"slug": slug})
    if prev:
        await SNAP_COL().insert_one({
            "page_slug": slug,
            "title": prev.get("title"),
            "content_by_locale": prev.get("content_by_locale", {}),
            "updated_at": prev.get("updated_at"),
            "updated_by": prev.get("updated_by"),
            "snapshotted_at": _now(),
        })

    await COL().update_one(
        {"slug": slug},
        {
            "$set": {
                "slug": slug,
                "title": payload.title,
                "content_by_locale": payload.content_by_locale,
                "updated_at": _now(),
                "updated_by": updated_by,
            }
        },
        upsert=True,
    )

    out = await admin_get_page(slug)
    assert out is not None
    return out


async def admin_delete_page(slug: str) -> bool:
    result = await COL().delete_one({"slug": slug})
    return result.deleted_count > 0


# ---------------------------
# Public read
# ---------------------------

async def public_get_page(slug: str, locale: Optional[str] = None) -> Optional[LegalPagePublicOut]:
    doc = await COL().find_one({"slug": slug})
    if not doc:
        return None

    content_map: Dict[str, str] = doc.get("content_by_locale", {}) or {}
    chosen = _choose_locale(list(content_map.keys()), locale)
    md_txt = content_map.get(chosen, "")

    return LegalPagePublicOut(
        slug=slug,
        title=doc.get("title", slug.title()),
        locale=chosen,
        content_markdown=md_txt,
        updated_at=doc.get("updated_at", _now()),
    )

