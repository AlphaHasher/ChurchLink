from fastapi import APIRouter, HTTPException, Depends
from models.strapi_article import get_articles, get_article_by_id


strapi_router = APIRouter()


# Article routes - some are commented out for now
@strapi_router.get("/articles")
async def get_articles_route():
    return await get_articles()

# @strapi_router.post("/articles")
# async def create_article_route(article: dict):
#     return await create_article(article)

@strapi_router.get("/articles/{article_id}")
async def get_article_route(article_id: int):
    return await get_article_by_id(article_id)

# @strapi_router.put("/articles/{article_id}")
# async def update_article_route(article_id: str, article: dict):
#     return await update_article(article_id, article)

# @strapi_router.patch("/articles/{article_id}")
# async def patch_article_route(article_id: str, article: dict):
#     return await update_article(article_id, article)

# @strapi_router.delete("/articles/{article_id}")
# async def delete_article_route(article_id: str):
#     return await delete_article(article_id)
