import { PermMask } from "./AccountPermissions";


export type UserInfo = {
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth: Date;
    permissions: string[];
};



export type BaseUserMask = {
    name: string;
    email: string;
    dateOfBirth: string;
    permissions: string;
}

export const UserLabels: Record<string, string> = {
    name: "Name",
    email: "Email Address",
    dateOfBirth: "Date of Birth",
    permissions: "Permission Roles",
};

// Create a type "UserPermMask", this is what we will show in the LogicalPerm Table
// We want to display name, email, and the perm bools.
export type UserPermMask = {
    name: string;
    email: string;
} & PermMask

// Create a type "Perm Role Member Mask", this is used to show the members of a role in the permissions table.
// We only want to display name and email
export type PermRoleMemberMask = {
    name: string;
    email: string;
}

export const RoleMembersLabels: Record<string, string> = {
    name: "Name",
    email: "Email Address",
};