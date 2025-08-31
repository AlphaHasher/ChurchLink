import httpx
import os
import logging
from dotenv import load_dotenv
from fastapi import HTTPException
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

STRAPI_URL = os.getenv("STRAPI_URL", "")
STRAPI_API_KEY = os.getenv("STRAPI_API_KEY", "")
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "")

MEDIA_LIBRARY_PATH = "/admin/plugins/upload"
cached_admin_token = None

class StrapiHelper:

    async def get_admin_token() -> str:
        global cached_admin_token
        logger.debug("Attempting to get Strapi admin token")

        # If we already have a token, validate it
        if cached_admin_token:
            logger.debug("Validating cached admin token")
            is_valid = await StrapiHelper.is_token_valid(cached_admin_token)
            if is_valid:
                logger.debug("Cached token is valid, reusing")
                return cached_admin_token

        # Otherwise, log in again
        url = f"{STRAPI_URL}/admin/login"
        payload = {
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        }
        headers = { "Content-Type": "application/json" }

        logger.debug(f"Authenticating with Strapi admin at: {url}")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload, headers=headers)

            logger.debug(f"Strapi login response status: {res.status_code}")

            if res.status_code != 200:
                logger.error(f"Strapi admin login failed with status {res.status_code}")
                logger.error(f"Response body: {res.text}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Strapi authentication failed (status {res.status_code}): {res.text}"
                )

            data = res.json()
            if "data" not in data or "token" not in data["data"]:
                logger.error("Strapi login response missing token data")
                logger.error(f"Response: {data}")
                raise HTTPException(
                    status_code=500,
                    detail="Invalid Strapi authentication response: missing token data"
                )

            cached_admin_token = data["data"]["token"]
            logger.info("Successfully obtained new Strapi admin token")
            return cached_admin_token

        except httpx.TimeoutException:
            logger.error("Timeout while connecting to Strapi admin login")
            raise HTTPException(
                status_code=500,
                detail="Timeout connecting to Strapi admin service"
            )
        except httpx.ConnectError as e:
            logger.error(f"Connection error to Strapi: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Cannot connect to Strapi admin service: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Unexpected error during Strapi authentication: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error during Strapi authentication: {str(e)}"
            )
    
    # Test to see if token valid
    async def is_token_valid(token: str) -> bool:
        url = f"{STRAPI_URL}/admin/users/me"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers)
                return res.status_code == 200
        except Exception:
            return False

    async def does_strapi_user_exist(email: str, token: str, skipInvite :bool=False) -> dict:
        logger.debug(f"Checking if Strapi user exists: {email}")
        retDict = {
            'exists': False,
            'active': False,
            'invite_url': None,
            'id': None,
            'current_roles':[]
        }

        url = f"{STRAPI_URL}/admin/users"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.get(url, headers=headers)

            logger.debug(f"Strapi users query response status: {res.status_code}")

            if res.status_code != 200:
                logger.error(f"Failed to query Strapi users (status {res.status_code}): {res.text}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to query Strapi users (status {res.status_code}): {res.text}"
                )

            users = res.json()
            logger.debug(f"Retrieved {len(users.get('data', {}).get('results', []))} users from Strapi")

        except httpx.TimeoutException:
            logger.error("Timeout while querying Strapi users")
            raise HTTPException(
                status_code=500,
                detail="Timeout connecting to Strapi while querying users"
            )
        except httpx.ConnectError as e:
            logger.error(f"Connection error to Strapi: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Cannot connect to Strapi service: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Unexpected error querying Strapi users: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error while querying Strapi users: {str(e)}"
            )

        for user in users['data']['results']:
            if user['email'].lower() == email.lower():
                user_id = user["id"]
                retDict['id'] = user_id
                retDict['exists'] = True
                is_active = user.get("isActive", False)
                retDict['active'] = is_active

                # If user is inactive and a registration token exists, trash the user and send a new invite
                if not is_active:
                    mongo_query = await UserHandler.find_by_email(email)
                    if len(mongo_query) == 0:
                        raise HTTPException(status_code=500, detail="Failed to identify mongo user")
                    mongo_user = mongo_query[0]
                    first_name = mongo_user['first_name']
                    last_name = mongo_user['last_name']
                    uid = mongo_user['uid']

                    await StrapiHelper.delete_strapi_user(user_id, token)

                    if skipInvite:
                        break

                    invite_url = await StrapiHelper.invite_strapi_user(email, first_name, last_name, uid)
                    retDict['invite_url'] = invite_url

                retDict['current_roles'] = [role['id'] for role in user.get('roles', [])]
                break  # no need to continue loop after match

        return retDict
    
    async def delete_strapi_user(user_id: int, token: str) -> None:
        url = f"{STRAPI_URL}/admin/users/{user_id}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            res = await client.delete(url, headers=headers)

        if res.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete Strapi user (status {res.status_code}): {res.text}"
            )

    async def invite_strapi_user(email: str, first_name: str, last_name: str, uid:str) -> str:
        logger.info(f"Creating Strapi invitation for user: {email} (UID: {uid})")

        try:
            token = await StrapiHelper.get_admin_token()
        except Exception as e:
            logger.error(f"Failed to get admin token for user invitation: {str(e)}")
            raise

        url = f"{STRAPI_URL}/admin/users"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        try:
            # Choose your Strapi role ID or name
            logger.debug(f"Getting role IDs for user {email}")
            role_ids = await StrapiHelper.get_admin_role_ids(token)
            roles = await StrapiHelper.gather_proper_permissions(role_ids, uid)
            logger.debug(f"Assigned roles for {email}: {roles}")

            payload = {
                "email": email,
                "firstname": first_name,
                "lastname": last_name,
                "roles": roles,
            }

            logger.debug(f"Creating Strapi user invitation with payload: {payload}")

            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload, headers=headers)

            logger.debug(f"Strapi user creation response status: {res.status_code}")

            if res.status_code not in (200, 201):
                logger.error(f"Failed to create Strapi user (status {res.status_code}): {res.text}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to create Strapi user invitation (status {res.status_code}): {res.text}"
                )

            data = res.json()
            logger.debug(f"Strapi user creation response: {data}")

            invitation_token = data.get("data", {}).get("registrationToken")

            if not invitation_token:
                logger.error("Strapi user creation response missing registration token")
                logger.error(f"Full response: {data}")
                raise HTTPException(
                    status_code=500,
                    detail="Strapi user creation succeeded but no registration token was returned"
                )

            # Build the redirect URL (this is the default path for admin invites)
            invite_url = f"{STRAPI_URL}/admin/auth/register?registrationToken={invitation_token}"
            logger.info(f"Successfully created invitation URL for {email}: {invite_url}")
            return invite_url

        except httpx.TimeoutException:
            logger.error(f"Timeout while creating Strapi user invitation for {email}")
            raise HTTPException(
                status_code=500,
                detail=f"Timeout creating Strapi user invitation for {email}"
            )
        except httpx.ConnectError as e:
            logger.error(f"Connection error while creating Strapi user for {email}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Cannot connect to Strapi while creating user invitation: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Unexpected error creating Strapi user invitation for {email}: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error while creating Strapi user invitation for {email}: {str(e)}"
            )

    async def get_admin_role_ids(token: str) -> dict:
        url = f"{STRAPI_URL}/admin/roles"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers)

        if res.status_code != 200:
            return {}
        
        data = res.json()['data']
        role_dict = {}
        for role in data:
            role_dict[role['name']] = role['id']
        return role_dict

    async def gather_proper_permissions(admin_roles, uid):
        mongo_user = await UserHandler.find_by_uid(uid)
        if mongo_user is None:
            raise HTTPException(status_code=500, detail="Failed to identify mongo user")

        returned_roles = [admin_roles['default-role']]

        user_roles = mongo_user['roles']
        user_permissions = await RoleHandler.infer_permissions(user_roles)

        if user_permissions['media_management'] or user_permissions['admin']:
            returned_roles.append(admin_roles['media-management'])

        return returned_roles
    
    async def sync_strapi_roles(uid):
        mongo_user = await UserHandler.find_by_uid(uid)
        if mongo_user is None:
            return False

        email = mongo_user['email']
        token = await StrapiHelper.get_admin_token()

        # Check to see if active strapi user exists
        strapiUserExists = await StrapiHelper.does_strapi_user_exist(email, token, True)
        if strapiUserExists['active']:
            
            # Strapi User would be trashed if this is not true, so from here on out we assume we have a strapi user
            user_roles = mongo_user['roles']
            strapi_user_id = strapiUserExists['id']
            if user_roles == []:
                # If the user has no roles, we want to execute order 66 on their StrapiAccount because they no longer have permissions.
                await StrapiHelper.delete_strapi_user(strapi_user_id, token)
            else:
                # If the user still has some roles, we want to retain their account but update it
                admin_roles = await StrapiHelper.get_admin_role_ids(token)
                update_roles = await StrapiHelper.gather_proper_permissions(admin_roles, mongo_user['uid'])
                if sorted(update_roles) != sorted(strapiUserExists['current_roles']):
                    await StrapiHelper.update_strapi_user_roles(strapi_user_id, update_roles, token)
            
        return True
            
    @staticmethod
    async def update_strapi_user_roles(user_id: int, role_ids: list[int], token: str) -> None:
        url = f"{STRAPI_URL}/admin/users/{user_id}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        payload = {
            "roles": role_ids
        }

        async with httpx.AsyncClient() as client:
            res = await client.put(url, json=payload, headers=headers)

        if res.status_code not in (200, 201):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to update roles for Strapi user {user_id}: {res.text}"
            )
        

    # This one requires API token
    @staticmethod
    async def search_uploads_by_name(query: str) -> list:

        params = {
            "filters[name][$containsi]": query
        }

        headers = {
            "Authorization": f"Bearer {STRAPI_API_KEY}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{STRAPI_URL}/api/upload/files",
                headers=headers,
                params=params
            )

        if res.status_code != 200:
            print(res)
            raise HTTPException(
                status_code=res.status_code,
                detail="Failed to search uploads by name from Strapi"
            )

        return res.json()
    