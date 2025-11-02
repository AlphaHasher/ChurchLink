import { useState, useEffect } from 'react';
import { api } from '@/api';

interface UserPermissions {
  admin: boolean;
  permissions_management: boolean;
  web_builder_management: boolean;
  mobile_ui_management: boolean;
  event_editing: boolean;
  event_management: boolean;
  media_management: boolean;
  sermon_editing: boolean;
  bulletin_editing: boolean;
  finance: boolean;
  ministries_management: boolean;
  forms_management: boolean;
  bible_plan_management: boolean;
  notification_management: boolean;
}

export const useUserPermissions = () => {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setLoading(true);
        const response = await api.get('/v1/users/permissions');
        
        if (response.data?.success) {
          setPermissions(response.data.permissions);
        } else {
          setError(response.data?.msg || 'Failed to fetch permissions');
        }
      } catch (err) {
        console.error('Error fetching user permissions:', err);
        setError('Failed to fetch permissions');
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  return { permissions, loading, error };
};

export default useUserPermissions;