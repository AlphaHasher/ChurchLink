import firebase_admin
from firebase_admin import credentials, auth
import argparse
from typing import List
from pydantic import BaseModel

class RoleUpdate(BaseModel):
    uid: str
    roles: List[str]
    remove: bool = False

def add_user_role(uid: str, roles: List[str], remove: bool = False) -> dict:
    """
    Add or remove roles from a user's custom claims in Firebase Auth.
    
    Args:
        uid: The user ID to modify
        roles: List of roles to add/remove
        remove: If True, removes the specified roles instead of adding them
    
    Returns:
        dict: Response containing status and current roles
    """
    try:
        # Initialize Firebase Admin SDK if not already initialized
        if not firebase_admin._apps:
            from firebase.firebase_credentials import get_firebase_credentials
            cred = credentials.Certificate(get_firebase_credentials())
            firebase_admin.initialize_app(cred)

        # Get current user and their claims
        user = auth.get_user(uid)
        current_claims = user.custom_claims or {}
        current_roles = set(current_claims.get('roles', []))

        # Add or remove the specified roles
        if remove:
            current_roles = current_roles - set(roles)
            action = "removed from"
        else:
            current_roles = current_roles.union(set(roles))
            action = "added to"

        # Update the claims
        new_claims = {**current_claims, 'roles': list(current_roles)}
        auth.set_custom_user_claims(uid, new_claims)
        
        response = {
            "status": "success",
            "message": f"Roles {roles} have been {action} user {uid}",
            "current_roles": list(current_roles)
        }
        
        # Print if running from CLI
        if __name__ == "__main__":
            print(f"Success: {response['message']}")
            print(f"Current roles: {response['current_roles']}")
            
        return response
    
    except auth.UserNotFoundError:
        error_msg = f"Error: User {uid} not found"
        if __name__ == "__main__":
            print(error_msg)
        return {"status": "error", "message": error_msg}
    except Exception as e:
        error_msg = f"Error: Failed to modify user roles. {str(e)}"
        if __name__ == "__main__":
            print(error_msg)
        return {"status": "error", "message": error_msg}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Modify user roles in Firebase')
    parser.add_argument('uid', help='User ID to modify')
    parser.add_argument('roles', nargs='+', help='Roles to add/remove')
    parser.add_argument('--remove', action='store_true', help='Remove roles instead of adding them')
    
    args = parser.parse_args()
    add_user_role(args.uid, args.roles, args.remove)