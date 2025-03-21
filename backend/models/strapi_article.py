import httpx
import os
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

STRAPI_URL = os.getenv("STRAPI_URL", "http://localhost:1337")
STRAPI_API_TOKEN = os.getenv("STRAPI_API_TOKEN", "")

headers = {
    "Authorization": f"Bearer {STRAPI_API_TOKEN}",
    "Content-Type": "application/json"
}

async def get_articles():
    """Get all articles from Strapi"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{STRAPI_URL}/api/articles", headers=headers)

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Error fetching articles from Strapi")

        return response.json()

async def get_article_by_id(article_id: str):
    """Get a specific article by ID from Strapi"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{STRAPI_URL}/api/articles/{article_id}", headers=headers)

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"Article with ID {article_id} not found")

        return response.json()
