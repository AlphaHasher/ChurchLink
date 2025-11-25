"""
Frontend Serving Routes with Server-Side Meta Tag Injection

This module serves the built Vite frontend with dynamic meta tags for:
- SEO optimization
- Social media sharing (Open Graph, Twitter Cards)
- Page-specific titles and descriptions

The server fetches page data from MongoDB and injects meta tags into the HTML
before serving it to clients, ensuring social media crawlers can read the tags.
"""

import logging
import os
import re
from pathlib import Path
from typing import Optional
from urllib.parse import unquote

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape
from mongo.database import DB

logger = logging.getLogger(__name__)
frontend_router = APIRouter()

# Paths
BACKEND_DIR = Path(__file__).parent.parent
TEMPLATES_DIR = BACKEND_DIR / "templates"
FRONTEND_DIST_DIR = BACKEND_DIR.parent / "frontend" / "web" / "churchlink" / "dist"

# Initialize Jinja2 with autoescaping for HTML/XML templates
jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(
        enabled_extensions=("html", "htm", "xml"),
        default=True,
    )
)


def _normalize_slug(raw_slug: str) -> str:
    """Normalize slug (handles double-encoding and home/root)"""
    decoded = unquote(unquote(raw_slug or "")).strip()
    if decoded == "" or decoded == "home":
        return "/"
    return decoded


async def get_website_config() -> dict:
    """Fetch website configuration from MongoDB"""
    try:
        config = await DB.db["website_app_config"].find_one({})
        if config:
            return {
                "title": config.get("title", "ChurchLink"),
                "favicon_url": config.get("favicon_url", "/dove-favicon.svg"),
                "meta_description": config.get("meta_description", "Welcome to our church"),
                "og_image": config.get("og_image"),
            }
    except Exception as e:
        print(f"Error fetching website config: {e}")

    return {
        "title": "ChurchLink",
        "favicon_url": "/dove-favicon.svg",
        "meta_description": "Welcome to our church",
        "og_image": None,
    }


async def get_page_data(slug: str) -> Optional[dict]:
    """Fetch page data from MongoDB by slug"""
    try:
        decoded = _normalize_slug(slug)

        # Try exact match first
        page = await DB.db["pages"].find_one({"slug": decoded, "visible": True})

        # Fallback: if root not found, try "home"
        if not page and decoded == "/":
            page = await DB.db["pages"].find_one({"slug": "home", "visible": True})

        return page
    except Exception as e:
        print(f"Error fetching page data: {e}")
        return None


def extract_vite_assets(dist_index_path: Path) -> str:
    """Extract script and link tags from the built index.html"""
    try:
        with open(dist_index_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Extract script tags with src attribute
        script_pattern = r'<script[^>]*src="[^"]*"[^>]*></script>'
        scripts = re.findall(script_pattern, content)

        # Extract link tags for CSS
        link_pattern = r'<link[^>]*rel="stylesheet"[^>]*>'
        links = re.findall(link_pattern, content)

        return "\n  ".join(links + scripts)
    except Exception as e:
        print(f"Error extracting vite assets: {e}")
        return ""


def make_absolute_url(url: str, base_url: str) -> str:
    """Convert relative URL to absolute URL for social media"""
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"{base_url.rstrip('/')}{url}"


@frontend_router.get("/{full_path:path}")
async def serve_frontend(request: Request, full_path: str = ""):
    """
    Serve the frontend with dynamic meta tags.

    This route handles all paths not matched by API routes, serving the built
    Vite app with server-side rendered meta tags for SEO and social media.
    """

    # CRITICAL: Never intercept API routes - they should be handled by FastAPI routers
    if full_path.startswith("api/"):
        logger.error(f"⚠️  ROUTING ERROR: Frontend router received API path: /{full_path}")
        logger.error("This means API routers are not matching correctly!")
        logger.error("Check that API routers are included BEFORE frontend_router in main.py")
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="API route not found - check server logs")

    # Static assets - serve directly
    if full_path.startswith("assets/") or full_path in ["dove-favicon.svg", "vite.svg", "manifest.json", "robots.txt"]:
        file_path = FRONTEND_DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)

    # Get base URL for absolute URLs
    base_url = str(request.base_url).rstrip("/")

    # Fetch website config
    website_config = await get_website_config()

    # List of app routes that should NOT check MongoDB for page data
    # These are React app routes, not web-builder pages
    app_routes = [
        "auth/", "admin/", "profile/", "my-transactions/",
        "thank-you", "pages/", "web-editor"
    ]

    # Check if this is an app route (not a web-builder page)
    is_app_route = any(full_path.startswith(route) or full_path == route.rstrip("/") for route in app_routes)

    # Log route handling for debugging
    if is_app_route:
        logger.debug(f"Serving app route: /{full_path} (no MongoDB lookup)")
    else:
        logger.debug(f"Checking MongoDB for web-builder page: /{full_path}")

    # Fetch page data only if NOT an app route
    page_data = None if is_app_route else await get_page_data(full_path)

    # Determine meta tag values
    if page_data:
        # Page-specific meta tags
        title = page_data.get("title", website_config["title"])
        meta_description = page_data.get("meta_description") or website_config["meta_description"]

        # Get page-specific OG image if available
        og_image = None
        if page_data.get("og_image"):
            og_image = make_absolute_url(page_data["og_image"], base_url)
        elif website_config.get("og_image"):
            og_image = make_absolute_url(website_config["og_image"], base_url)
        else:
            og_image = make_absolute_url("/dove-favicon.svg", base_url)
    else:
        # Default to website config
        title = website_config["title"]
        meta_description = website_config["meta_description"]
        og_image = make_absolute_url(
            website_config.get("og_image") or "/dove-favicon.svg",
            base_url
        )

    # Favicon
    favicon_url = website_config["favicon_url"]
    favicon_type = "image/svg+xml" if favicon_url.endswith(".svg") else "image/x-icon"

    # Current page URL for og:url
    og_url = f"{base_url}/{full_path}".rstrip("/")

    # Extract Vite build assets
    dist_index = FRONTEND_DIST_DIR / "index.html"
    vite_assets = extract_vite_assets(dist_index) if dist_index.exists() else ""

    # Render template with Jinja2
    template = jinja_env.get_template("index.html")
    html_content = template.render(
        title=title,
        meta_description=meta_description,
        favicon_url=favicon_url,
        favicon_type=favicon_type,
        og_title=title,
        og_description=meta_description,
        og_image=og_image,
        og_url=og_url,
        twitter_title=title,
        twitter_description=meta_description,
        twitter_image=og_image,
        vite_assets=vite_assets,
    )

    return HTMLResponse(content=html_content)


# Mount static files for assets
def mount_static_files(app):
    """
    Mount static files from the dist folder.
    Call this from main.py after including the router.
    """
    if FRONTEND_DIST_DIR.exists():
        app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST_DIR / "assets")), name="assets")
        # Mount other static files at root
        app.mount("/", StaticFiles(directory=str(FRONTEND_DIST_DIR)), name="static")
