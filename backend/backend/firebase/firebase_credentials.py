import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def get_firebase_credentials():
    """
    Load Firebase credentials from a JSON file.
    
    Returns:
        dict: Firebase credentials dictionary 
    """
    credentials_path = os.path.join(os.path.dirname(__file__), "firebase_credentials.json")
    with open(credentials_path, "r") as f:
        credentials = json.load(f)
    
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