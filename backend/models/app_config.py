"""
App Configuration Model
Stores app configuration data like tab structures, settings, etc.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class AppTab(BaseModel):
    """Individual tab configuration"""
    index: int = Field(..., description="Tab index (0-based)")
    name: str = Field(..., description="Internal tab name (lowercase)")
    displayName: str = Field(..., description="Human-readable tab name")
    icon: Optional[str] = Field(None, description="Icon identifier")
    enabled: bool = Field(True, description="Whether tab is enabled")
    
class AppConfig(BaseModel):
    """App configuration document"""
    id: Optional[str] = Field(None, description="Document ID")
    config_type: str = Field(..., description="Type of configuration (e.g., 'tabs')")
    version: str = Field("1.0", description="Configuration version")
    tabs: List[AppTab] = Field(default_factory=list, description="Tab configuration")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = Field(None, description="User who last updated this config")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }