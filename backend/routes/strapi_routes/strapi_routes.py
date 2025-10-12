import logging
import os
import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Depends
from starlette.responses import Response
from controllers.strapi_article import get_articles, get_article_by_id
from controllers.strapi_uploads import get_uploads, get_upload_by_id, search_uploads, upload_files
from controllers.strapi_user_management import process_redirect
from helpers.Firebase_helpers import role_based_access
from helpers.StrapiHelper import StrapiHelper

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
STRAPI_URL = os.getenv("STRAPI_URL", "")

strapi_router = APIRouter(prefix="/strapi", tags=["strapi"])

strapi_protected_router = APIRouter(prefix="/strapi", tags=["strapi"])

###################
# Article routes

@strapi_router.get("/articles")
async def get_articles_route():
    return await get_articles()

@strapi_router.get("/articles/{article_id}")
async def get_article_route(article_id: str):
    return await get_article_by_id(article_id)

###################
# Uploads routes

@strapi_router.get("/uploads")
async def get_upload_route(request: Request):
    # Forward pagination/sorting params if provided
    params = dict(request.query_params)
    return await get_uploads(params)

@strapi_router.get("/uploads/search")
async def search_uploads_route(query: str):
    return await search_uploads(query)

@strapi_router.get("/uploads/{upload_id}")
async def get_upload_by_id_route(upload_id: str):
    return await get_upload_by_id(upload_id)

@strapi_router.post("/uploads")
async def upload_files_route(files: list[UploadFile] = File(...)):
    return await upload_files(files)


###################
# Re-direct service

@strapi_protected_router.post("/strapi-redirect")
async def process_strapi_redirect(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    logger.info(f"Strapi redirect request from IP: {client_ip}, User-Agent: {user_agent[:100]}...")

    try:
        result = await process_redirect(request)
        logger.info(f"Strapi redirect successful for UID: {request.state.uid}")
        return result
    except Exception as e:
        logger.error(f"Strapi redirect failed for UID: {request.state.uid} - Error: {str(e)}")
        raise



