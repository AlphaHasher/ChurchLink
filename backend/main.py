from fastapi import FastAPI, APIRouter, Depends
from scalar_fastapi import get_scalar_api_reference
from contextlib import asynccontextmanager
import os
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials
from mongo.database import DB as DatabaseManager
from helpers.Firebase_helpers import role_based_access
from helpers.youtubeHelper import YoutubeHelper
from get_bearer_token import generate_test_token
from pydantic import BaseModel
from routes.base_routes.item_routes import item_router as item_router_base
from routes.webhook_listener_routes.youtube_listener_routes import youtube_router as youtube_router
from routes.strapi_routes.strapi_routes import strapi_router as strapi_router
from add_roles import add_user_role, RoleUpdate
import asyncio
from routes.page_management_routes.page_routes import router as page_route


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Firebase Admin SDK if not already initialized
    if not firebase_admin._apps:
        from firebase.firebase_credentials import get_firebase_credentials
        cred = credentials.Certificate(get_firebase_credentials())
        firebase_admin.initialize_app(cred)

    # MongoDB connection setup
    await DatabaseManager.init_db()

    # Run Youtube Notification loop
    youtubeSubscriptionCheck = asyncio.create_task(YoutubeHelper.youtubeSubscriptionLoop())

    yield

    # Cleanup
    youtubeSubscriptionCheck.cancel()
    DatabaseManager.close_db()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL")],  # Get frontend URL from env
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

#####################################################
# Page Builder Router
#####################################################
app.include_router(page_route)


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
            email=credentials.email,
            password=credentials.password
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
        uid=role_update.uid,
        roles=role_update.roles,
        remove=role_update.remove
    )




# This are an example we can discuss as a group

#####################################################
# Base Router Configuration
#####################################################
router_base = APIRouter(prefix="/api/v1", tags=["base"])
# Add Firebase authentication dependency to base router, needs base role
router_base.dependencies.append(Depends(role_based_access(["base"])))
router_base.include_router(item_router_base)



#####################################################



#####################################################
# Admin Router Configuration
#####################################################
router_admin = APIRouter(prefix="/api/v1/admin", tags=["admin"])
router_admin.dependencies.append(Depends(role_based_access(["admin"])))
# router_admin.include_router("import something from routes/admin_routes/")

#####################################################

#####################################################
# Finance Router Configuration
#####################################################
router_finance = APIRouter(prefix="/api/v1/finance", tags=["finance"])
router_finance.dependencies.append(Depends(role_based_access(["finance"])))
# router_finance.include_router("import something from routes/finance_routes/")

#####################################################


#####################################################
# Webhook Listener Router Config
#####################################################
router_webhook_listener = APIRouter(prefix="/api/v1/webhook_listener", tags=["base"])
router_webhook_listener.include_router(youtube_router)


#####################################################
# Strapi Router Config
#####################################################
router_strapi = APIRouter(prefix="/api/v1/strapi", tags=["strapi"])
router_strapi.include_router(strapi_router)
router_strapi.dependencies.append(Depends(role_based_access(["strapi_admin"])))


# Include routers in main app
app.include_router(router_base)
app.include_router(router_admin)
app.include_router(router_finance)
app.include_router(router_webhook_listener)
app.include_router(router_strapi)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)