import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { processFetchedUserData } from "./DataFunctions";
import api from "../api/api";

export const processMongoVerification = async () => {
    try {
        const res = await api.post("/v1/users/sync-user");

        if (res.data.verified) {
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
        const res = await api.get("/v1/users/get-users");
        return processFetchedUserData(res.data.users);
    } catch (err) {
        console.error("Failed to fetch users:", err);
        return [];
    }
};
