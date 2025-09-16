import { useAuth } from '../hooks/auth-context';
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '@/api';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const AdminRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { user, loading } = useAuth();
    const [modCheckLoading, setModCheckLoading] = useState(true);
    const [isMod, setIsMod] = useState(false);

    useEffect(() => {
        if (user) {
            const checkMod = async () => {
                try {
                    const res = await api.get('/v1/users/check-mod');
                    if (res.data?.success) {
                        setIsMod(true);
                    } else {
                        setIsMod(false);
                    }
                } catch (err) {
                    setIsMod(false);
                } finally {
                    setModCheckLoading(false);
                }
            };
            checkMod();
        } else {
            setModCheckLoading(false);
            setIsMod(false);
        }
    }, [user]);

    if (loading || modCheckLoading) {
        return (
            <div>
                <div className="flex items-center justify-center w-56 h-56 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                    <div className="px-3 py-1 text-xs font-medium leading-none text-center text-blue-800 bg-blue-200 rounded-full animate-pulse dark:bg-blue-900 dark:text-blue-200"></div>
                </div>
            </div>
        );
    }

    return user && isMod ? <>{children}</> : <Navigate to="/" replace />;
};

export default AdminRoute;