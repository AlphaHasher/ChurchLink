import os
import logging
from dotenv import load_dotenv
from fastapi import HTTPException
from mongo.churchuser import UserHandler
from helpers.StrapiHelper import StrapiHelper

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

STRAPI_URL = os.getenv("STRAPI_URL", "")
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "")

MEDIA_LIBRARY_PATH = "/admin/plugins/upload"

async def process_redirect(uid: str):
    logger.info(f"Processing Strapi redirect for user UID: {uid}")

    try:
        # Check user permissions
        logger.debug(f"Checking permissions for UID: {uid}")
        if not await UserHandler.does_user_have_permissions(uid):
            logger.warning(f"Access denied: User {uid} does not have required permissions")
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: User {uid} does not have required permissions to access Strapi"
            )

        # Check environment variables
        logger.debug("Validating Strapi configuration")
        if not STRAPI_URL:
            logger.error("STRAPI_URL environment variable is not set")
            raise HTTPException(
                status_code=500,
                detail="Server configuration error: STRAPI_URL is not configured"
            )
        if not SUPER_ADMIN_EMAIL or not SUPER_ADMIN_PASSWORD:
            logger.error("Strapi admin credentials are missing from environment")
            raise HTTPException(
                status_code=500,
                detail="Server configuration error: Strapi admin credentials are not configured"
            )

        # Find user in MongoDB
        logger.debug(f"Looking up user in MongoDB for UID: {uid}")
        mongo_user = await UserHandler.find_by_uid(uid)

        if mongo_user is None:
            logger.warning(f"User not found in MongoDB: UID {uid}")
            raise HTTPException(
                status_code=404,
                detail=f"User not found: No user exists with UID {uid}"
            )

        user_email = mongo_user.get('email')
        logger.info(f"Found user: {user_email} (UID: {uid})")

        # Get admin token
        logger.debug("Obtaining Strapi admin token")
        try:
            token = await StrapiHelper.get_admin_token()
            logger.debug("Successfully obtained Strapi admin token")
        except Exception as e:
            logger.error(f"Failed to obtain Strapi admin token: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Authentication failed: Unable to obtain Strapi admin token - {str(e)}"
            )

        # Check if user exists in Strapi
        logger.debug(f"Checking if user exists in Strapi: {user_email}")
        try:
            user_exists = await StrapiHelper.does_strapi_user_exist(user_email, token)
            logger.debug(f"Strapi user check result: exists={user_exists['exists']}, active={user_exists.get('active', False)}")
        except Exception as e:
            logger.error(f"Failed to check Strapi user existence for {user_email}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Strapi user lookup failed for {user_email}: {str(e)}"
            )

        if user_exists['exists']:
            if user_exists['active']:
                media_url = f"{STRAPI_URL.rstrip('/')}{MEDIA_LIBRARY_PATH}"
                logger.info(f"Redirecting active user {user_email} to media library: {media_url}")
                return { "redirect": media_url }
            else:
                invite_url = user_exists.get('invite_url')
                if invite_url:
                    logger.info(f"Redirecting inactive user {user_email} to invite URL")
                    return {"redirect": invite_url}
                else:
                    logger.error(f"No invite URL available for inactive user {user_email}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Configuration error: No invite URL available for user {user_email}"
                    )
        else:
            # Create new user invitation
            logger.info(f"Creating new Strapi invitation for user: {user_email}")
            try:
                email = mongo_user['email']
                first_name = mongo_user.get('first_name', '')
                last_name = mongo_user.get('last_name', '')
                uid = mongo_user['uid']

                invite_url = await StrapiHelper.invite_strapi_user(email, first_name, last_name, uid)
                logger.info(f"Successfully created invitation for new user {user_email}")
                return { "redirect": invite_url }

            except Exception as e:
                logger.error(f"Failed to create Strapi invitation for {user_email}: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to create Strapi invitation for {user_email}: {str(e)}"
                )

    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error in process_redirect for UID {uid}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected server error while processing redirect for user {uid}: {str(e)}"
        )