import { lazy } from "react";
import { Route, Routes } from "react-router-dom";

const ProfilePage = lazy(() => import("../features/users/pages/ProfilePage"));
const MyEventsPage = lazy(() => import("../features/events/pages/MyEventsPage"));

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
