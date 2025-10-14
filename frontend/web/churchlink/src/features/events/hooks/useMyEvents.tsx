import { useState, useEffect, useCallback } from 'react';
import { myEventsApi } from '@/features/events/api/myEventsApi';
import { MyEventsResponse } from '../types/myEvents';

export const useMyEvents = (params?: {
  include_family?: boolean;
  expanded?: boolean;
}) => {
  const [data, setData] = useState<MyEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract primitive values to avoid object dependency issues
  const includeFamily = params?.include_family;
  const expanded = params?.expanded;

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Create clean params object without the 'expanded' property to avoid conflicts
      const apiParams = includeFamily ? { include_family: includeFamily } : undefined;
      
      const result = expanded 
        ? await myEventsApi.getMyEventsExpanded(apiParams)
        : await myEventsApi.getMyEvents(apiParams);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [includeFamily, expanded]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events: data?.events || [],
    loading,
    error,
    refetch: fetchEvents
  };
};