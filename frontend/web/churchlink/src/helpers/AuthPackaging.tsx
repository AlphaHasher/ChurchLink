import { getAuth } from "firebase/auth";

export const confirmAuth = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
        throw new Error("User not authenticated");
    }


    const idToken = await user.getIdToken(true);
    return idToken;
};

export const fetchUID = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
        throw new Error("User not authenticated");
    }


    return user.uid;
}