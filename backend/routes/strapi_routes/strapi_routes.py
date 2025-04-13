from fastapi import APIRouter, HTTPException, Depends, Query
from models.strapi_article import get_articles, get_article_by_id
from models.strapi_uploads import get_uploads, get_upload_by_id
from models.strapi_redirect import process_redirect


strapi_router = APIRouter()

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

@strapi_router.get("/uploads/{upload_id}")
async def get_upload_by_id_route(upload_id: str):
    return await get_upload_by_id(upload_id)

###################
# Re-direct service

# TODO: Make this implement actual permissions and middleware instead of just an email parameter 
@strapi_router.post("/strapi-redirect")
async def process_strapi_redirect(email: str = Query(..., description="The email of the user")):
    return await process_redirect(email)

