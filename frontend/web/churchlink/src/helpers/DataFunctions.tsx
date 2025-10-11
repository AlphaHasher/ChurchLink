import { AccountPermissions, PermMask, PermComp } from "@/shared/types/AccountPermissions";
import { BaseUserMask, UserInfo, UserPermMask } from "@/shared/types/UserInfo";
import { ChurchEvent } from "@/shared/types/ChurchEvent";

export function getDisplayValue(value: any, key: any): string {
    if (typeof value === "boolean") {
        return value ? "✅Yes" : "❌No";
    }

    if (typeof value === "string") {
        if (key === "date") {
            try {
                const parsedDate = new Date(value);
                if (!isNaN(parsedDate.getTime())) {
                    const year = parsedDate.getFullYear();
                    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
                    const day = String(parsedDate.getDate()).padStart(2, "0");
                    return `${year}/${month}/${day}`;
                }
            } catch {
                // fall through
            }
        }
        // Capitalize recurring/gender fields
        if (key === "recurring" || key === "gender") {
            return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
        }

        return value;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return "N/A";
        return `[${value.join(", ")}]`;
    }

    if (value === null || value === undefined) {
        return "N/A";
    }

    return String(value);
};

// Function to transform a UserInfo type object to a UserPermMask
const transformToUserPermMask = (user: UserInfo, allPerms: AccountPermissions[]): UserPermMask => {
    // Collect ALL of the Roles that the user actually has.
    const roles = allPerms.filter(role => roleIdListToRoleStringList(allPerms, user.permissions).includes(role.name));

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
export function applyRoleMemberMask(inputData: UserInfo[], allPerms: AccountPermissions[], roleID: string) {
    return inputData
        .filter(user => roleIdListToRoleStringList(allPerms, user.permissions).includes(roleID))
        .map(user => ({
            name: `${user.firstName} ${user.lastName}`,
            email: user.email
        }));
};

//Function to apply the BaseUserMask transformation
export function applyBaseUserMask(inputData: UserInfo[], perms: AccountPermissions[]) {
    return inputData
        .map(user => ({
            uid: user.uid,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            membership: user.membership,
            permissions: user.permissions.length > 0 ? roleIdListToRoleStringList(perms, user.permissions).join(', ') : 'N/A' // Convert to CSV or 'N/A'
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


// Helper function to convert the fetched data from backend to a UserInfo[]
export function processFetchedUserData(users: any[]): UserInfo[] {
    return users.map(user => ({
        uid: user.uid || "Unknown",
        firstName: user.first_name || "Unknown",
        lastName: user.last_name || "Unknown",
        email: user.email || "No email",
        membership: user.membership || false,
        dateOfBirth: new Date("2000-01-01"),
        permissions: user.roles || [],
    }));
};

// Helper function to convert the fetched data from backend to an AccountPermissions[]
export function processFetchedPermData(perms: any[]): AccountPermissions[] {
    return perms.map((perm) => ({
        _id: perm._id,
        name: perm.name,
        ...perm.permissions, // spreads the boolean fields directly
    }));
};

export function processFetchedEventData(events: any[]): ChurchEvent[] {
    return events as ChurchEvent[];
};


// Helper function to convert list of role names to role ids
export function roleStringListToRoleIdList(
    perms: AccountPermissions[],
    roles: string[]
): string[] {
    return roles
        .map(roleName => {
            const match = perms.find(perm => perm.name === roleName);
            return match?._id || null;
        })
        .filter((_id): _id is string => _id !== null); // filter out nulls, ensure it's string[]
};

// Helper function to convert list of role ids to role names
export function roleIdListToRoleStringList(
    perms: AccountPermissions[],
    ids: string[]
): string[] {
    return ids
        .map(id => {
            const match = perms.find(perm => perm._id === id);
            return match?.name || null;
        })
        .filter((name): name is string => name !== null); // filter out nulls, ensure it's string[]
};
