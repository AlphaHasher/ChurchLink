"""
App Configuration MongoDB Helper
Handles saving and retrieving app configuration from MongoDB
"""

from mongo.database import DB
from models.app_config import AppConfig, AppTab
from typing import List, Dict, Any, Optional
from datetime import datetime

class AppConfigHelper:
    """Helper class for app configuration operations"""
    
    @staticmethod
    async def get_tab_configuration() -> List[Dict[str, Any]]:
        """
        Get the current tab configuration from MongoDB.
        Falls back to default tabs if none exist.
        
        Returns:
            List of tab configurations
        """
        # Default tabs as fallback
        default_tabs = [
            {"index": 0, "name": "home", "displayName": "Home", "icon": "home", "enabled": True},
            {"index": 1, "name": "bible", "displayName": "Bible", "icon": "bible", "enabled": True}, 
            {"index": 2, "name": "sermons", "displayName": "Sermons", "icon": "church", "enabled": True},
            {"index": 3, "name": "events", "displayName": "Events", "icon": "event", "enabled": True},
            {"index": 4, "name": "profile", "displayName": "Profile", "icon": "person", "enabled": True}
        ]
        
        try:
            # Try to get from database
            collection = DB.db.app_config
            
            config = await collection.find_one({"config_type": "tabs"})
            
            if config and config.get("tabs"):
                # Return tabs from database, sorted by index
                tabs = sorted(config["tabs"], key=lambda x: x.get("index", 0))
                return tabs
            else:
                # No config found, create default and return it
                await AppConfigHelper.save_tab_configuration(default_tabs)
                return default_tabs
                
        except Exception as e:
            # Error loading configuration, return defaults
            return default_tabs
    
    @staticmethod
    async def save_tab_configuration(tabs: List[Dict[str, Any]], updated_by: Optional[str] = None) -> bool:
        """
        Save tab configuration to MongoDB.
        
        Args:
            tabs: List of tab configurations
            updated_by: User who is updating the configuration
            
        Returns:
            True if saved successfully, False otherwise
        """
        try:
            # Validate maximum tab limit (Flutter BottomNavigationBar constraint)
            if len(tabs) > 5:
                raise ValueError(f"Maximum 5 tabs allowed due to Flutter BottomNavigationBar limitations. Got {len(tabs)} tabs.")
            
            collection = DB.db.app_config
            
            # Validate tabs
            for tab in tabs:
                if not all(key in tab for key in ["index", "name", "displayName"]):
                    raise ValueError(f"Invalid tab configuration: {tab}")
            
            # Ensure Home tab is present and at index 0
            home_tab = next((tab for tab in tabs if tab.get("name", "").lower() == "home"), None)
            if not home_tab:
                tabs.insert(0, {"index": 0, "name": "home", "displayName": "Home", "icon": "home"})
            elif home_tab.get("index") != 0:
                # Remove home tab from current position
                tabs = [tab for tab in tabs if tab.get("name", "").lower() != "home"]
                home_tab["index"] = 0
                tabs.insert(0, home_tab)
            
            # Reindex all tabs to ensure proper sequence
            for i, tab in enumerate(tabs):
                tab["index"] = i
            
            # Create configuration document
            config_doc = {
                "config_type": "tabs",
                "version": "1.0",
                "tabs": tabs,
                "updated_at": datetime.utcnow(),
                "updated_by": updated_by
            }
            
            # Upsert (update if exists, insert if not)
            result = await collection.update_one(
                {"config_type": "tabs"},
                {"$set": config_doc, "$setOnInsert": {"created_at": datetime.utcnow()}},
                upsert=True
            )
            
            return True
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return False
    
    @staticmethod
    async def get_tab_by_index(index: int) -> Optional[Dict[str, Any]]:
        """Get a specific tab by its index"""
        tabs = await AppConfigHelper.get_tab_configuration()
        return next((tab for tab in tabs if tab.get("index") == index), None)
    
    @staticmethod
    async def get_tab_by_name(name: str) -> Optional[Dict[str, Any]]:
        """Get a specific tab by its name"""
        tabs = await AppConfigHelper.get_tab_configuration()
        return next((tab for tab in tabs if tab.get("name", "").lower() == name.lower()), None)
    
    @staticmethod
    async def add_tab(tab: Dict[str, Any], updated_by: Optional[str] = None) -> bool:
        """Add a new tab to the configuration"""
        tabs = await AppConfigHelper.get_tab_configuration()
        
        # Check if tab with same index or name already exists
        existing_index = next((t for t in tabs if t.get("index") == tab.get("index")), None)
        existing_name = next((t for t in tabs if t.get("name") == tab.get("name")), None)
        
        if existing_index or existing_name:
            return False  # Tab already exists
        
        tabs.append(tab)
        return await AppConfigHelper.save_tab_configuration(tabs, updated_by)
    
    @staticmethod
    async def update_tab(index: int, updates: Dict[str, Any], updated_by: Optional[str] = None) -> bool:
        """Update an existing tab"""
        tabs = await AppConfigHelper.get_tab_configuration()
        
        for i, tab in enumerate(tabs):
            if tab.get("index") == index:
                tabs[i] = {**tab, **updates}
                return await AppConfigHelper.save_tab_configuration(tabs, updated_by)
        
        return False  # Tab not found
    
    @staticmethod
    async def delete_tab(index: int, updated_by: Optional[str] = None) -> bool:
        """Delete a tab by index"""
        tabs = await AppConfigHelper.get_tab_configuration()
        
        original_length = len(tabs)
        tabs = [tab for tab in tabs if tab.get("index") != index]
        
        if len(tabs) < original_length:
            return await AppConfigHelper.save_tab_configuration(tabs, updated_by)
        
        return False  # Tab not found