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
STRAPI_API_KEY = os.getenv("STRAPI_API_KEY", "")

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}

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



###################
# Catch-all proxy to Strapi


@strapi_router.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    dependencies=[Depends(role_based_access(["admin"]))],
)
async def proxy_strapi(full_path: str, request: Request):
    if not STRAPI_URL:
        raise HTTPException(status_code=500, detail="STRAPI_URL is not configured")

    # Build target URL preserving query string
    url_path = full_path.lstrip('/')
    target_url = f"{STRAPI_URL.rstrip('/')}/{url_path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    # Prepare headers: forward most, filter hop-by-hop and those managed by httpx/uvicorn
    forward_headers = {}
    for name, value in request.headers.items():
        lname = name.lower()
        if lname in HOP_BY_HOP_HEADERS:
            continue
        if lname in ("host", "content-length", "authorization", "cookie"):
            continue
        forward_headers[name] = value

    # Inject Strapi API key for server-to-server auth
    # Inject credentials for Strapi
    if url_path.startswith("api/upload"):
        if STRAPI_API_KEY:
            forward_headers["Authorization"] = f"Bearer {STRAPI_API_KEY}"
        else:
            # Fallback: use Strapi admin token and admin upload endpoint
            try:
                admin_token = await StrapiHelper.get_admin_token()
            except Exception:
                raise HTTPException(status_code=500, detail="Failed to get Strapi admin token for upload proxying")
            forward_headers["Authorization"] = f"Bearer {admin_token}"
            # Switch endpoint to admin upload route
            admin_path = url_path.replace("api/upload", "admin/upload", 1)
            target_url = f"{STRAPI_URL.rstrip('/')}/{admin_path}"
            if request.url.query:
                target_url = f"{target_url.split('?',1)[0]}?{request.url.query}"

    body = await request.body()

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.request(
                request.method,
                target_url,
                content=body if body else None,
                headers=forward_headers,
            )
    except httpx.HTTPError as e:
        logger.error(f"Strapi proxy error: {str(e)}")
        raise HTTPException(status_code=502, detail="Bad gateway while contacting Strapi")

    # Prepare response headers, filtering hop-by-hop and controlled headers
    response_headers = {}
    for name, value in resp.headers.items():
        lname = name.lower()
        if lname in HOP_BY_HOP_HEADERS:
            continue
        if lname in ("content-length", "transfer-encoding", "connection"):
            continue
        response_headers[name] = value

    media_type = resp.headers.get("content-type")
    return Response(content=resp.content, status_code=resp.status_code, headers=response_headers, media_type=media_type)
