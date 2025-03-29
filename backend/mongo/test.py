import asyncio
from database import DB
from roles import RoleHandler as Role
from churchuser import UserHandler as User

async def main():
    # Start
    await DB.init_db()

    ### Testing

    ### Roles
    # Creates roles with perms
    await Role.create_role("Administrator", ["admin"])
    await Role.create_role("Accountant", ["finance"])
    await Role.create_role("Event Manager", ["page_management", "event_management"])

    # Create role then add perms
    await Role.create_role("Event Moderator", [])
    await Role.update_role("Event Moderator", ["event_management"])

    # Overwrite role perms
    await Role.update_role("Event Manager", ["event_management", "finance"])


    ### Users
    await User.create_user("fname", "lname", "email", ["Event Manager", "Administrator"], "phone", "birthday", "address", )
    await User.create_user("fname2", "lname2", "email2", ["Administrator"], "phone2", "birthday2", "address2")
    await User.create_user("fname3", "lname3", "email3", ["Accountant"], "phone3", "birthday3", "address3")

    await User.update_roles("email", ["Administrator"])

    ### Finding
    print(f"Administrator users: {await User.find_users_with_role_id(
        await Role.find_role_id("Administrator")
    )}\n")

    print(f"Admin users: {await User.find_users_with_permissions(["admin"])}\n")

    print(f"Event roles: {await Role.find_roles_with_permissions(["event_management"])}\n")

    # End
    DB.close_db()

if __name__ == "__main__":
    asyncio.run(main())