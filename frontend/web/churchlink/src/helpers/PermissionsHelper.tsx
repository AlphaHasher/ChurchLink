import { processFetchedPermData } from "./DataFunctions";
import api from "../api/api";

export const fetchPermissions = async () => {
    try {
        const res = await api.get("/v1/permissions/get-permissions");
        return processFetchedPermData(res.data.permissions);
    } catch (err) {
        console.error("Failed to fetch permissions:", err);
        return [];
    }
};

export const createRole = async (roleData: any) => {
    try {
        const res = await api.post("/v1/permissions/create-role", roleData);
        return res.data;
    } catch (err) {
        console.error("Failed to create role:", err);
        return null;
    }
};

export const updateRole = async (roleData: any) => {
    try {
        const res = await api.patch("/v1/permissions/update-role", roleData);
        return res.data;
    } catch (err) {
        console.error("Failed to update role:", err);
        return null;
    }
};

export const deleteRole = async (roleData: any) => {
    try {
        const res = await api.delete("/v1/permissions/delete-role", { data: roleData });
        return res.data;
    } catch (err) {
        console.error("Failed to delete role:", err);
        return null;
    }
};

export const updateUserRoles = async (requestData: any) => {
    try {
        const res = await api.patch("/v1/permissions/update-user-roles", requestData);
        return res.data;
    } catch (err) {
        console.error("Failed to update roles:", err);
        return null;
    }
};