import React from "react";
import { Navigate } from "react-router-dom";
import useUserPermissions from "@/hooks/useUserPermissions";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermission: string | string[];
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredPermission,
  fallback
}) => {
  const { permissions, loading } = useUserPermissions();

  // Show loading skeleton while permissions are being fetched
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    );
  }

  // If permissions are not available, deny access
  if (!permissions) {
    return fallback || <Navigate to="/admin" replace />;
  }

  // Check if user has required permission
  const hasPermission = () => {
    if (Array.isArray(requiredPermission)) {
      // User needs ANY of the permissions in the array
      return requiredPermission.some(perm =>
        permissions[perm as keyof typeof permissions] || permissions.admin
      );
    } else {
      // User needs the specific permission OR admin
      return permissions[requiredPermission as keyof typeof permissions] || permissions.admin;
    }
  };

  // If user doesn't have permission, show fallback or redirect
  if (!hasPermission()) {
    return fallback || (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-600">
            You don't have the necessary permissions to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PermissionGuard;