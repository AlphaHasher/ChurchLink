/**
 * Frontend Profile Cache
 * Saves user profile data to avoid repeated API calls and improve performance
 */

interface CachedProfile {
  first_name: string;
  last_name: string;
  gender?: "M" | "F" | null;
  birthday?: string | null;
  email: string;
}

interface ProfileCacheEntry {
  profile: CachedProfile;
  timestamp: number;
  expiresAt: number;
}

class ProfileCacheManager {
  private cache: Map<string, ProfileCacheEntry> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly STORAGE_KEY = 'churchlink_profile_cache';

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Get cached profile for a user
   */
  get(userId: string): CachedProfile | null {
    const entry = this.cache.get(userId);
    
    if (!entry) {
      return null;
    }

    // Check if cache has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(userId);
      this.saveToStorage();
      return null;
    }

    console.log('✅ [ProfileCache] Using cached profile for user:', userId);
    return entry.profile;
  }

  /**
   * Store profile in cache
   */
  set(userId: string, profile: CachedProfile): void {
    const now = Date.now();
    const entry: ProfileCacheEntry = {
      profile,
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION
    };

    this.cache.set(userId, entry);
    this.saveToStorage();
    console.log('💾 [ProfileCache] Cached profile for user:', userId);
  }

  /**
   * Clear cache for a specific user (useful after profile updates)
   */
  clear(userId: string): void {
    this.cache.delete(userId);
    this.saveToStorage();
    console.log('🗑️ [ProfileCache] Cleared cache for user:', userId);
  }

  /**
   * Clear all cached profiles
   */
  clearAll(): void {
    this.cache.clear();
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🗑️ [ProfileCache] Cleared all cached profiles');
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const data = JSON.parse(stored);
      const now = Date.now();

      // Load non-expired entries
      for (const [userId, entry] of Object.entries(data)) {
        const cacheEntry = entry as ProfileCacheEntry;
        if (now <= cacheEntry.expiresAt) {
          this.cache.set(userId, cacheEntry);
        }
      }

      console.log('📥 [ProfileCache] Loaded cached profiles from storage');
    } catch (error) {
      console.warn('⚠️ [ProfileCache] Failed to load from storage:', error);
      this.clearAll();
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Object.fromEntries(this.cache);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('⚠️ [ProfileCache] Failed to save to storage:', error);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): { total: number; valid: number; expired: number } {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (now <= entry.expiresAt) {
        valid++;
      } else {
        expired++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired
    };
  }
}

// Create singleton instance
export const profileCache = new ProfileCacheManager();

/**
 * Hook to get user ID for caching (you might need to adjust this based on your auth system)
 */
export function getCurrentUserId(): string {
  // This should return the current user's unique identifier
  // Try to get it from localStorage or sessionStorage first (for Firebase UID)
  const firebaseUser = localStorage.getItem('firebase:authUser:' + 'default') ||
                      sessionStorage.getItem('firebase:authUser:' + 'default');
  
  if (firebaseUser) {
    try {
      const user = JSON.parse(firebaseUser);
      if (user?.uid) {
        return user.uid;
      }
    } catch (e) {
      console.warn('Failed to parse Firebase user from storage');
    }
  }
  
  // Fallback to a generic user ID
  return 'current_user';
}