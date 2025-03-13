from fastapi import FastAPI
from scalar_fastapi import get_scalar_api_reference
from fastapi import APIRouter
from contextlib import asynccontextmanager
import os
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials
import fastapi
from helpers.DB import DB as DatabaseManager
from helpers.Firebase_helpers import role_based_access
from fastapi import Depends


from routes.base_routes.item_routes import user_router as user_router_base

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL")],  # Get frontend URL from env
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




# This are an example we can discuss as a group

#####################################################
# Base Router Configuration
#####################################################
router_base = APIRouter(prefix="/api/v1")
router_base.include_router(user_router_base)


# Add Firebase authentication dependency to base router, needs base role
router_base.dependencies.append(Depends(role_based_access(["base"])))
#####################################################



#####################################################
# Admin Router Configuration 
#####################################################
router_admin = APIRouter(prefix="/api/v1/admin")
router_admin.dependencies.append(Depends(role_based_access(["admin"])))
# router_admin.include_router("import something from routes/admin_routes/")

#####################################################

#####################################################
# Finance Router Configuration
#####################################################
router_finance = APIRouter(prefix="/api/v1/finance")
router_finance.dependencies.append(Depends(role_based_access(["finance"])))
# router_finance.include_router("import something from routes/finance_routes/")

#####################################################







# Include routers in main app
app.include_router(router_base)
app.include_router(router_admin)
app.include_router(router_finance)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
