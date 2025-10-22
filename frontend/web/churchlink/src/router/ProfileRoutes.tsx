import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import MyEventsPage from "../features/events/pages/MyEventsPage";

const ProfilePage = lazy(() => import("../features/users/pages/ProfilePage"));

export const ProfileRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<ProfilePage />}>
                <Route path="my-events" element={<MyEventsPage />} />
                <Route path="membership" element={<div />} />
            </Route>
        </Routes>
    );
};
