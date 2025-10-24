# helpers/DashboardAppConfigHelper.py

from mongo.database import DB
from models.dashboard_app_config import DashboardAppConfig
from datetime import datetime
from typing import List, Dict, Any, Optional

class DashboardAppConfigHelper:
    """Helper class for dashboard app configuration CRUD"""

    collection = DB.db.app_config 

    @staticmethod
    async def get_config() -> Optional[Dict[str, Any]]:
        """Fetch the dashboard configuration from shared app_config collection"""
        return await DashboardAppConfigHelper.collection.find_one({"config_type": "dashboard_pages"})

    @staticmethod
    async def get_page_by_index(index: int) -> Optional[Dict[str, Any]]:
        """Retrieve a single dashboard page by its index"""
        config = await DashboardAppConfigHelper.get_config()
        if config:
            return next((p for p in config.get("pages", []) if p["index"] == index), None)
        return None

    @staticmethod
    async def save_config(pages: List[Dict[str, Any]], updated_by: Optional[str] = None) -> bool:
        """Upsert the dashboard configuration document"""
        now = datetime.utcnow()

        # Ensure ordered indices
        for i, page in enumerate(pages):
            page["index"] = i

        doc = {
            "config_type": "dashboard_pages",
            "version": "1.0",
            "pages": pages,
            "updated_on": now,
            "updated_by": updated_by,
        }

        result = await DashboardAppConfigHelper.collection.update_one(
            {"config_type": "dashboard_pages"},
            {"$set": doc, "$setOnInsert": {"created_on": now}},
            upsert=True,
        )

        return result.acknowledged

    @staticmethod
    async def update_page(index: int, updates: Dict[str, Any], updated_by: Optional[str] = None) -> bool:
        """Update an existing page by index"""
        config = await DashboardAppConfigHelper.get_config()
        if not config:
            return False

        pages = config.get("pages", [])
        for i, page in enumerate(pages):
            if page["index"] == index:
                pages[i] = {**page, **updates}
                return await DashboardAppConfigHelper.save_config(pages, updated_by)
        return False

    @staticmethod
    async def delete_page(index: int, updated_by: Optional[str] = None) -> bool:
        """Delete a page by index"""
        config = await DashboardAppConfigHelper.get_config()
        if not config:
            return False
        pages = [p for p in config.get("pages", []) if p["index"] != index]
        return await DashboardAppConfigHelper.save_config(pages, updated_by)
