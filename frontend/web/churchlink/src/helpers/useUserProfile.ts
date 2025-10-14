/**
 * React Hook for Cached User Profile
 * Provides user profile data with automatic caching and loading states
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/api/api';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { profileCache } from './ProfileCache';

interface UserProfile {
  first_name: string;
  last_name: string;
  gender?: "M" | "F" | null;
  birthday?: string | null;
  email: string;
}

interface UseProfileReturn {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  clearCache: () => void;
}

/**
 * Hook to manage user profile with caching
 */
export function useUserProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get user ID from auth context
  const { user } = useAuth();
  const userId = user?.uid || 'anonymous';

  const fetchProfile = useCallback(async (skipCache = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check cache first unless explicitly skipping
      if (!skipCache) {
        const cachedProfile = profileCache.get(userId);
        if (cachedProfile) {
          console.log('✅ [useUserProfile] Using cached profile');
          setProfile(cachedProfile);
          setIsLoading(false);
          return;
        }
      }

      console.log('📡 [useUserProfile] Fetching profile from API...');
      const res = await api.get("/v1/users/get-profile");
      
      // API returns data under profile_info key
      const rawProfileData = res.data?.profile_info || res.data;
      
      // Transform to ensure required fields have defaults
      const profileData: UserProfile = {
        first_name: rawProfileData?.first_name || '',
        last_name: rawProfileData?.last_name || '',
        email: rawProfileData?.email || '',
        gender: rawProfileData?.gender || null,
        birthday: rawProfileData?.birthday || null,
      };
      
      // Cache the profile data
      profileCache.set(userId, profileData);
      setProfile(profileData);
      
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to load profile';
      console.error("❌ [useUserProfile] Profile fetch failed:", errorMessage);
      setError(errorMessage);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const refetch = useCallback(() => {
    return fetchProfile(true); // Skip cache on manual refetch
  }, [fetchProfile]);

  const clearCache = useCallback(() => {
    profileCache.clear(userId);
    console.log('🗑️ [useUserProfile] Profile cache cleared');
  }, [userId]);

  // Initial load
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    refetch,
    clearCache
  };
}

/**
 * Hook to get just the display name from profile
 */
export function useUserDisplayName(): { displayName: string | null; isLoading: boolean } {
  const { profile, isLoading } = useUserProfile();
  
  const displayName = profile?.first_name && profile?.last_name 
    ? `${profile.first_name} ${profile.last_name}`
    : null;

  return {
    displayName,
    isLoading
  };
}

/**
 * Hook to check if profile has required fields for event registration
 */
export function useProfileCompleteness(): {
  isComplete: boolean;
  missingFields: string[];
  isLoading: boolean;
} {
  const { profile, isLoading } = useUserProfile();
  
  const missingFields: string[] = [];
  
  if (!profile?.first_name) missingFields.push('first_name');
  if (!profile?.last_name) missingFields.push('last_name');
  if (!profile?.gender) missingFields.push('gender');
  if (!profile?.birthday) missingFields.push('birthday');
  
  return {
    isComplete: missingFields.length === 0,
    missingFields,
    isLoading
  };
}