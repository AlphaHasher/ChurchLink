from mongo.database import DB
from models.website_app_config import WebsiteAppConfig
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
            # Create default config instance to get default values
            default_config = WebsiteAppConfig()
            
            # Get website settings from the settings collection with defaults from model
            title = await DB.get_setting("website_title", default_config.title)
            favicon_url = await DB.get_setting("website_favicon_url", default_config.favicon_url)
            meta_description = await DB.get_setting("website_meta_description", default_config.meta_description)
            updated_by = await DB.get_setting("website_updated_by", default_config.updated_by)
            updated_at = await DB.get_setting("website_updated_at", default_config.updated_at)
            
            # Create and return the configuration using the model
            config = WebsiteAppConfig(
                title=title,
                favicon_url=favicon_url,
                meta_description=meta_description,
                updated_by=updated_by,
                updated_at=updated_at,
                created_at=updated_at  # Use same as updated_at for compatibility
            )
            
            return config.dict()
                
        except Exception as e:
            print(f"Error loading website configuration: {e}")
            # Return defaults from model on error
            default_config = WebsiteAppConfig()
            return default_config.dict()
    
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
            # Validate the config data using the model
            config = WebsiteAppConfig(**config_data, updated_by=updated_by)
            
            current_time = datetime.utcnow().isoformat()
            success = True
            
            # Save each setting individually
            success &= await DB.set_setting("website_title", config.title)
            success &= await DB.set_setting("website_favicon_url", config.favicon_url)
            success &= await DB.set_setting("website_meta_description", config.meta_description)
            
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
            # Get current config to merge with updates
            current_config = await WebbuilderConfigHelper.get_website_config()
            
            # Create updated config dict
            updated_config = {**current_config, **updates, "updated_by": updated_by}
            
            # Validate the complete config using the model
            config = WebsiteAppConfig(**updated_config)
            
            current_time = datetime.utcnow().isoformat()
            success = True
            
            # Update only the provided fields
            for key, value in updates.items():
                if key in ["title", "favicon_url", "meta_description"]:
                    setting_key = f"website_{key}"
                    success &= await DB.set_setting(setting_key, getattr(config, key))
            
            # Always update metadata
            success &= await DB.set_setting("website_updated_by", updated_by)
            success &= await DB.set_setting("website_updated_at", current_time)
            
            return success
                
        except Exception as e:
            print(f"Error updating website configuration: {e}")
            return False
