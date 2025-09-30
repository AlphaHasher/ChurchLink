// src/components/ProtectedRoute.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/auth-context';
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LOGIN_PATH } from '@/router/paths';
import { getIsInit } from '@/helpers/UserHelper';


interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const PrivateRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
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

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (isInit === false) {
    return <Navigate
      to={LOGIN_PATH}
      replace
      state={{ redirectTo: location.pathname + location.search }}
    />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
