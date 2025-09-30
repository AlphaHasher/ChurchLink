import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/auth-context";
import { getIsInit } from "../../../helpers/UserHelper";

interface PublicRouteProps {
  children: ReactNode;
}

const INIT_ROUTE = "/auth/init";

export const PublicRoute = ({ children }: PublicRouteProps) => {
  const { user, loading } = useAuth();
  const [initLoading, setInitLoading] = useState(true);
  const [isInit, setIsInit] = useState<boolean | null>(null);

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

  if (loading || (user && initLoading)) {
    return (
      <div>
      </div>
    );
  }

  if (user && isInit === false) {
    return <Navigate to={INIT_ROUTE} replace />;
  }

  return <>{children}</>;
};
