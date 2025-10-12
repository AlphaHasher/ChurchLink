import httpx
import os
from dotenv import load_dotenv
from fastapi import HTTPException, UploadFile
from helpers.StrapiHelper import StrapiHelper

load_dotenv()

STRAPI_URL = os.getenv("STRAPI_URL", "")
STRAPI_API_KEY = os.getenv("STRAPI_API_KEY", "")

headers = {
    "Content-Type": "application/json"
}

def _auth_headers() -> dict:
    base = {"Content-Type": "application/json"}
    if STRAPI_API_KEY:
        base["Authorization"] = f"Bearer {STRAPI_API_KEY}"
    return base

async def get_uploads(params: dict | None = None):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{STRAPI_URL}/api/upload/files",
            headers=_auth_headers(),
            params=params or None,
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Error fetching articles from Strapi")

        return response.json()
    
async def get_upload_by_id(upload_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{STRAPI_URL}/api/upload/files/{upload_id}", headers=_auth_headers())

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"Upload with ID {upload_id} not found")

        return response.json()
    
async def search_uploads(query: str):
    return await StrapiHelper.search_uploads_by_name(query)

async def upload_files(files: list[UploadFile]):
    if not STRAPI_URL:
        raise HTTPException(status_code=500, detail="STRAPI_URL is not configured")
    if not STRAPI_API_KEY:
        raise HTTPException(status_code=500, detail="STRAPI_API_KEY is not configured for uploads")

    # Prepare multipart files for Strapi: key should be 'files'
    multipart: list[tuple[str, tuple[str, bytes, str]]] = []
    for f in files:
        content = await f.read()
        filename = f.filename or "upload.bin"
        content_type = f.content_type or "application/octet-stream"
        multipart.append(("files", (filename, content, content_type)))

    upload_headers = {
        "Authorization": f"Bearer {STRAPI_API_KEY}",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            f"{STRAPI_URL}/api/upload",
            headers=upload_headers,
            files=multipart,
        )

    if res.status_code not in (200, 201):
        raise HTTPException(status_code=res.status_code, detail=f"Failed to upload to Strapi: {res.text}")

    return res.json()