import { lazy } from "react";
import { Route, Routes } from "react-router-dom";

const ProfilePage = lazy(() => import("../features/users/pages/ProfilePage"));
const MyEventsPageV2 = lazy(() => import("../features/eventsV2/pages/MyEventsPageV2"));

export const ProfileRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<ProfilePage />}>
                <Route path="my-events" element={<MyEventsPageV2 />} />
                <Route path="membership" element={<div />} />
            </Route>
        </Routes>
    );
};
