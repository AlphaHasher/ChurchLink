import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { processFetchedUserData } from "./DataFunctions";


const API_BASE = import.meta.env.VITE_API_HOST;
const API_USERS = "/api/v1/users";

export const processMongoVerification = async (uid: string) => {
    try {
        const res = await fetch(`${API_BASE}${API_USERS}/sync-user?uid=${encodeURIComponent(uid)}`, {
            method: "POST",
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

export const verifyAndSyncUser = async (uid: string, onError: (msg: string) => void) => {
    const verified = await processMongoVerification(uid);

    if (!verified) {
        await signOut(auth); // force logout
        onError("Account verification failed. Please contact support.");
        return false;
    }

    return true;
};

export const fetchUsers = async () => {
    try {
        const res = await fetch(`${API_BASE}${API_USERS}/get-users`, {
            method: "GET",
        });

        if (!res.ok) throw new Error("Failed to fetch users");

        const data = await res.json();
        return processFetchedUserData(data.users);
    } catch (err) {
        console.error("Failed to fetch users:", err);
        return [];
    }
};
