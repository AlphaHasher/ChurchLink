import asyncio
from database import DB
from roles import RoleHandler as Role
from churchuser import UserHandler as User

async def main():
    # Start
    await DB.init_db()

    ### Testing

    ### Roles
    await Role.create_role("Administrator", ["admin"])
    await Role.create_role("Event Manager", ["page_management", "event_management"])
    await Role.create_role("Event Moderator", [])

    await Role.update_role("Event Manager", ["finance"])
    await Role.update_role("Event Moderator", ["event_management"])

    ### Users
    await User.create_user("fname", "lname", "email", ["Event Manager", "Administrator"], "phone", "birthday", "address", )
    await User.create_user("fname2", "lname2", "email2", ["Administrator"], "phone2", "birthday2", "address2")
    await User.create_user("fname3", "lname3", "email3", ["Event Manager", "Administrator"], "phone3", "birthday3", "address3")

    await User.update_name("email", "fname_updated", "lname_updated")
    await User.update_roles("email", [])


    # End
    DB.close_db()

if __name__ == "__main__":
    asyncio.run(main())