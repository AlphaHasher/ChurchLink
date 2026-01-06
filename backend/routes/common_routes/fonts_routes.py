from fastapi import APIRouter
import httpx
import os

fonts_router = APIRouter(prefix="/fonts", tags=["fonts"])

@fonts_router.get("/google-fonts")
async def get_google_fonts():
    """Fetch top 100 popular fonts from Google Fonts API."""
    api_key = os.getenv("GOOGLE_WEB_FONTS_API_KEY")
    if not api_key:
        return {"error": "API key not configured", "fonts": []}

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://www.googleapis.com/webfonts/v1/webfonts?key={api_key}&sort=popularity"
        )
        data = response.json()

        fonts = []
        for item in data.get("items", [])[:100]:
            fonts.append({
                "family": item["family"],
                "variants": item.get("variants", ["regular"]),
                "category": item.get("category", "sans-serif")
            })

        return {"fonts": fonts}
