import { useState, useEffect } from 'react';
import { api } from '@/api';

export interface PagePermissionResult {
  success: boolean;
  page: string;
  accessLevel: 'full' | 'view-only' | 'none';
  canEdit: boolean;
  canView: boolean;
  requiredPermission?: string;
  userPermissions?: Record<string, boolean>;
  isLoading: boolean;
  error?: string;
}

export const usePagePermissions = (pageName: string): PagePermissionResult => {
  const [result, setResult] = useState<PagePermissionResult>({
    success: false,
    page: pageName,
    accessLevel: 'none',
    canEdit: false,
    canView: false,
    isLoading: true,
  });

  useEffect(() => {
    const checkPagePermissions = async () => {
      if (!pageName) {
        setResult(prev => ({ ...prev, isLoading: false, error: 'No page name provided' }));
        return;
      }

      try {
        setResult(prev => ({ ...prev, isLoading: true, error: undefined }));
        
        const response = await api.get(`/v1/users/permissions/page/${encodeURIComponent(pageName)}`);
        
        if (response.data?.success) {
          setResult({
            success: true,
            page: response.data.page,
            accessLevel: response.data.accessLevel || 'none',
            canEdit: response.data.canEdit || false,
            canView: response.data.canView || false,
            requiredPermission: response.data.requiredPermission,
            userPermissions: response.data.userPermissions,
            isLoading: false,
          });
        } else {
          setResult({
            success: false,
            page: pageName,
            accessLevel: 'none',
            canEdit: false,
            canView: false,
            isLoading: false,
            error: response.data?.msg || 'Failed to check permissions',
          });
        }
      } catch (error) {
        console.error('Error checking page permissions:', error);
        setResult({
          success: false,
          page: pageName,
          accessLevel: 'none',
          canEdit: false,
          canView: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Network error',
        });
      }
    };

    checkPagePermissions();
  }, [pageName]);

  return result;
};

export default usePagePermissions;