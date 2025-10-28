from __future__ import annotations

from typing import Any, Dict
from datetime import datetime

from mongo.database import DB
from models.localization_info import add_locale as add_localization_locale


async def _migrate_header_items() -> None:
    coll = DB.db["header-items"]
    cursor = coll.find({})
    discovered_locales = set()
    async for doc in cursor:
        _id = doc.get("_id")
        if not _id:
            continue

        titles: Dict[str, str] = dict(doc.get("titles") or {})
        en = str(doc.get("title") or "")
        ru = doc.get("russian_title")
        if en and not titles.get("en"):
            titles["en"] = en
        if isinstance(ru, str) and ru and not titles.get("ru"):
            titles["ru"] = ru
            discovered_locales.add("ru")

        items = doc.get("items") or []
        new_items = []
        changed_items = False
        for it in items:
            it_titles: Dict[str, str] = dict((it or {}).get("titles") or {})
            ien = str((it or {}).get("title") or "")
            iru = (it or {}).get("russian_title")
            if ien and not it_titles.get("en"):
                it_titles["en"] = ien
            if isinstance(iru, str) and iru and not it_titles.get("ru"):
                it_titles["ru"] = iru
            if it_titles or ("russian_title" in (it or {})):
                changed_items = True
            new_it = dict(it or {})
            if it_titles:
                new_it["titles"] = it_titles
            if "russian_title" in new_it:
                del new_it["russian_title"]
            new_items.append(new_it)

        update: Dict[str, Any] = {"$set": {"titles": titles, "updated_at": datetime.utcnow()}}
        unset: Dict[str, int] = {}
        if "russian_title" in doc:
            unset["russian_title"] = 1
        if changed_items:
            update["$set"]["items"] = new_items
        if unset:
            update["$unset"] = unset

        await coll.update_one({"_id": _id}, update)

    for locale in discovered_locales:
        try:
            await add_localization_locale("header", locale)
        except Exception:
            continue


async def _migrate_footer_items() -> None:
    coll = DB.db["footer-items"]
    cursor = coll.find({})
    discovered_locales = set()
    async for doc in cursor:
        _id = doc.get("_id")
        if not _id:
            continue

        titles: Dict[str, str] = dict(doc.get("titles") or {})
        en = str(doc.get("title") or "")
        ru = doc.get("russian_title")
        if en and not titles.get("en"):
            titles["en"] = en
        if isinstance(ru, str) and ru and not titles.get("ru"):
            titles["ru"] = ru
            discovered_locales.add("ru")

        items = doc.get("items") or []
        new_items = []
        changed_items = False
        for it in items:
            it_titles: Dict[str, str] = dict((it or {}).get("titles") or {})
            ien = str((it or {}).get("title") or "")
            iru = (it or {}).get("russian_title")
            if ien and not it_titles.get("en"):
                it_titles["en"] = ien
            if isinstance(iru, str) and iru and not it_titles.get("ru"):
                it_titles["ru"] = iru
            if it_titles or ("russian_title" in (it or {})):
                changed_items = True
            new_it = dict(it or {})
            if it_titles:
                new_it["titles"] = it_titles
            if "russian_title" in new_it:
                del new_it["russian_title"]
            new_items.append(new_it)

        update: Dict[str, Any] = {"$set": {"titles": titles, "updated_at": datetime.utcnow()}}
        unset: Dict[str, int] = {}
        if "russian_title" in doc:
            unset["russian_title"] = 1
        if changed_items:
            update["$set"]["items"] = new_items
        if unset:
            update["$unset"] = unset

        await coll.update_one({"_id": _id}, update)

    for locale in discovered_locales:
        try:
            await add_localization_locale("footer", locale)
        except Exception:
            continue


async def run_header_footer_titles_migration() -> None:
    try:
        await _migrate_header_items()
    except Exception:
        # Do not block startup
        pass
    try:
        await _migrate_footer_items()
    except Exception:
        pass


