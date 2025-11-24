"""
Website Application Configuration Model

This model defines the structure and validation for website configuration
including title, favicon, and meta description that can be managed through
the website builder interface.
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import re


def _validate_asset_url(url: str) -> bool:
    """
    Shared helper function to validate asset URL format.
    
    Validates URLs in the format:
    - /api/v1/assets/public/id/{24-char-hex-objectid}
    - /api/v1/assets/{path}.{ico|png|svg}
    
    Args:
        url: The URL to validate
        
    Returns:
        bool: True if valid asset URL format, False otherwise
    """
    # First check for path traversal sequences
    if '..' in url:
        return False
    
    # Check for ObjectId format: /api/v1/assets/public/id/{24-char-hex}
    objectid_pattern = r'^/api/v1/assets/public/id/[a-f0-9]{24}$'
    if re.match(objectid_pattern, url):
        return True
    
    # Check for file asset format: /api/v1/assets/{safe-path}.{ico|png|svg}
    # Extract the path after /api/v1/assets/
    if not url.startswith('/api/v1/assets/'):
        return False
    
    asset_path = url[15:]  # Remove '/api/v1/assets/' prefix
    
    # Check file extension
    if not asset_path.lower().endswith(('.ico', '.png', '.svg')):
        return False
    
    # Split path into segments and validate each one
    # Remove the file extension for segment validation
    path_without_ext = asset_path.rsplit('.', 1)[0]
    segments = path_without_ext.split('/')
    
    # Validate each segment
    for segment in segments:
        if not segment:  # Empty segment (double slash)
            return False
        if segment == '.' or segment == '..':  # Current or parent directory
            return False
        # Allow only alphanumeric, underscore, and dash in segments
        if not re.match(r'^[a-zA-Z0-9_\-]+$', segment):
            return False
    
    return True


class WebsiteAppConfig(BaseModel):
    """
    Website Application Configuration Model
    
    Manages configurable website settings that admins can update through
    the web builder interface.
    """
    
    model_config = ConfigDict(
        validate_assignment=True,
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "title": "Your Church Website",
                "favicon_url": "/church-favicon.ico",
                "meta_description": "Welcome to our church - A place of worship, fellowship, and spiritual growth.",
                "updated_by": "admin",
                "updated_at": "2024-01-01T12:00:00.000Z",
                "created_at": "2024-01-01T12:00:00.000Z",
                "id": "website_config"
            }
        }
    )
    
    # Core configuration fields
    title: str = Field(
        default="Your Church Website",
        min_length=1,
        max_length=60,
        description="Website title that appears in browser tabs and search results"
    )
    
    favicon_url: str = Field(
        default="/dove-favicon.svg",
        description="URL path to the website favicon (ICO, PNG, or SVG)"
    )
    
    favicon_asset_id: Optional[str] = Field(
        default=None,
        description="Media asset ID for favicon (when using media upload system)"
    )
    
    meta_description: Optional[str] = Field(
        default=None,
        max_length=160,
        description="Meta description for SEO (optional, max 160 characters)"
    )

    og_image: Optional[str] = Field(
        default=None,
        description="URL to Open Graph image for social media previews (recommended: 1200x630px)"
    )

    # Metadata fields
    updated_by: str = Field(
        default="system",
        description="User who last updated this configuration"
    )
    
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        description="ISO timestamp of last update"
    )
    
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        description="ISO timestamp of creation"
    )
    
    # Static ID for compatibility with existing frontend
    id: str = Field(
        default="website_config",
        description="Static identifier for the website configuration"
    )

    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        """Validate title is not empty after stripping whitespace"""
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()

    @field_validator('favicon_url')
    @classmethod
    def validate_favicon_url(cls, v):
        """Validate favicon URL format - supports both relative and absolute URLs, including asset URLs"""
        import re
        
        # Define allowed file extensions
        allowed_extensions = ('.ico', '.png', '.svg')
        
        # Check if it's an asset URL (bypass extension validation for these)
        if v.startswith('/api/v1/assets/'):
            if _validate_asset_url(v):
                return v
            else:
                raise ValueError('Invalid asset URL format')
        
        # Check if it contains a protocol
        if '://' in v:
            # For URLs with protocols, only allow HTTP/HTTPS
            if not v.startswith(('http://', 'https://')):
                invalid_protocol = v.split('://')[0]
                raise ValueError(f'Invalid protocol "{invalid_protocol}". Only HTTP and HTTPS are allowed for favicon URLs')
            
            # Validate URL structure for absolute URLs (supports domains, localhost, IPs)
            # Check for basic malformed URLs first
            if '..' in v or v.endswith('://') or '///' in v:
                raise ValueError('Malformed URL format for favicon')
                
            url_pattern = r'^https?://([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d{1,5})?(/.*)?$'
            if not re.match(url_pattern, v):
                raise ValueError('Invalid URL format for favicon')
                
            # Check file extension for absolute URLs (ignore query/fragment)
            from urllib.parse import urlsplit
            path = urlsplit(v).path
            if not any(path.lower().endswith(ext) for ext in allowed_extensions):
                raise ValueError('Favicon URL must end with .ico, .png, or .svg')
        else:
            # For relative URLs, must start with "/" and have valid extension
            if not v.startswith('/'):
                raise ValueError('Relative favicon URL must start with /')
            
            # Validate relative path structure (no protocol, no domain)
            if '://' in v or v.startswith('//'):
                raise ValueError('Invalid relative URL format. Use absolute URLs with http:// or https:// for external resources')
            
            # Check file extension for relative URLs (ignore query/fragment)
            path = v.split('?', 1)[0].split('#', 1)[0]
            if not any(path.lower().endswith(ext) for ext in allowed_extensions):
                raise ValueError('Favicon URL must end with .ico, .png, or .svg')
            
            # Ensure it's a reasonable path (no double slashes, no weird characters, no path traversal)
            if '//' in v or any(char in v for char in ['<', '>', '"', '|', '*']) or '../' in v or '/..' in v:
                raise ValueError('Invalid characters or path traversal detected in favicon URL path')
        
        return v

    @field_validator('meta_description')
    @classmethod
    def validate_meta_description(cls, v):
        """Validate meta description if provided"""
        if v is not None:
            v = v.strip()
            if not v:
                return None
            if len(v) > 160:
                raise ValueError('Meta description cannot exceed 160 characters')
        return v

    @field_validator('favicon_asset_id')
    @classmethod
    def validate_favicon_asset_id(cls, v):
        """Validate favicon_asset_id as MongoDB ObjectId (24 lowercase hex)"""
        if v is None:
            return v
        if not re.match(r'^[a-f0-9]{24}$', v):
            raise ValueError('favicon_asset_id must be a 24-character lowercase hex string')
        return v


class WebsiteConfigUpdate(BaseModel):
    """
    Model for partial website configuration updates
    
    Allows updating specific fields without requiring all fields
    """
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Your Updated Website Name",
                "meta_description": "Updated description for your church website"
            }
        }
    )
    
    title: Optional[str] = Field(
        None,
        min_length=1,
        max_length=60,
        description="Website title to update"
    )
    
    favicon_url: Optional[str] = Field(
        None,
        description="Favicon URL to update"
    )
    
    favicon_asset_id: Optional[str] = Field(
        None,
        description="Media asset ID for favicon (when using media upload system)"
    )
    
    meta_description: Optional[str] = Field(
        None,
        max_length=160,
        description="Meta description to update"
    )

    og_image: Optional[str] = Field(
        None,
        description="URL to Open Graph image for social media previews"
    )

    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        """Validate title if provided"""
        if v is not None:
            if not v or not v.strip():
                raise ValueError('Title cannot be empty')
            return v.strip()
        return v

    @field_validator('favicon_url')
    @classmethod
    def validate_favicon_url(cls, v):
        """Validate favicon URL if provided - supports both relative and absolute URLs, including asset URLs"""
        if v is not None:
            import re
            
            # Define allowed file extensions
            allowed_extensions = ('.ico', '.png', '.svg')
            
            # Check if it's an asset URL (bypass extension validation for these)
            if v.startswith('/api/v1/assets/'):
                if _validate_asset_url(v):
                    return v
                else:
                    raise ValueError('Invalid asset URL format')
            
            # Check if it contains a protocol
            if '://' in v:
                # For URLs with protocols, only allow HTTP/HTTPS
                if not v.startswith(('http://', 'https://')):
                    invalid_protocol = v.split('://')[0]
                    raise ValueError(f'Invalid protocol "{invalid_protocol}". Only HTTP and HTTPS are allowed for favicon URLs')
                
                # Validate URL structure for absolute URLs (supports domains, localhost, IPs)
                # Check for basic malformed URLs first
                if '..' in v or v.endswith('://') or '///' in v:
                    raise ValueError('Malformed URL format for favicon')
                    
                url_pattern = r'^https?://([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d{1,5})?(/.*)?$'
                if not re.match(url_pattern, v):
                    raise ValueError('Invalid URL format for favicon')
                    
                # Check file extension for absolute URLs (ignore query/fragment)
                from urllib.parse import urlsplit
                path = urlsplit(v).path
                if not any(path.lower().endswith(ext) for ext in allowed_extensions):
                    raise ValueError('Favicon URL must end with .ico, .png, or .svg')
            else:
                # For relative URLs, must start with "/" and have valid extension
                if not v.startswith('/'):
                    raise ValueError('Relative favicon URL must start with /')
                
                # Validate relative path structure (no protocol, no domain)
                if '://' in v or v.startswith('//'):
                    raise ValueError('Invalid relative URL format. Use absolute URLs with http:// or https:// for external resources')
                
                # Check file extension for relative URLs (ignore query/fragment)
                path = v.split('?', 1)[0].split('#', 1)[0]
                if not any(path.lower().endswith(ext) for ext in allowed_extensions):
                    raise ValueError('Favicon URL must end with .ico, .png, or .svg')
                
                # Ensure it's a reasonable path (no double slashes, no weird characters, no path traversal)
                if '//' in v or any(char in v for char in ['<', '>', '"', '|', '*']) or '../' in v or '/..' in v:
                    raise ValueError('Invalid characters or path traversal detected in favicon URL path')
        return v

    @field_validator('meta_description')
    @classmethod
    def validate_meta_description(cls, v):
        """Validate meta description if provided"""
        if v is not None:
            v = v.strip()
            if not v:
                return None
            if len(v) > 160:
                raise ValueError('Meta description cannot exceed 160 characters')
        return v

    @field_validator('favicon_asset_id')
    @classmethod
    def validate_favicon_asset_id(cls, v):
        """Validate favicon_asset_id as MongoDB ObjectId (24 lowercase hex)"""
        if v is None:
            return v
        if not re.match(r'^[a-f0-9]{24}$', v):
            raise ValueError('favicon_asset_id must be a 24-character lowercase hex string')
        return v


class TitleUpdateRequest(BaseModel):
    """
    Simple model for title-only updates
    
    Maintains compatibility with existing frontend API calls
    """
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "New Church Title"
            }
        }
    )
    
    title: str = Field(
        min_length=1,
        max_length=60,
        description="New website title"
    )

    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        """Validate title is not empty after stripping whitespace"""
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()