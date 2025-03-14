from fastapi import FastAPI
from scalar_fastapi import get_scalar_api_reference
from fastapi import APIRouter
from contextlib import asynccontextmanager
import os
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, auth
import fastapi
from helpers.DB import DB as DatabaseManager
from helpers.Firebase_helpers import role_based_access
from fastapi import FastAPI, Depends
from fastapi.security import HTTPBearer
from get_bearer_token import generate_test_token
from pydantic import BaseModel
from routes.base_routes.item_routes import item_router as item_router_base
from add_roles import add_user_role, RoleUpdate



@asynccontextmanager
async def lifespan(app: fastapi.FastAPI):
    # Initialize Firebase Admin SDK if not already initialized
    if not firebase_admin._apps:
        from firebase.firebase_credentials import get_firebase_credentials
        cred = credentials.Certificate(get_firebase_credentials())
        firebase_admin.initialize_app(cred)

    # MongoDB connection setup
    DatabaseManager.init_db()

    yield

    # Cleanup
    DatabaseManager.close_db()

app = FastAPI(lifespan=lifespan)
security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL")],  # Get frontend URL from env
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)


class RegisterRequest(BaseModel):
    id_token: str


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







# Include routers in main app
app.include_router(router_base)
app.include_router(router_admin)
app.include_router(router_finance)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
