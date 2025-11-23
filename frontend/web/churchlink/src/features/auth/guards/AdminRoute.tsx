import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/auth-context";
import { api } from "@/api";
import { getIsInit } from "../../../helpers/UserHelper";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const INIT_ROUTE = "/auth/init";

export const AdminRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { user, loading } = useAuth();

    const [modCheckLoading, setModCheckLoading] = useState(true);
    const [isMod, setIsMod] = useState(false);

    const [initLoading, setInitLoading] = useState(true);
    const [isInit, setIsInit] = useState<boolean | null>(null);

    // Check for E2E test mode (Cypress environment)
    const [isE2EMode] = useState(() => {
        try {
            return typeof window !== 'undefined' && !!window.Cypress;
        } catch {
            return false;
        }
    });

    // moderator check
    useEffect(() => {
        let alive = true;

        const run = async () => {
            // Skip auth checks in E2E test mode
            if (isE2EMode) {
                setIsMod(true);
                setModCheckLoading(false);
                return;
            }

            if (!user) {
                setIsMod(false);
                setModCheckLoading(false);
                return;
            }
            setModCheckLoading(true);
            try {
                const res = await api.get("/v1/users/check-mod");
                if (alive) setIsMod(!!res.data?.success);
            } catch {
                if (alive) setIsMod(false);
            } finally {
                if (alive) setModCheckLoading(false);
            }
        };

        if (!loading) run();
        return () => {
            alive = false;
        };
    }, [user, loading, isE2EMode]);

    // init check
    useEffect(() => {
        let alive = true;

        const run = async () => {
            // Skip init check in E2E test mode
            if (isE2EMode) {
                setIsInit(true);
                setInitLoading(false);
                return;
            }

            if (!user) {
                setIsInit(null);
                setInitLoading(false);
                return;
            }
            setInitLoading(true);
            try {
                const res = await getIsInit();
                const ok = res['init'];
                if (alive) setIsInit(ok);
            } catch {
                if (alive) setIsInit(false);
            } finally {
                if (alive) setInitLoading(false);
            }
        };

        if (!loading) run();
        return () => {
            alive = false;
        };
    }, [user, loading, isE2EMode]);

    if (loading || modCheckLoading || (user && initLoading)) {
        return (
            <div>
            </div>
        );
    }

    // In E2E test mode, bypass all auth checks
    if (isE2EMode) {
        return <>{children}</>;
    }

    if (!user) {
        return <Navigate to="/auth/login" replace />;
    }

    if (isInit === false) {
        return <Navigate to={INIT_ROUTE} replace />;
    }

    return user && isMod ? <>{children}</> : <Navigate to="/" replace />;
};

export default AdminRoute;
