import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/auth-context";
import { getIsInit } from "../../../helpers/UserHelper";

interface VerificationRouteProps {
    children: React.ReactNode;
}

const APP_HOME = "/";

// Guard for /auth/verify-email
// - If not logged in: go home (/)
// - If verified: go home (/)
// - If not verified: allow the verification page (children)
export const VerificationRoute: React.FC<VerificationRouteProps> = ({ children }) => {
    const { user, loading } = useAuth();
    const [verLoading, setVerLoading] = useState(true);
    const [isVerified, setIsVerified] = useState<boolean | null>(null);

    useEffect(() => {
        let alive = true;

        const run = async () => {
            if (!user) {
                setIsVerified(null);
                setVerLoading(false);
                return;
            }
            setVerLoading(true);
            try {
                // getIsInit returns: { verified: boolean, init: boolean, msg?: string }
                const res = await getIsInit();
                if (!alive) return;
                setIsVerified(!!res?.verified);
            } catch {
                if (!alive) return;
                // Fail-closed: treat as NOT verified so the user can stay on the page
                setIsVerified(false);
            } finally {
                if (alive) setVerLoading(false);
            }
        };

        if (!loading) run();
        return () => {
            alive = false;
        };
    }, [user, loading]);

    // Hold rendering until auth and verification checks are done
    if (loading || (user && verLoading)) {
        return <div />;
    }

    // Not logged in -> home
    if (!user) {
        return <Navigate to={APP_HOME} replace />;
    }

    // Verified -> home
    if (isVerified === true) {
        return <Navigate to={APP_HOME} replace />;
    }

    // Logged in but NOT verified -> show verification page
    return <>{children}</>;
};

export default VerificationRoute;
