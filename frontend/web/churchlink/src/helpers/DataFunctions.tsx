import { AccountPermissions, PermMask, PermComp } from "@/types/AccountPermissions";
import { BaseUserMask, UserInfo, UserPermMask } from "@/types/UserInfo";

// Function to transform a UserInfo type object to a UserPermMask
const transformToUserPermMask = (user: UserInfo, allPerms: AccountPermissions[]): UserPermMask => {
    // Collect ALL of the Roles that the user actually has.
    const roles = allPerms.filter(role => user.permissions.includes(role.name));

    // Initialize a collection of Permissions with all perm bools to false
    const permissions: PermMask = Object.keys(allPerms[0]).reduce((acc, key) => {
        // Type casting here to ensure `key` is a valid key of PermMask
        if (key !== "name") {  // Skip the "name" key since it's not part of PermMask
            acc[key as keyof PermMask] = false;
        }
        return acc;
    }, {} as PermMask);

    // Perform the logical OR operation on each permission field for the selected roles
    roles.forEach(role => {
        Object.keys(role).forEach((key) => {
            if (key !== "name") {
                permissions[key as keyof PermMask] = permissions[key as keyof PermMask] || Boolean(role[key as keyof AccountPermissions]);
            }
        });
    });

    // Return the transformed data as UserPermMask
    return {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        ...permissions,
    };
};

// Function to apply the UserPermMask transformation
export function applyUserPermLogicMask(inputData: UserInfo[], allPerms: AccountPermissions[]) {
    // Filter users with permissions and transform them into UserPermMask
    const initialData = inputData.filter(user => user.permissions.length > 0);
    const data = initialData.map(user => transformToUserPermMask(user, allPerms));
    return data;
};

//Function to apply the RoleMemberMask transformation
export function applyRoleMemberMask(inputData: UserInfo[], roleID: string) {
    return inputData
        .filter(user => user.permissions.includes(roleID))
        .map(user => ({
            name: `${user.firstName} ${user.lastName}`,
            email: user.email
        }));
};

//Function to apply the BaseUserMask transformation
export function applyBaseUserMask(inputData: UserInfo[]) {
    return inputData
        .map(user => ({
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            dateOfBirth: user.dateOfBirth.toISOString().split('T')[0].replace(/-/g, '/'), // Convert Date to YYYY/MM/DD
            permissions: user.permissions.length > 0 ? user.permissions.join(', ') : 'N/A' // Convert to CSV or 'N/A'
        }));
};

//Functions to get every single role name in an array
export function getRoleOptions(inputData: AccountPermissions[]): string[] {
    return inputData.map(permission => permission.name);
};

//Functions to recover role string array from string
export function recoverRoleArray(inputData: BaseUserMask): string[] {
    const permissions = inputData.permissions;

    // If permissions contain "N/A", return an empty array
    if (permissions === "N/A") {
        return [];
    }

    // Otherwise, split the permissions string into an array by ", " separator
    return permissions.split(", ").filter(Boolean);  // filter(Boolean) removes any empty strings
};


export function createPermComps(startRoles: string[], endRoles: string[], roleDefs: AccountPermissions[]): PermComp[] {
    // Helper function to get permissions dynamically from the roleDefs
    const getPermissionsForRoles = (roles: string[]): PermMask => {
        // Initialize the permissions with all fields set to false
        const permissions: PermMask = Object.keys(roleDefs[0]).reduce((acc, key) => {
            // Skip the "name" field as it's not part of PermMask
            if (key !== "name") {
                acc[key as keyof PermMask] = false;
            }
            return acc;
        }, {} as PermMask);

        // For each role in the roles array, check if the role has permissions
        roles.forEach((role) => {
            const roleDef = roleDefs.find((def) => def.name === role);
            if (roleDef) {
                // Perform OR operation on each permission field for the found role
                Object.keys(roleDef).forEach((key) => {
                    if (key !== "name") {
                        permissions[key as keyof PermMask] = permissions[key as keyof PermMask] || Boolean(roleDef[key as keyof AccountPermissions]);
                    }
                });
            }
        });

        return permissions;
    };

    // Create PermComp for startRoles (Before)
    const startComp: PermComp = {
        status: "Before",
        roles: startRoles.join(", "),
        ...getPermissionsForRoles(startRoles),
    };

    // Create PermComp for endRoles (After)
    const endComp: PermComp = {
        status: "After",
        roles: endRoles.join(", "),
        ...getPermissionsForRoles(endRoles),
    };

    return [startComp, endComp];
};


