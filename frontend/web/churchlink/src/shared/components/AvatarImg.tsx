import { useState, useEffect } from 'react';
import { AvatarImage } from '@/shared/components/ui/avatar';
import { AvatarCache } from '@/lib/AvatarCache';

// Define User interface (extend as needed)
interface User {
  id?: number | string;
  google_uuid?: string;
  url_picture?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

/**
 * Cached Avatar Image Component
 * Uses AvatarCache for IndexedDB-backed caching with automatic expiration
 * Supports multiple user identifiers for alias-based caching
 */
interface AvatarImgProps {
  user: User;
  className?: string;
  alt?: string;
  onError?: () => void;
}

export const AvatarImg = ({ user, className, alt, onError }: AvatarImgProps) => {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) return;

      // Read synchronously from cache first (no network)
      const cached = await AvatarCache.getByAny([user.id, user.google_uuid]);
      if (!cancelled && cached) {
        setSrc(cached);
        return;
      }

      // Only if no cache, trigger a single fetch with deduplication
      if (user?.url_picture) {
        const data = await AvatarCache.fetchAndCache(
          user.id,
          user.url_picture,
          [user.google_uuid]
        );
        if (!cancelled && data) setSrc(data);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.url_picture, user?.google_uuid]);

  // Helper function to get display name
  const getUserDisplayName = (user: User): string => {
    if (user.displayName) return user.displayName;
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    if (user.firstName) return user.firstName;
    if (user.lastName) return user.lastName;
    if (user.email) return user.email;
    return 'User';
  };

  return (
    <AvatarImage
      src={src}
      alt={alt || getUserDisplayName(user)}
      className={className}
      onError={onError}
    />
  );
};

export default AvatarImg;
