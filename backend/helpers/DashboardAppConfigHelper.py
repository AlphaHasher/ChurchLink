# helpers/DashboardAppConfigHelper.py

from mongo.database import DB
from models.dashboard_app_config import DashboardAppConfig
from datetime import datetime
from typing import List, Dict, Any, Optional

from bson import ObjectId
from models.image_data import get_image_data 

class DashboardAppConfigHelper:
    """Helper class for dashboard app configuration CRUD"""

    @staticmethod
    def _get_collection():
        if not getattr(DB, "db", None):
            raise RuntimeError("Database not initialized. Call DB.connect() first.")
        return DB.db.app_config  # Shared collection

    @staticmethod
    async def _validate_image_ids(pages: List[Dict[str, Any]]) -> None:
        """Ensure all provided image_ids exist in the image_data collection."""
        for page in pages:
            image_id = page.get("image_id")
            if image_id:
                try:
                    # Check if valid ObjectId format
                    ObjectId(image_id)
                except Exception:
                    raise ValueError(f"Invalid image_id format: {image_id}")
                
                image_doc = await get_image_data(image_id)
                if not image_doc:
                    raise ValueError(f"image_id {image_id} does not exist in image_data collection")

    @staticmethod
    async def get_config() -> Optional[Dict[str, Any]]:
        return await DashboardAppConfigHelper.collection.find_one({"config_type": "dashboard_pages"})

    @staticmethod
    async def get_page_by_index(index: int) -> Optional[Dict[str, Any]]:
        config = await DashboardAppConfigHelper.get_config()
        if config:
            return next((p for p in config.get("pages", []) if p["index"] == index), None)
        return None

    @staticmethod
    async def save_config(pages: List[Dict[str, Any]], updated_by: Optional[str] = None) -> bool:
        """Upsert the dashboard configuration document with image_id validation"""
        now = datetime.utcnow()

        # Validate image_id references
        await DashboardAppConfigHelper._validate_image_ids(pages)

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
        """Update an existing page, validating image_id if present."""
        config = await DashboardAppConfigHelper.get_config()
        if not config:
            return False

        pages = config.get("pages", [])

        for i, page in enumerate(pages):
            if page["index"] == index:
                updated_page = {**page, **updates}

                # Validate new image_id, if one is provided
                if "image_id" in updates:
                    await DashboardAppConfigHelper._validate_image_ids([updated_page])

                pages[i] = updated_page
                return await DashboardAppConfigHelper.save_config(pages, updated_by)
        return False

    @staticmethod
    async def delete_page(index: int, updated_by: Optional[str] = None) -> bool:
        config = await DashboardAppConfigHelper.get_config()
        if not config:
            return False
        pages = [p for p in config.get("pages", []) if p["index"] != index]
        return await DashboardAppConfigHelper.save_config(pages, updated_by)
