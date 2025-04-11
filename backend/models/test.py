import asyncio
from mongo.database import DB
# Import new models and functions
from models.roles import RoleCreate, create_role, update_role, get_role_by_name, get_roles_with_permissions, create_permission_list
from models.churchuser import UserCreate, create_user, update_user_roles, find_users_with_role_id, find_users_with_permissions
from pydantic import EmailStr
from datetime import datetime # Needed for potential birthday field

async def main():
    # Start
    await DB.init_db()

    print("--- Testing Roles ---")
    ### Roles
    # Creates roles with perms
    admin_role_data = RoleCreate(name="Administrator", permissions=create_permission_list(["admin"]))
    await create_role(admin_role_data)

    accountant_role_data = RoleCreate(name="Accountant", permissions=create_permission_list(["finance"]))
    await create_role(accountant_role_data)

    event_manager_role_data = RoleCreate(name="Event Manager", permissions=create_permission_list(["page_management", "event_management"]))
    event_manager_role = await create_role(event_manager_role_data)

    # Create role then add perms
    event_mod_role_data = RoleCreate(name="Event Moderator", permissions=create_permission_list([]))
    event_mod_role = await create_role(event_mod_role_data)
    if event_mod_role:
        update_payload = RoleCreate(name="Event Moderator", permissions=create_permission_list(["event_management"]))
        await update_role(event_mod_role.id, update_payload)

    # Overwrite role perms
    if event_manager_role:
        update_payload_overwrite = RoleCreate(name="Event Manager", permissions=create_permission_list(["event_management", "finance"]))
        await update_role(event_manager_role.id, update_payload_overwrite)

    print("--- Testing Users ---")
    ### Users
    # Note: UserCreate expects 'roles' as a list of role names
    user1_data = UserCreate(
        first_name="fname", last_name="lname", email=EmailStr("email@example.com"), 
        roles=["Event Manager", "Administrator"], # Pass names
        phone="1234567890", birthday=datetime(1990, 1, 1)
        # address field uses default empty schema if not provided
    )
    await create_user(user1_data)

    user2_data = UserCreate(
        first_name="fname2", last_name="lname2", email=EmailStr("email2@example.com"), 
        roles=["Administrator"]
    )
    await create_user(user2_data)

    user3_data = UserCreate(
        first_name="fname3", last_name="lname3", email=EmailStr("email3@example.com"), 
        roles=["Accountant"]
    )
    await create_user(user3_data)

    # Update user roles
    await update_user_roles(EmailStr("email@example.com"), ["Administrator"]) # Pass email and list of role names

    print("--- Testing Finding ---")
    ### Finding
    admin_role_obj = await get_role_by_name("Administrator")
    if admin_role_obj:
        admin_users = await find_users_with_role_id(admin_role_obj.id)
        print(f"Administrator users: {admin_users}\n")
    else:
        print("Administrator role not found for user search.\n")

    admin_perm_users = await find_users_with_permissions(["admin"])
    print(f"Users with admin permission: {admin_perm_users}\n")

    event_roles = await get_roles_with_permissions(["event_management"])
    print(f"Roles with event_management permission: {event_roles}\n")

    # End
    DB.close_db()

if __name__ == "__main__":
    asyncio.run(main())