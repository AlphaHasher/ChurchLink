import { lazy } from "react";
import { Route, Routes } from "react-router-dom";

const ProfilePage = lazy(() => import("../features/users/pages/ProfilePage"));

export const ProfileRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<ProfilePage />} />
        </Routes>
    );
};
