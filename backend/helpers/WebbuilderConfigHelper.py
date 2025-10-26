from mongo.database import DB
from typing import Optional, Dict, Any
from datetime import datetime

class WebbuilderConfigHelper:
    """Helper class for web builder configuration operations using settings collection"""
    
    @staticmethod
    async def get_website_config() -> Dict[str, Any]:
        """
        Get the current website configuration from MongoDB settings.
        Returns default config if none exists.
        
        Returns:
            Website configuration dict
        """
        try:
            # Get website settings from the settings collection
            title = await DB.get_setting("website_title", "ChurchLink")
            favicon_url = await DB.get_setting("website_favicon_url", "/dove-favicon.svg")
            meta_description = await DB.get_setting("website_meta_description", None)
            updated_by = await DB.get_setting("website_updated_by", "system")
            updated_at = await DB.get_setting("website_updated_at", datetime.utcnow().isoformat())
            
            return {
                "title": title,
                "favicon_url": favicon_url,
                "meta_description": meta_description,
                "updated_by": updated_by,
                "updated_at": updated_at,
                "created_at": updated_at,  # Use same as updated_at for compatibility
                "id": "website_config"  # Static ID for compatibility
            }
                
        except Exception as e:
            print(f"Error loading website configuration: {e}")
            # Return defaults on error
            return {
                "title": "ChurchLink",
                "favicon_url": "/dove-favicon.svg",
                "meta_description": None,
                "updated_by": "system",
                "updated_at": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat(),
                "id": "website_config"
            }
    
    @staticmethod
    async def save_website_config(config_data: Dict[str, Any], updated_by: str = "admin") -> bool:
        """
        Save website configuration to MongoDB settings collection.
        
        Args:
            config_data: Configuration data to save
            updated_by: User who updated the config
            
        Returns:
            True if successful, False otherwise
        """
        try:
            current_time = datetime.utcnow().isoformat()
            success = True
            
            # Save each setting individually
            if "title" in config_data:
                success &= await DB.set_setting("website_title", config_data["title"])
            
            if "favicon_url" in config_data:
                success &= await DB.set_setting("website_favicon_url", config_data["favicon_url"])
            
            if "meta_description" in config_data:
                success &= await DB.set_setting("website_meta_description", config_data["meta_description"])
            
            # Always update metadata
            success &= await DB.set_setting("website_updated_by", updated_by)
            success &= await DB.set_setting("website_updated_at", current_time)
            
            return success
                
        except Exception as e:
            print(f"Error saving website configuration: {e}")
            return False
    
    @staticmethod
    async def update_website_config(updates: Dict[str, Any], updated_by: str = "admin") -> bool:
        """
        Update specific fields in website configuration.
        
        Args:
            updates: Fields to update
            updated_by: User who updated the config
            
        Returns:
            True if successful, False otherwise
        """
        try:
            current_time = datetime.utcnow().isoformat()
            success = True
            
            # Update only the provided fields
            for key, value in updates.items():
                if key in ["title", "favicon_url", "meta_description"]:
                    setting_key = f"website_{key}"
                    success &= await DB.set_setting(setting_key, value)
            
            # Always update metadata
            success &= await DB.set_setting("website_updated_by", updated_by)
            success &= await DB.set_setting("website_updated_at", current_time)
            
            return success
                
        except Exception as e:
            print(f"Error updating website configuration: {e}")
            return False
