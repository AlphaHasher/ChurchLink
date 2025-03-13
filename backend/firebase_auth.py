import firebase_admin
from firebase_admin import auth, credentials
import os
import base64
import json

# Load Firebase credentials
FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS", "firebase-adminsdk.json")

# Ensure Firebase Admin SDK is initialized only once
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(FIREBASE_CREDENTIALS)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK Initialized Successfully")
    except Exception as e:
        print(f"❌ Firebase Initialization Error: {e}")

def decode_token_manually(id_token):
    """
    Decode the Firebase token manually for debugging purposes.
    """
    try:
        # Decode JWT header and payload
        parts = id_token.split('.')
        header = json.loads(base64.urlsafe_b64decode(parts[0] + '==').decode('utf-8'))
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + '==').decode('utf-8'))
        
        print(f"🛠️ Decoded Token Header: {json.dumps(header, indent=2)}")
        print(f"🛠️ Decoded Token Payload: {json.dumps(payload, indent=2)}")
        
        return payload
    except Exception as e:
        print(f"❌ Error Decoding Token: {e}")
        return None

def verify_firebase_token(id_token: str):
    """
    Verifies the Firebase ID token and returns user details.
    """
    try:
        print(f"🔍 Verifying Token: {id_token[:30]}...")  # Log first 30 chars for security
        
        # Debug: Decode manually first
        decoded_payload = decode_token_manually(id_token)

        # Get the expected Firebase project ID
        expected_audience = firebase_admin.get_app().project_id
        actual_audience = decoded_payload.get("aud")

        print(f"✅ Expected Audience: {expected_audience}")
        print(f"🚨 Received Audience: {actual_audience}")

        # Check if "aud" (Audience) matches the Firebase project ID
        if actual_audience != expected_audience:
            print(f"❌ Error: Token audience mismatch. Expected {expected_audience}, got {actual_audience}")
            return {"error": "Invalid Firebase token (audience mismatch)"}

        # Verify Firebase ID Token with Admin SDK
        decoded_token = auth.verify_id_token(id_token)

        print("✅ Firebase Token Verified Successfully:", decoded_token)
        return decoded_token
    except firebase_admin.auth.ExpiredIdTokenError:
        print("❌ Error: Token Expired")
        return {"error": "Token expired"}
    except firebase_admin.auth.RevokedIdTokenError:
        print("❌ Error: Token Revoked")
        return {"error": "Token revoked"}
    except firebase_admin.auth.InvalidIdTokenError:
        print("❌ Error: Invalid Token")
        return {"error": "Invalid Firebase token"}
    except Exception as e:
        print(f"❌ Unexpected Error in Token Verification: {e}")
        return {"error": "Internal Server Error"}