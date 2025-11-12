from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Optional
from datetime import datetime
from helpers.slug_validator import validate_slug


class Section(BaseModel):
    type: str  # e.g., "hero", "textBlock"
    props: Dict  # key-value pairs like {"heading": "...", "text": "..."}


class Page(BaseModel):
    title: str
    slug: str  # e.g., "home", "about", or "/"
    sections: List[Section] = []
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

    @field_validator("slug")
    @classmethod
    def validate_slug_field(cls, v):
        return validate_slug(v, allow_none=True, allow_root=True)
