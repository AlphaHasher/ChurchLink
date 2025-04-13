import httpx
import os
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

STRAPI_URL = os.getenv("STRAPI_URL", "")
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "")

MEDIA_LIBRARY_PATH = "/admin/plugins/upload"

async def process_redirect(email: str):
    if not STRAPI_URL or not SUPER_ADMIN_EMAIL or not SUPER_ADMIN_PASSWORD:
        raise HTTPException(status_code=500, detail="Strapi admin credentials missing")

    token = await get_admin_token()
    user_exists = await does_strapi_user_exist(email, token)

    if user_exists:
        media_url = f"{STRAPI_URL.rstrip('/')}{MEDIA_LIBRARY_PATH}"
        return { "redirect": media_url }
    else:
        return { "exists": False }

async def get_admin_token() -> str:
    url = f"{STRAPI_URL}/admin/login"
    payload = {
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    }
    headers = { "Content-Type": "application/json" }

    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=payload, headers=headers)

    if res.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to authenticate with Strapi Admin")

    data = res.json()
    return data["data"]["token"]

async def does_strapi_user_exist(email: str, token: str) -> bool:
    url = f"{STRAPI_URL}/admin/users"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=headers)
        print(f"[DEBUG] User Query Status: {res.status_code}")
        print(f"[DEBUG] User Query Response: {res.text}")

    if res.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to query Strapi users")

    users = res.json()
    for user in users['data']['results']:
        if user['email'] == email:
            return True

    return False
