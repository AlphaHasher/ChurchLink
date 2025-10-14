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

    // moderator check
    useEffect(() => {
        let alive = true;

        const run = async () => {
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
    }, [user, loading]);

    // init check
    useEffect(() => {
        let alive = true;

        const run = async () => {
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
    }, [user, loading]);

    if (loading || modCheckLoading || (user && initLoading)) {
        return (
            <div>
            </div>
        );
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
