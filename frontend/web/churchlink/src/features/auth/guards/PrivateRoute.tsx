// src/components/ProtectedRoute.tsx
import { useAuth } from '../hooks/auth-context';
import React from 'react';
import { Navigate } from 'react-router-dom';


interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const PrivateRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  // Show a loading indicator while checking auth state
  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-center w-56 h-56 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          <div className="px-3 py-1 text-xs font-medium leading-none text-center text-blue-800 bg-blue-200 rounded-full animate-pulse dark:bg-blue-900 dark:text-blue-200"></div>
        </div>
      </div>
    );
  }

  // If logged in, show the dashboard (or whatever content is wrapped)
  return user ? <>{children}</> : <Navigate to="/auth/login" replace />;
};
export default PrivateRoute;