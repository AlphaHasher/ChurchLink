import logging
from fastapi import APIRouter, Depends, Request
from models.strapi_article import get_articles, get_article_by_id
from models.strapi_uploads import get_uploads, get_upload_by_id, search_uploads
from models.strapi_user_management import process_redirect
from helpers.Firebase_helpers import authenticate_uid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

strapi_router = APIRouter(prefix="/strapi", tags=["strapi"])

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
async def get_upload_route():
    return await get_uploads()

@strapi_router.get("/uploads/search")
async def search_uploads_route(query: str, uid:str = Depends(authenticate_uid)):
    return await search_uploads(uid, query)

@strapi_router.get("/uploads/{upload_id}")
async def get_upload_by_id_route(upload_id: str):
    return await get_upload_by_id(upload_id)



###################
# Re-direct service

@strapi_router.post("/strapi-redirect")
async def process_strapi_redirect(request: Request, uid: str = Depends(authenticate_uid)):
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    logger.info(f"Strapi redirect request from IP: {client_ip}, User-Agent: {user_agent[:100]}...")

    try:
        result = await process_redirect(uid)
        logger.info(f"Strapi redirect successful for UID: {uid}")
        return result
    except Exception as e:
        logger.error(f"Strapi redirect failed for UID: {uid} - Error: {str(e)}")
        raise

