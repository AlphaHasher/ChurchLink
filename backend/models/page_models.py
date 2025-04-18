from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime

class Section(BaseModel):
    type: str  # e.g., "hero", "textBlock"
    props: Dict  # key-value pairs like {"heading": "...", "text": "..."}

class Page(BaseModel):
    title: str
    slug: str  # e.g., "home", "about"
    published: Optional[bool] = False
    sections: List[Section] = []
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
