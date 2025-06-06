from mongo.churchuser import UserHandler as User

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
            # Call the update data function if the requested amount of data to update is more than zero
            if len(updateData.items()) > 0:
                await User.update_user(filterQuery, updateData)
            return
        else:
            # If the user doesnt exist locally, create it.
            # TODO Handle "real" name information
            await User.create_user(first_name="Fake", last_name="Name", email=user['email'], uid = user['uid'], roles=[])

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
    # Returns a list of dictionary objects with "email" and "uid" (the parts relevant to MongoDB)
    @staticmethod
    async def fetchFirebaseData():
        users = []
        page = auth.list_users()
        while page:
            for user in page.users:
                users.append({
                    "email": user.email,
                    "uid": user.uid
                })
            page = page.get_next_page()
        return users
    
    # Method that fetches 1 particular user from FireBase
    # Returns a single dictionary object with "email" and "uid"
    @staticmethod
    async def fetchFirebaseUserByUID(uid):
        try:
            user = auth.get_user(uid)
            return {
                "email": user.email,
                "uid": user.uid
            }
        except auth.UserNotFoundError:
            return None
