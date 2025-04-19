import { confirmAuth } from "./AuthPackaging";
import { processFetchedPermData } from "./DataFunctions";


const API_BASE = import.meta.env.VITE_API_HOST;
const API_PERMISSIONS = "/api/v1/permissions";


export const fetchPermissions = async () => {
    try {
        const idToken = await confirmAuth();
        const res = await fetch(`${API_BASE}${API_PERMISSIONS}/get-permissions`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) throw new Error("Failed to fetch permissions");

        const data = await res.json();
        return processFetchedPermData(data.permissions);
    } catch (err) {
        console.error("Failed to fetch permissions:", err);
        return [];
    }
};

export const createRole = async (roleData: any) => {
    try {
        const idToken = await confirmAuth();
        const res = await fetch(`${API_BASE}${API_PERMISSIONS}/create-role`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(roleData),
        });

        if (!res.ok) throw new Error("Failed to create role");

        const data = await res.json();
        return data;
    } catch (err) {
        console.error("Failed to create role:", err);
        return null;
    }
};

export const updateRole = async (roleData: any) => {
    try {
        const idToken = await confirmAuth();
        const res = await fetch(`${API_BASE}${API_PERMISSIONS}/update-role`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(roleData),
        });

        if (!res.ok) throw new Error("Failed to update role");

        const data = await res.json();
        return data;
    } catch (err) {
        console.error("Failed to update role:", err);
        return null;
    }
};

export const deleteRole = async (roleData: any) => {
    try {
        const idToken = await confirmAuth();
        const res = await fetch(`${API_BASE}${API_PERMISSIONS}/delete-role`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(roleData),
        });

        if (!res.ok) throw new Error("Failed to delete role");

        const data = await res.json();
        return data;
    } catch (err) {
        console.error("Failed to delete role:", err);
        return null;
    }
};

export const updateUserRoles = async (requestData: any) => {
    try {
        const idToken = await confirmAuth();
        const res = await fetch(`${API_BASE}${API_PERMISSIONS}/update-user-roles`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
        });

        if (!res.ok) throw new Error("Failed to update roles");

        const data = await res.json();
        return data;
    } catch (err) {
        console.error("Failed to update roles:", err);
        return null;
    }
};