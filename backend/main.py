from fastapi import FastAPI, APIRouter, Depends
from fastapi.middleware.cors import CORSMiddleware
from scalar_fastapi import get_scalar_api_reference
from mongo.database import DB as DatabaseManager
import firebase_admin
from helpers.Firebase_helpers import role_based_access
from firebase_admin import credentials
from helpers.youtubeHelper import YoutubeHelper
from get_bearer_token import generate_test_token
from add_roles import add_user_role, RoleUpdate
from mongo.firebase_sync import FirebaseSyncer
from mongo.roles import RoleHandler
from contextlib import asynccontextmanager
from pydantic import BaseModel
from mongo.scheduled_notifications import scheduled_notification_loop
import asyncio
import os
import logging
from protected_routers.auth_protected_router import AuthProtectedRouter

from routes.page_management_routes.page_routes import page_router
from routes.page_management_routes.header_routes import header_router as header_router
from routes.page_management_routes.footer_routes import footer_router as footer_router
from routes.common_routes.event_routes import event_router
from routes.common_routes.user_routes import user_router, user_mod_router, user_private_router
from routes.common_routes.event_person_routes import event_person_router, public_event_person_router
from routes.common_routes.event_routes import public_event_router, auth_event_router
from routes.bible_routes.bible_note_routes import bible_note_router
from routes.common_routes.youtube_routes import public_youtube_router
from routes.bible_routes.bible_plan_routes import bible_plan_router
from routes.strapi_routes.strapi_routes import strapi_router, strapi_protected_router
from routes.paypal_routes.paypal_routes import paypal_router
from routes.paypal_routes.paypal_adminsetting import paypal_router as paypal_admin_router
from routes.webhook_listener_routes.youtube_listener_routes import youtube_router
from routes.webhook_listener_routes.paypal_webhook_routes import paypal_webhook_router
from routes.webhook_listener_routes.paypal_subscription_webhook_routes import paypal_subscription_webhook_router
from routes.common_routes.notification_routes import notification_router
from routes.permissions_routes.permissions_routes import permissions_view_router, permissions_protected_router


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

FRONTEND_URL = os.getenv("FRONTEND_URL").strip()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        logger.info("Starting application initialization...")

        # Initialize Firebase Admin SDK if not already initialized
        if not firebase_admin._apps:
            logger.info("Initializing Firebase Admin SDK...")
            from firebase.firebase_credentials import get_firebase_credentials

            cred = credentials.Certificate(get_firebase_credentials())
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized successfully")

        # MongoDB connection setup - CRITICAL: Will stop app if fails
        logger.info("Initializing MongoDB connection...")
        await DatabaseManager.init_db()
        logger.info("MongoDB connection established successfully")

        if not BYPASS_FIREBASE_SYNC:
            # Sync MongoDB to Firebase
            logger.info("Starting Firebase synchronization...")
            await FirebaseSyncer.SyncDBToFirebase()
            logger.info("Firebase synchronization completed")

        # Verify that an Administrator Role (Mandatory) exists
        logger.info("Verifying administrator role exists...")
        await RoleHandler.verify_admin_role()
        logger.info("Administrator role verification completed")

        if not BYPASS_FIREBASE_SYNC:
            # Sync MongoDB to Firebase
            await FirebaseSyncer.SyncDBToFirebase()

        # Verify that an Administrator Role (Mandatory) exists
        await RoleHandler.verify_admin_role()

        # Run Youtube Notification loop
        logger.info("Starting YouTube subscription monitoring...")
        youtubeSubscriptionCheck = asyncio.create_task(
            YoutubeHelper.youtubeSubscriptionLoop()
        )
        logger.info("YouTube subscription monitoring started")
        
        #Run Push Notification Scheduler loop
        scheduledNotifTask = asyncio.create_task(scheduled_notification_loop(DatabaseManager.db))
        logger.info("Push notification scheduler started")

        logger.info("Application startup completed successfully")
        yield

        # Cleanup
        logger.info("Shutting down application...")
        youtubeSubscriptionCheck.cancel()
        scheduledNotifTask.cancel()
        DatabaseManager.close_db()
        logger.info("Application shutdown completed")

    except Exception as e:
        logger.error(f"Application startup failed: {str(e)}")
        logger.error("Make sure MongoDB is running and the MONGODB_URL is correct")
        # Force exit the application
        import sys
        sys.exit(1)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],  # Get frontend URL from env
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
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
# Dev Router Configuration
#####################################################
router_dev = APIRouter(prefix="/api/v1/dev", tags=["dev"])
# Add Firebase authentication dependency to dev router, needs developer role
router_dev.dependencies.append(Depends(role_based_access(["developer"])))


##for development purposes
@router_dev.post("/auth/token")
async def get_auth_token(credentials: LoginCredentials):
    """Get a Firebase authentication token using email and password"""
    try:
        token = generate_test_token(
            email=credentials.email, password=credentials.password
        )
        if token:
            return {"access_token": token, "token_type": "Bearer"}
        return {"error": "Failed to generate token"}
    except Exception as e:
        return {"error": str(e)}


@router_dev.post("/roles", summary="Update user roles")
async def update_user_roles(role_update: RoleUpdate):
    """
    Add or remove roles for a specified user.

    - **uid**: The user ID to modify
    - **roles**: List of roles to add/remove
    - **remove**: If true, removes the specified roles. If false, adds them.

    Returns:
        dict: Contains status, message, and current roles
    """
    return add_user_role(
        uid=role_update.uid, roles=role_update.roles, remove=role_update.remove
    )


#####################################################
# Declare router middleware/slash permissions for imported routes
#####################################################
strapi_router.dependencies.append(Depends(role_based_access(["strapi_admin"])))


#####################################################
# Grouped Router Declarations
#####################################################
router_webhook_listener = APIRouter(
    prefix="/webhook_listener", tags=["webhook_listener"]
)
router_webhook_listener.include_router(youtube_router)
router_webhook_listener.include_router(paypal_webhook_router)
router_webhook_listener.include_router(paypal_subscription_webhook_router)

#####################################################
# Public Routers - No auth
#####################################################
public_router = APIRouter(prefix="/api/v1")

public_router.include_router(public_event_router)
public_router.include_router(public_event_person_router)
public_router.include_router(public_youtube_router)

#####################################################
# Base Router Configuration all routes will have api/v1 prefix
#####################################################

base_router = AuthProtectedRouter(prefix="/api/v1")
base_router.include_router(permissions_view_router)
base_router.include_router(permissions_protected_router)
base_router.include_router(auth_event_router)
base_router.include_router(user_router)
base_router.include_router(user_private_router)
base_router.include_router(user_mod_router)
base_router.include_router(event_person_router)
base_router.include_router(bible_note_router)
base_router.include_router(bible_plan_router)
base_router.include_router(strapi_router)
base_router.include_router(strapi_protected_router)
base_router.include_router(paypal_admin_router)
base_router.include_router(router_webhook_listener)
base_router.include_router(notification_router)
base_router.include_router(event_router)


non_v1_router = APIRouter(prefix="/api")
non_v1_router.include_router(page_router)
non_v1_router.include_router(header_router)
non_v1_router.include_router(footer_router)
non_v1_router.include_router(paypal_router)


# Include routers in main app
app.include_router(base_router)
app.include_router(non_v1_router)
app.include_router(public_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
