import requests
import os
from dotenv import load_dotenv
import sys
sys.path.append('.')  # Add project root to path

def generate_test_token(save_to_file=False):
    """
    Get a Firebase ID token using email/password authentication and optionally save to bearer.txt.
    
    Args:
        email (str): Email of the test user
        password (str): Password of the test user
        save_to_file (bool): Whether to save the token to bearer.txt or just return it
    """
    # Load environment variables
    load_dotenv()
    
    # Get Web API Key
    web_api_key = os.getenv("FIREBASE_WEB_API_KEY")
    email = os.getenv("TESTING_AUTH_EMAIL")
    password = os.getenv("TESTING_AUTH_PASSWORD")

    if not web_api_key:
        raise ValueError("FIREBASE_WEB_API_KEY not found in .env file")
    if not email or not password:
        raise ValueError("TESTING_AUTH_EMAIL or TESTING_AUTH_PASSWORD not found in .env file")
    
    try:
        # Sign in with email/password
        sign_in_url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
        sign_in_data = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }
        
        response = requests.post(
            sign_in_url,
            params={"key": web_api_key},
            json=sign_in_data
        )
        response.raise_for_status()
        
        id_token = response.json()["idToken"]
        bearer_token = f"{id_token}"
        
        if save_to_file:
            # Save to bearer.txt
            with open("bearer.txt", "w") as f:
                f.write(bearer_token)
            print("Bearer token has been saved to bearer.txt")
        
        return id_token
        
    except requests.exceptions.HTTPError as e:
        print(f"Authentication failed: {e.response.json()['error']['message']}")
    except Exception as e:
        print(f"Error generating token: {e}")

if __name__ == "__main__":
    generate_test_token(save_to_file=True)