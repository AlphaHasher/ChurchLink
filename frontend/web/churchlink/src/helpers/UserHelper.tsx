import { signOut } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { MyPermsRequest } from "@/shared/types/MyPermsRequest";
import { processFetchedUserData } from "./DataFunctions";
import api from "../api/api";
import { ProfileInfo, toProfileInfo, ContactInfo, toContactInfo, AddressSchema } from "@/shared/types/ProfileInfo";
import { PersonDetails } from "@/shared/types/Person";
import { DetailedUserInfo, UserInfo } from "@/shared/types/UserInfo";

export type UsersSearchParams = {
    page: number;
    pageSize: number;
    searchField: "email" | "name";
    searchTerm: string;
    sortBy: "email" | "name" | "createdOn" | "uid";
    sortDir: "asc" | "desc";
};

export type UsersPagedResult = {
    items: UserInfo[];
    total: number;
    page: number;
    pageSize: number;
};

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

export const fetchUsersWithRole = async (role_id: string) => {
    try {
        const res = await api.get(`v1/users/get-users-with-role/${role_id}`);
        return processFetchedUserData(res.data.users);
    }
    catch (err) {
        console.error("Failed to fetch users:", err);
        return [];
    }
}

export const fetchUsersPaged = async (
    params: UsersSearchParams,
    signal?: AbortSignal
): Promise<UsersPagedResult> => {
    const res = await api.get("/v1/users/search-users", { params, signal });
    const raw = res.data;
    return {
        items: processFetchedUserData(raw.items || []),
        total: raw.total ?? 0,
        page: raw.page ?? params.page,
        pageSize: raw.pageSize ?? params.pageSize,
    };
};

export const fetchLogicalUsersPaged = async (
    params: UsersSearchParams,
    signal?: AbortSignal
): Promise<UsersPagedResult> => {
    const res = await api.get("/v1/users/search-logical-users", { params, signal });
    const raw = res.data;
    return {
        items: processFetchedUserData(raw.items || []),
        total: raw.total ?? 0,
        page: raw.page ?? params.page,
        pageSize: raw.pageSize ?? params.pageSize,
    };
};

export const fetchUserNameByUId = async (userId: string) => {
    try {
        const res = await api.get(`/v1/users/get-user-by-uid/${userId}`);
        const user = res.data;
        if (user && user.first_name && user.last_name) {
            return [user.first_name, user.last_name, user.email];
        } else if (user && (user.first_name || user.last_name)) {
            return [user.first_name || '', user.last_name || '', user.email].filter(Boolean);
        } else {
            return [userId, user?.email || ''];
        }
    } catch (err) {
        console.error("Failed to fetch user by ID:", err);
        return [userId, ''];
    }
}

export const fetchUserInfoByUId = async (userId: string) => {
    try {
        const res = await api.get(`/v1/users/get-user-by-uid/${userId}`);
        return res.data;
    } catch (err) {
        console.error("Failed to fetch user info by ID:", err);
        return null;
    }
}

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

export const getIsInit = async () => {
    try {
        const res = await api.get("v1/users/is-init");
        return res.data
    }
    catch (err) {
        console.error("Failed to get init stats:", err);
        return { "verified": false, "init": false, "msg": "Error!" }
    }
}

export const getDetailedUserInfo = async (uid: string): Promise<DetailedUserInfo> => {
    try {
        const res = await api.get(`/v1/users/get-detailed-user/${uid}`);
        const p_prime = res.data.info.personal_info;

        const c_prime = res.data.info.contact_info;
        const a_prime = c_prime.address;

        const p: ProfileInfo = {
            first_name: p_prime.first_name,
            last_name: p_prime.last_name,
            email: p_prime.email,
            membership: p_prime.membership,
            gender: p_prime.gender,
            birthday: p_prime.birthday,
        };

        const a: AddressSchema = {
            address: a_prime.address,
            suite: a_prime.suite,
            city: a_prime.city,
            state: a_prime.state,
            country: a_prime.country,
            postal_code: a_prime.postal_code
        };

        const c: ContactInfo = {
            phone: c_prime.phone,
            address: a
        };

        const d: DetailedUserInfo = {
            uid: uid,
            verified: res.data.info.verified,
            profile: p,
            contact: c
        };

        return d;
    }
    catch (err) {
        console.error("Failed to get detailed user info:", err);
        const p: ProfileInfo = {
            first_name: "",
            last_name: "",
            email: "",
            membership: false,
            gender: null,
            birthday: null,
        };

        const a: AddressSchema = {
            address: "",
            suite: "",
            city: "",
            state: "",
            country: "",
            postal_code: ""
        };

        const c: ContactInfo = {
            phone: "",
            address: a
        };

        const d: DetailedUserInfo = {
            uid: uid,
            verified: false,
            profile: p,
            contact: c
        };
        return d;
    }
}

export const patchDetailedUserInfo = async (details: DetailedUserInfo) => {
    try {
        const a = details.contact.address;
        const ad = {
            address: a.address,
            suite: a.suite,
            city: a.city,
            state: a.state,
            country: a.country,
            postal_code: a.postal_code
        }

        const c = {
            phone: details.contact.phone,
            address: ad,
        }

        const p = {
            email: details.profile.email,
            membership: details.profile.membership,
            first_name: details.profile.first_name,
            last_name: details.profile.last_name,
            gender: details.profile.gender,
            birthday: details.profile.birthday,
        }

        const payload = {
            uid: details.uid,
            verified: details.verified,
            personal_info: p,
            contact_info: c,
        }

        const res = await api.patch(`/v1/users/detailed-user/${details.uid}`, payload);
        return {
            success: res.data?.success === true,
            msg: res.data?.msg ?? "",
        };
    }
    catch (err) {
        console.error("Failed to update detailed user info!", err);
        return { success: false, msg: "Failed to update user info." };
    }
}

export const getMyProfileInfo = async () => {
    try {
        const res = await api.get("/v1/users/get-profile");
        return res.data;
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
            membership: profile.membership,
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

export const updateContactInfo = async (contact: ContactInfo) => {
    try {
        const payload = {
            phone: contact.phone,
            address: contact.address
        };

        const res = await api.patch("/v1/users/update-contact", payload);

        return {
            success: res.data?.success === true,
            msg: res.data?.msg ?? "",
            contact: res.data?.contact_info ? toContactInfo(res.data.contact_info) : null,
        };
    } catch (err) {
        console.error("Failed to update contact info:", err);
        return { success: false, msg: "Failed to update contact info.", contact: null };
    }
}

export const getMyFamilyMembers = async () => {
    try {
        const res = await api.get("/v1/users/all-family-members");
        return (res.data?.family_members as PersonDetails[]) ?? [];
    } catch (err) {
        console.error("Failed to get family members:", err);
        return [];
    }
}

export const getAllPeople = async () => {
    try {
        const res = await api.get("/v1/users/all-people");
        const data = res.data;
        if (data.success) {
            return { "success": data.success, "msg": data.msg, "profile_info": toProfileInfo(data.profile_info), "family_members": (res.data.family_members as PersonDetails[]) ?? [] };
        }
        return { "success": data.success, "msg": data.msg }
    }
    catch (err) {
        console.error("Failed to get all people:", err);
        return { "success": false, "msg": `Unexpected error in fetching people: ${err}` }
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

export const deleteFamilyMember = async (id: string) => {
    try {
        await api.delete(`/v1/users/family-member/${id}`);
        return { "success": true };
    }
    catch (err) {
        console.log("Failed to delete family member:", err);
        return { "success": false }
    }
}

