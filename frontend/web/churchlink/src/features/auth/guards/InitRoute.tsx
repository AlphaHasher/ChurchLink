import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/auth-context";
import { getIsInit } from "../../../helpers/UserHelper";

interface InitRouteProps {
    children: React.ReactNode;
}

const LOGIN_ROUTE = "/auth/login";
const VERIFY_ROUTE = "/auth/verify-email";
const APP_HOME = "/";

// Guard for the /auth/init route.
// - If not logged in: send to login
// - If logged in but NOT verified: send to verify-email
// - If logged in, verified, and NOT initialized: allow init page (children)
// - If logged in, verified, and initialized: send home
export const InitRoute: React.FC<InitRouteProps> = ({ children }) => {
    const { user, loading } = useAuth();
    const [initLoading, setInitLoading] = useState(true);
    const [isInit, setIsInit] = useState<boolean | null>(null);
    const [isVerified, setIsVerified] = useState<boolean | null>(null);

    useEffect(() => {
        let alive = true;

        const run = async () => {
            if (!user) {
                setIsInit(null);
                setIsVerified(null);
                setInitLoading(false);
                return;
            }
            setInitLoading(true);
            try {
                const res = await getIsInit();
                if (!alive) return;
                setIsInit(!!res?.init);
                setIsVerified(!!res?.verified);
            } catch (err) {
                // Fail-closed: treat as unverified & not initialized
                if (!alive) return;
                setIsInit(false);
                setIsVerified(false);
            } finally {
                if (alive) setInitLoading(false);
            }
        };

        if (!loading) run();
        return () => {
            alive = false;
        };
    }, [user, loading]);

    if (loading || (user && initLoading)) {
        return <div />;
    }

    // Not signed in -> login
    if (!user) {
        return <Navigate to={LOGIN_ROUTE} replace />;
    }

    // Signed in but NOT verified -> verify-email
    if (isVerified === false) {
        return <Navigate to={VERIFY_ROUTE} replace />;
    }

    // Signed in, verified, NOT initialized -> show init page
    if (isInit === false) {
        return <>{children}</>;
    }

    // Signed in, verified, initialized -> home
    return <Navigate to={APP_HOME} replace />;
};

export default InitRoute;
