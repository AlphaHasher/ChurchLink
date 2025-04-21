import httpx
import os
from dotenv import load_dotenv
from fastapi import HTTPException
from mongo.churchuser import UserHandler
from helpers.StrapiHelper import StrapiHelper

load_dotenv()

STRAPI_URL = os.getenv("STRAPI_URL", "")

headers = {
    "Content-Type": "application/json"
}

async def get_uploads():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{STRAPI_URL}/api/upload/files", headers=headers)

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Error fetching articles from Strapi")

        return response.json()
    
async def get_upload_by_id(upload_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{STRAPI_URL}/api/upload/files/{upload_id}", headers=headers)

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"Upload with ID {upload_id} not found")

        return response.json()
    
async def search_uploads(uid:str, query: str):
    if not await UserHandler.does_user_have_permissions(uid):
        raise HTTPException(
                status_code=500,
                detail="Proper Permissions not present!"
            )
    return await StrapiHelper.search_uploads_by_name(query)