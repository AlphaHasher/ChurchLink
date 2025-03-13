import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def get_firebase_credentials():
    """
    Generate Firebase credentials from environment variables.
    
    Returns:
        dict: Firebase credentials dictionary 
    """
    # Create a dictionary with Firebase credentials
    credentials = {
        "type": os.getenv("FIREBASE_TYPE"),
        "project_id": os.getenv("FIREBASE_PROJECT_ID"),
        "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
        "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n"),  # Fix multiline key
        "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
        "client_id": os.getenv("FIREBASE_CLIENT_ID"),
        "auth_uri": os.getenv("FIREBASE_AUTH_URI"),
        "token_uri": os.getenv("FIREBASE_TOKEN_URI"),
        "auth_provider_x509_cert_url": os.getenv("FIREBASE_AUTH_PROVIDER_X509_CERT_URL"),
        "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_X509_CERT_URL"),
        "universe_domain": os.getenv("FIREBASE_UNIVERSE_DOMAIN")
    }
    
    return credentials

def save_temp_credentials_file():
    """
    Save Firebase credentials to a temporary JSON file.
    
    Returns:
        str: Path to the temporary credentials file
    """
    # Get credentials
    credentials = get_firebase_credentials()
    
    # Save to temporary file
    temp_file_path = os.path.join(os.path.dirname(__file__), "temp_credentials.json")
    with open(temp_file_path, "w") as f:
        json.dump(credentials, f, indent=2)
    
    return temp_file_path