import { signOut } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { processFetchedUserData } from "./DataFunctions";
import api from "../api/api";
import { MyPermsRequest } from "@/shared/types/MyPermsRequest";
import { toProfileInfo, ProfileInfo } from "@/shared/types/ProfileInfo";
import { PersonDetails } from "@/shared/types/Person";

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


export const getMyPermissions = async (options?: MyPermsRequest) => {
    try {
        // Provide default values if options is not passed
        const defaultOptions: MyPermsRequest = {
            user_assignable_roles: false,
            event_editor_roles: false,
            user_role_ids: false,
        };

        const res = await api.post("/v1/users/get-my-permissions", options ?? defaultOptions);

        return res.data;
    } catch (err) {
        console.error("Failed to get user perms:", err);
        return null;
    }
};

export const getMyProfileInfo = async () => {
    try {
        const res = await api.get("/v1/users/get-profile");
        return toProfileInfo(res.data.profile_info);
    }
    catch (err) {
        console.error("Failed to get profile info:", err);
        return null;
    }
}

export const updateProfileInfo = async (profile: ProfileInfo) => {
    try {
        const payload = {
            first_name: profile.first_name,
            last_name: profile.last_name,
            email: profile.email,
            birthday: profile.birthday ? profile.birthday.toISOString() : null,
            gender: profile.gender ?? null,
        };

        const res = await api.patch("/v1/users/update-profile", payload);

        return {
            success: res.data?.success === true,
            msg: res.data?.msg ?? "",
            profile: res.data?.profile_info
                ? toProfileInfo(res.data.profile_info)
                : null,
        };
    } catch (err) {
        console.error("Failed to update profile info:", err);
        return { success: false, msg: "Failed to update profile info.", profile: null };
    }
};

export const getMyFamilyMembers = async () => {
    try {
        const res = await api.get("/v1/users/all-family-members");
        return (res.data?.family_members as PersonDetails[]) ?? [];
    } catch (err) {
        console.error("Failed to get family members:", err);
        return [];
    }
}

export const addFamilyMember = async (person: PersonDetails) => {
    try {
        const payload = {
            first_name: person.first_name,
            last_name: person.last_name,
            date_of_birth: person.date_of_birth,
            gender: person.gender
        }
        await api.post("/v1/users/add-family-member", payload);
        return { "success": true };
    }
    catch (err) {
        console.error("Failed to add family member:", err);
        return { "success": false };
    }
}

export const editFamilyMember = async (person: PersonDetails) => {
    try {
        const payload = {
            id: person.id,
            first_name: person.first_name,
            last_name: person.last_name,
            date_of_birth: person.date_of_birth,
            gender: person.gender
        }
        await api.patch("/v1/users/family-member", payload);
        return { "success": true };
    }
    catch (err) {
        console.log("Failed to edit family member:", err);
        return { "success": false }
    }
}

export const deleteFamilyMember = async (id: String) => {
    try {
        await api.delete(`/v1/users/family-member/${id}`);
        return { "success": true };
    }
    catch (err) {
        console.log("Failed to delete family member:", err);
        return { "success": false }
    }
}


