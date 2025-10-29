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
      
      // Add cache busting timestamp
      const apiParamsWithCacheBust = {
        ...apiParams,
        _t: Date.now()
      };
      
      const result = expanded 
        ? await myEventsApi.getMyEventsExpanded(apiParamsWithCacheBust)
        : await myEventsApi.getMyEvents(apiParamsWithCacheBust);
      
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load events';
      console.error('[useMyEvents] Error fetching events:', errorMessage);
      setError(errorMessage);
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