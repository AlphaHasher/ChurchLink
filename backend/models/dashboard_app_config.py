# models/dashboard_app_config.py

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class DashboardPageConfig(BaseModel):
    """Represents a single dashboard page configuration"""
    index: int = Field(..., description="Order index of the page")
    page_name: str = Field(..., description="Internal page name or slug")
    display_name: str = Field(..., description="Display name for the dashboard UI")
    image_id: Optional[str] = Field(None, description="Reference to image_data _id")
    enabled: bool = Field(True, description="Whether the page is visible/enabled")

class DashboardAppConfig(BaseModel):
    """Dashboard app configuration document"""
    id: Optional[str] = Field(None, alias="_id")
    config_type: str = Field("dashboard_pages", description="Type of configuration (shared collection)")
    version: str = Field("1.0", description="Configuration version")
    pages: List[DashboardPageConfig] = Field(default_factory=list)
    created_on: datetime = Field(default_factory=datetime.utcnow)
    updated_on: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = Field(None, description="User who last updated this config")

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
        orm_mode = True
