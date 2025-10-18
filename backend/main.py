from contextlib import asynccontextmanager
import asyncio
import logging
import os
import sys

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from scalar_fastapi import get_scalar_api_reference

import firebase_admin
from firebase_admin import credentials

from get_bearer_token import generate_test_token
from add_roles import add_user_role, RoleUpdate

from mongo.database import DB as DatabaseManager
from mongo.firebase_sync import FirebaseSyncer
from mongo.roles import RoleHandler
from mongo.scheduled_notifications import scheduled_notification_loop

from helpers.youtubeHelper import YoutubeHelper
from helpers.BiblePlanScheduler import initialize_bible_plan_notifications
import asyncio
import os
import logging

from protected_routers.auth_protected_router import AuthProtectedRouter
from protected_routers.mod_protected_router import ModProtectedRouter
from protected_routers.perm_protected_router import PermProtectedRouter

from routes.bible_routes.bible_note_routes import bible_note_router
from routes.bible_routes.bible_plan_routes import mod_bible_plan_router, private_bible_plan_router, public_bible_plan_router
from routes.bible_routes.user_bible_plan_routes import auth_bible_plan_router
from routes.bible_routes.bible_plan_notification_routes import bible_notification_router

from routes.common_routes.event_person_routes import event_person_management_router, event_person_registration_router
from routes.common_routes.event_routes import event_editing_router, private_event_router, public_event_router
from routes.common_routes.ministry_routes import public_ministry_router, mod_ministry_router
from routes.common_routes.sermon_routes import public_sermon_router, private_sermon_router, sermon_editing_router
from routes.common_routes.bulletin_routes import public_bulletin_router,bulletin_editing_router,public_service_router,service_bulletin_editing_router
from routes.common_routes.notification_routes import private_notification_router, public_notification_router
from routes.common_routes.user_routes import user_mod_router, user_private_router
from routes.common_routes.membership_routes import member_private_router, member_mod_router
from routes.common_routes.youtube_routes import public_youtube_router
from routes.common_routes.app_config_routes import app_config_public_router, app_config_private_router
from routes.common_routes.ministry_routes import public_ministry_router, mod_ministry_router

from routes.page_management_routes.footer_routes import public_footer_router, mod_footer_router
from routes.page_management_routes.header_routes import mod_header_router, public_header_router
from routes.page_management_routes.page_routes import mod_page_router, public_page_router

from routes.paypal_routes.paypal_adminsetting import paypal_admin_router
from routes.paypal_routes.paypal_routes import paypal_public_router

from routes.permissions_routes.permissions_routes import permissions_protected_router, permissions_view_router

from routes.form_routes.mod_forms_routes import mod_forms_router
from routes.form_routes.private_forms_routes import private_forms_router
from routes.form_routes.public_forms_routes import public_forms_router
from routes.translator_routes import translator_router
from routes.assets_routes import protected_assets_router, public_assets_router, mod_assets_router
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from routes.webhook_listener_routes.paypal_subscription_webhook_routes import paypal_subscription_webhook_router
from routes.webhook_listener_routes.paypal_webhook_routes import paypal_webhook_router
from routes.webhook_listener_routes.youtube_listener_routes import youtube_listener_router

from dotenv import load_dotenv
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# You can turn this on/off depending if you want firebase sync on startup, True will bypass it, meaning syncs wont happen
BYPASS_FIREBASE_SYNC = False

FRONTEND_URL = os.getenv("FRONTEND_URL")
ADDITIONAL_ORIGINS = os.getenv("ADDITIONAL_ORIGINS", "")

def _normalize_origin(orig: str) -> str | None:
    if not orig:
        return None
    o = orig.strip()
    return o.rstrip('/')

ALLOWED_ORIGINS = []
if FRONTEND_URL:
    norm = _normalize_origin(FRONTEND_URL)
    if norm:
        ALLOWED_ORIGINS.append(norm)

if ADDITIONAL_ORIGINS:
    for origin in ADDITIONAL_ORIGINS.split(','):
        norm = _normalize_origin(origin)
        if norm:
            ALLOWED_ORIGINS.append(norm)

ALLOWED_ORIGINS = list(dict.fromkeys([o for o in ALLOWED_ORIGINS if o]))

logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        logger.info("Starting application initialization")

        # Initialize Firebase Admin SDK if not already initialized
        if not firebase_admin._apps:
            logger.info("Initializing Firebase Admin SDK")
            from firebase.firebase_credentials import get_firebase_credentials

            cred = credentials.Certificate(get_firebase_credentials())
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized")

        # MongoDB connection setup - CRITICAL: Will stop app if fails
        logger.info("Connecting to MongoDB...")
        await DatabaseManager.init_db()
        logger.info("MongoDB connected")

        if not BYPASS_FIREBASE_SYNC:
            logger.info("Running initial Firebase -> Mongo sync")
            await FirebaseSyncer.SyncDBToFirebase()
            logger.info("Initial Firebase sync complete")

        # Ensure required roles exist
        logger.info("Ensuring administrator role exists")
        await RoleHandler.verify_admin_role()
        logger.info("Administrator role verified")

        # Background tasks
        logger.info("Starting background tasks")
        youtubeSubscriptionCheck = asyncio.create_task(YoutubeHelper.youtubeSubscriptionLoop())
        scheduledNotifTask = asyncio.create_task(scheduled_notification_loop(DatabaseManager.db))

        # Initialize Bible Plan Notification System
        logger.info("Initializing Bible plan notifications")
        await initialize_bible_plan_notifications()

        logger.info("Application startup completed successfully")
        yield

        # Cleanup
        logger.info("Shutting down background tasks and closing DB")
        youtubeSubscriptionCheck.cancel()
        scheduledNotifTask.cancel()
        DatabaseManager.close_db()
        logger.info("Shutdown complete")

    except Exception as e:
        logger.error(f"Application startup failed: {e}")
        logger.error("Ensure MongoDB is running and MONGODB_URL is correct")
        sys.exit(1)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,  # Required for auth tokens/cookies
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.) - we should probably lock this down later
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers
)

@app.get("/")
async def root():
    return {"message": "Hello World"}


##nice looking docs
@app.get("/scalar", include_in_schema=False)
async def scalar_html():
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title=app.title,
    )


class LoginCredentials(BaseModel):
    email: str
    password: str


#####################################################
# Public Routers - No Auth
#####################################################
public_router = APIRouter(prefix="/api/v1")

public_router.include_router(public_event_router)
public_router.include_router(public_sermon_router)
public_router.include_router(public_bulletin_router)
public_router.include_router(public_service_router)
public_router.include_router(public_ministry_router)
public_router.include_router(public_youtube_router)
public_router.include_router(public_footer_router)
public_router.include_router(public_header_router)
public_router.include_router(public_page_router)
public_router.include_router(youtube_listener_router)
public_router.include_router(public_notification_router)
public_router.include_router(app_config_public_router)
public_router.include_router(paypal_public_router)
public_router.include_router(paypal_subscription_webhook_router)
public_router.include_router(paypal_webhook_router)
public_router.include_router(translator_router)
public_router.include_router(public_bible_plan_router)
public_router.include_router(public_assets_router)
public_router.include_router(public_ministry_router)


#####################################################
# Private Routers - Requires Auth
#####################################################
private_router = AuthProtectedRouter(prefix="/api/v1")

private_router.include_router(bible_note_router)
private_router.include_router(auth_bible_plan_router)
private_router.include_router(private_bible_plan_router)
private_router.include_router(bible_notification_router)
private_router.include_router(event_person_registration_router)
private_router.include_router(event_person_management_router)
private_router.include_router(private_event_router)
private_router.include_router(private_sermon_router)
private_router.include_router(user_private_router)
private_router.include_router(member_private_router)
private_router.include_router(private_forms_router)
public_router.include_router(public_forms_router)

#####################################################
# Mod Routers - Requires at least 1 perm role, agnostic to specific permissions
#####################################################
mod_router = ModProtectedRouter(prefix="/api/v1")

mod_router.include_router(mod_bible_plan_router)
mod_router.include_router(mod_forms_router)
mod_router.include_router(mod_ministry_router)
mod_router.include_router(user_mod_router)
mod_router.include_router(mod_page_router)
mod_router.include_router(permissions_view_router)
mod_router.include_router(private_notification_router)
mod_router.include_router(paypal_admin_router)
mod_router.include_router(app_config_private_router)
mod_router.include_router(member_mod_router)
mod_router.include_router(mod_assets_router)
mod_router.include_router(mod_ministry_router)

#####################################################
# Perm Routers - Protected by various permissions
#####################################################

# EVENT EDITING CORE
event_editing_protected_router = PermProtectedRouter(prefix="/api/v1", tags=["Events"], required_perms=["event_editing"])

event_editing_protected_router.include_router(event_editing_router)

# SERMON EDITING CORE
sermon_editing_protected_router = PermProtectedRouter(prefix="/api/v1", tags=["Sermons"], required_perms=["sermon_editing"])

sermon_editing_protected_router.include_router(sermon_editing_router)

# BULLETIN EDITING CORE
bulletin_editing_protected_router = PermProtectedRouter(prefix="/api/v1", tags=["Bulletins"], required_perms=["bulletin_editing"])

bulletin_editing_protected_router.include_router(bulletin_editing_router)

# SERVICE BULLETIN EDITING CORE
service_editing_protected_router = PermProtectedRouter(prefix="/api/v1/bulletins", tags=["Services"], required_perms=["bulletin_editing"])

service_editing_protected_router.include_router(service_bulletin_editing_router)

# PERMISSIONS MANAGEMENT CORE
permissions_management_protected_router = PermProtectedRouter(prefix="/api/v1", tags=["permissions"], required_perms=['permissions_management'])

permissions_management_protected_router.include_router(permissions_protected_router)

# LAYOUT MANAGEMENT CORE
layout_management_protected_router = PermProtectedRouter(prefix="/api/v1", tags=["Header/Footer Layout"], required_perms=['layout_management'])
layout_management_protected_router.include_router(mod_header_router)
layout_management_protected_router.include_router(mod_footer_router)




# MEDIA MANAGEMENT CORE
media_management_protected_router = PermProtectedRouter(prefix="/api/v1", tags=["Media Protected"], required_perms=['media_management'])
media_management_protected_router.include_router(protected_assets_router)


# Include routers in main app
app.include_router(public_router)
app.include_router(private_router)
app.include_router(mod_router)
app.include_router(event_editing_protected_router)
app.include_router(sermon_editing_protected_router)
app.include_router(bulletin_editing_protected_router)
app.include_router(service_editing_protected_router)
app.include_router(permissions_management_protected_router)
app.include_router(layout_management_protected_router)
app.include_router(media_management_protected_router)




if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
