from mongo.churchuser import UserHandler as User
from mongo.roles import RoleHandler
from helpers.StrapiHelper import StrapiHelper

from firebase_admin import auth


class FirebaseSyncer:

    # Method that pulls database from FireBase and inserts users into MongoDB
    @staticmethod
    async def SyncDBToFirebase():
        users = await FirebaseSyncer.fetchFirebaseData()
        for user in users:
            await FirebaseSyncer.syncUser(user)
            


    # Method that syncs the database from an individual firebase user
    # Input is a dictionary, expects you already fetched the proper data
    @staticmethod
    async def syncUser(user):
        # Check if user already exists
        checkUser = await User.find_by_uid(user['uid'])
        if checkUser:
            # If user exists, pre-empt an update by creating a filterQuery for a document where UID matches
            filterQuery = {"uid": user['uid']}
            # Create empty updateData dict
            updateData = {}
            # If the email is incorrect in our local database, add it to the data update
            if checkUser['email'] != user['email']:
                updateData['email'] = user['email']
            # If the user now has google ensure they are verified
            if (user['has_google'] or user['email_verified']) and not checkUser['verified']:
                updateData['verified'] = True
            # Call the update data function if the requested amount of data to update is more than zero
            if len(updateData.items()) > 0:
                await User.update_user(filterQuery, updateData)

            # Auto-assign admin role to admin@testing.com (even for updates)
            if user['email'] == 'admin@testing.com':
                await FirebaseSyncer.assign_admin_role(user['uid'])
            return
        else:
            await User.create_user(first_name="Fake", last_name="Name", email=user['email'], uid = user['uid'], roles=[], verified=(user['has_google'] or user['email_verified']))

            # Auto-assign admin role to admin@testing.com
            if user['email'] == 'admin@testing.com':
                await FirebaseSyncer.assign_admin_role(user['uid'])

    # Method that syncs one particular user only by a requested UID
    @staticmethod
    async def syncUserByUID(uid):
        user = await FirebaseSyncer.fetchFirebaseUserByUID(uid)
        if user != None:
            await FirebaseSyncer.syncUser(user)
            checkUser = await User.find_by_uid(user['uid'])
            return checkUser
        else:
            return None



    # Method that fetches the users from FireBase
    # Returns a list of dictionary objects with "email", "uid", "has_google", and "email_verified"
    @staticmethod
    async def fetchFirebaseData():
        users = []
        page = auth.list_users()
        while page:
            for user in page.users:
                has_google = any(
                    (info.provider_id == "google.com")
                    for info in (user.provider_data or [])
                )
                users.append({
                    "email": user.email,
                    "uid": user.uid,
                    "has_google": has_google,
                    "email_verified": bool(user.email_verified),
                })
            page = page.get_next_page()
        return users

    # Method that fetches 1 particular user from FireBase
    # Returns a single dictionary object with "email", "uid", "has_google", and "email_verified"
    @staticmethod
    async def fetchFirebaseUserByUID(uid):
        try:
            user = auth.get_user(uid)  # firebase_admin.auth.UserRecord
            has_google = any(
                (info.provider_id == "google.com")
                for info in (user.provider_data or [])
            )
            return {
                "email": user.email,
                "uid": user.uid,
                "has_google": has_google,
                "email_verified": bool(user.email_verified),
            }
        except auth.UserNotFoundError:
            return None

    @staticmethod
    async def safe_strapi_sync(uid_param):
        """Safe Strapi sync that doesn't fail if Strapi is unavailable"""
        try:
            return await StrapiHelper.sync_strapi_roles(uid_param)
        except Exception as e:
            print(f"Strapi sync failed for user {uid_param}: {e}")
            print("Continuing without Strapi sync...")
            return True  # Return True to indicate MongoDB update was successful

    @staticmethod
    async def assign_admin_role(uid: str):
        """Assign admin role to a specific user"""
        try:
            # Get admin role ID
            admin_role_id = await RoleHandler.find_role_id("Administrator")
            if not admin_role_id:
                print("Error finding admin role")
                return False

            # Update user roles in MongoDB with a safe Strapi sync function
            admin_role_id_str = str(admin_role_id)
            success = await User.update_roles(uid, [admin_role_id_str], FirebaseSyncer.safe_strapi_sync)

            if success:
                return True
            else:
                print("Error updating user roles")
                return False

        except Exception as e:
            print(f"Error assigning admin role: {e}")
            return False


