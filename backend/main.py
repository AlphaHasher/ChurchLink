from fastapi import FastAPI, HTTPException, Depends
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import firebase_admin
from firebase_admin import auth, credentials
from firebase_auth import verify_firebase_token
from database import init_db, save_user, get_user
import os
import jwt
import datetime
import json

# Secret key for JWT (change this in production)
JWT_SECRET = os.getenv("JWT_SECRET", "supersecretjwtkey")

# ✅ Load Firebase Admin SDK Credentials
FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS", "firebase-adminsdk.json")
if not firebase_admin._apps:
    cred = credentials.Certificate(FIREBASE_CREDENTIALS)
    firebase_admin.initialize_app(cred)

# ✅ Define Request Model
class RegisterRequest(BaseModel):
    id_token: str


# Initialize database on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()  # Initialize SQLite DB on startup
    yield  # Continue running the app

app = FastAPI(lifespan=lifespan)


# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic model for Firebase token request
class FirebaseTokenRequest(BaseModel):
    id_token: str

def create_jwt(uid: str, email: str, role: str):
    """
    Generates a JWT for authenticated users.
    """
    payload = {
        "uid": uid,
        "email": email,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=1)  # Expires in 1 day
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_jwt(token: str):
    """
    Verifies the JWT token.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")



from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import firebase_admin
from firebase_admin import auth, credentials
import traceback  # For printing full error logs

# Initialize Firebase (only once)
if not firebase_admin._apps:
    cred = credentials.Certificate("path/to/serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

app = FastAPI()

class RegisterRequest(BaseModel):
    id_token: str

@app.post("/auth/register")
async def register_user(data: RegisterRequest):
    """
    Registers a new user using Firebase ID Token.
    """
    try:
        print("🔍 Verifying Firebase ID Token...")

        # ✅ Verify Firebase ID Token
        decoded_token = auth.verify_id_token(data.id_token)
        print("✅ Token Verified:", decoded_token)

        uid = decoded_token.get("uid")
        email = decoded_token.get("email")

        # ✅ Ensure UID and Email Exist
        if not uid or not email:
            raise HTTPException(status_code=400, detail="Invalid token: missing UID or Email.")

        print(f"✅ User Registered: {email} (UID: {uid})")

        # ✅ Generate a backend JWT token
        backend_token = create_jwt(uid, email, "user")  # Default role: "user"

        return {
            "message": "User registered successfully",
            "email": email,
            "token": backend_token,  # ✅ Ensure token is returned to frontend
        }

    except auth.ExpiredIdTokenError:
        print("❌ Expired Firebase Token.")
        raise HTTPException(status_code=401, detail="Expired Firebase token.")

    except auth.InvalidIdTokenError:
        print("❌ Invalid Firebase ID Token.")
        raise HTTPException(status_code=401, detail="Invalid Firebase token.")

    except Exception as e:
        print("❌ Backend Error:", e)
        traceback.print_exc()  # 🔍 Print full error log
        raise HTTPException(status_code=500, detail=str(e))
    
    
# ✅ Sign-In with Email/Password
@app.post("/auth/email")
async def email_signin(data: FirebaseTokenRequest):
    """
    Signs in a user with Firebase ID Token.
    """
    decoded_token = verify_firebase_token(data.id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    uid = decoded_token["uid"]
    user = await get_user(uid)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate JWT for session authentication
    jwt_token = create_jwt(uid, user["email"], user["role"])
    return {"token": jwt_token}

# Google Sign-In Endpoint
@app.post("/auth/google")
async def google_signin(data: FirebaseTokenRequest):
    """
    Handles Google Sign-In using Firebase.
    """
    id_token = data.id_token
    if not id_token:
        raise HTTPException(status_code=400, detail="Missing ID token")

    # Verify Firebase Token
    decoded_token = verify_firebase_token(data.id_token)
    if isinstance(decoded_token, dict) and "error" in decoded_token:
        print("❌ Backend Token Verification Failed:", json.dumps(decoded_token))
        raise HTTPException(status_code=401, detail=decoded_token["error"])

    #Extract user details
    uid = decoded_token["uid"]
    email = decoded_token.get("email", "")
    display_name = decoded_token.get("name", "No Name")


    print(f"✅ Google Sign-In Success: {email}")

    # Save user to SQLite
    await save_user(uid, email, display_name, role="user")

    # Generate JWT for session authentication
    jwt_token = create_jwt(uid, email, "user")
    return {"token": jwt_token}

# Protected Route (Requires JWT)
@app.get("/user")
async def get_user_info(token: str = Depends(verify_jwt)):
    """
    Fetches user information from SQLite.
    """
    user = await get_user(token["uid"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Update user role
@app.patch("/user/role")
async def update_user_role(uid: str, new_role: str, token: str = Depends(verify_jwt)):
    """
    Updates the user role (admin or user).
    """
    if token["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can change roles")

    async with aiosqlite.connect("users.db") as db:
        await db.execute("UPDATE users SET role = ? WHERE uid = ?", (new_role, uid))
        await db.commit()

    return {"message": f"User {uid} role updated to {new_role}"}

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)