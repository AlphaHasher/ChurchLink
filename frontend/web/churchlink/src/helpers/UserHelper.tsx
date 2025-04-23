import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { processFetchedUserData } from "./DataFunctions";
import { confirmAuth } from "./AuthPackaging";



const API_BASE = import.meta.env.VITE_API_HOST;
const API_USERS = "/api/v1/users";

export const processMongoVerification = async () => {
    try {
        const idToken = await confirmAuth()
        const res = await fetch(`${API_BASE}${API_USERS}/sync-user`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        const data = await res.json();

        if (data.verified) {
            return true;
        }
        else {
            return false;
        }
    } catch (err) {
        return false;
    }
};

export const verifyAndSyncUser = async (onError: (msg: string) => void) => {
    try {

        const verified = await processMongoVerification();

        if (!verified) {
            await signOut(auth); // force logout
            onError("Account verification failed. Please contact support.");
            return false;
        }

        return true;
    }
    catch {
        await signOut(auth); // force logout
        onError("Account verification failed. Please contact support.");
        return false;
    }

};

export const fetchUsers = async () => {
    try {

        const idToken = await confirmAuth();

        const res = await fetch(`${API_BASE}${API_USERS}/get-users`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) throw new Error("Failed to fetch users");

        const data = await res.json();
        return processFetchedUserData(data.users);
    } catch (err) {
        console.error("Failed to fetch users:", err);
        return [];
    }
};

export const getMyPermissions = async () => {
    try {

        const idToken = await confirmAuth();

        const res = await fetch(`${API_BASE}${API_USERS}/get-my-permissions`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) throw new Error("Failed to get user perms");

        const data = await res.json();
        return data;
    } catch (err) {
        console.error("Failed to get user perms:", err);
        return null;
    }
};
