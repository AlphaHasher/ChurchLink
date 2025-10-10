import { PermMask } from "./AccountPermissions";


export type UserInfo = {
    uid: string;
    firstName: string;
    lastName: string;
    email: string;
    membership: boolean;
    dateOfBirth: Date;
    permissions: string[];
};



export type BaseUserMask = {
    name: string;
    email: string;
    membership: boolean;
    dateOfBirth: string;
    permissions: string;
    uid: string;
}

export const UserLabels: Record<string, string> = {
    name: "Name",
    email: "Email Address",
    membership: "Church Membership",
    dateOfBirth: "Date of Birth",
    permissions: "Permission Roles",
    uid: "User ID",
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