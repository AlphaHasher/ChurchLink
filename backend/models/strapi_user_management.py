import httpx
import os
from dotenv import load_dotenv
from fastapi import HTTPException
from mongo.churchuser import UserHandler
from helpers.StrapiHelper import StrapiHelper

load_dotenv()

STRAPI_URL = os.getenv("STRAPI_URL", "")
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "")

MEDIA_LIBRARY_PATH = "/admin/plugins/upload"

async def process_redirect(uid: str):
    if not await UserHandler.does_user_have_permissions(uid):
        raise HTTPException(status_code=500, detail="User does not have permissions.")

    if not STRAPI_URL or not SUPER_ADMIN_EMAIL or not SUPER_ADMIN_PASSWORD:
        raise HTTPException(status_code=500, detail="Strapi admin credentials missing")
    
    mongo_user = await UserHandler.find_by_uid(uid)

    if mongo_user == None:
        raise HTTPException(status_code=500, detail="Error! User not found.")

    token = await StrapiHelper.get_admin_token()
    user_exists = await StrapiHelper.does_strapi_user_exist(mongo_user['email'], token)

    if user_exists['exists']:
        if user_exists['active']:
            media_url = f"{STRAPI_URL.rstrip('/')}{MEDIA_LIBRARY_PATH}"
            return { "redirect": media_url }
        else:
            return {"redirect": user_exists['invite_url']}
    else:
        email = mongo_user['email']
        first_name = mongo_user['first_name']
        last_name = mongo_user['last_name']
        uid = mongo_user['uid']
        invite_url = await StrapiHelper.invite_strapi_user(email, first_name, last_name, uid)
        return { "redirect": invite_url }