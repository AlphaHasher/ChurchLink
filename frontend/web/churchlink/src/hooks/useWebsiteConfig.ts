import { useEffect } from 'react';
import axios from 'axios';

/**
 * Hook to automatically load and apply website configuration (title and favicon)
 * to the document when the app loads. This runs non-blocking and won't prevent
 * the app from loading if the API call fails.
 */
export const useWebsiteConfig = () => {
  useEffect(() => {
    const loadAndApplyConfig = async () => {
      try {
        // Use direct axios call to avoid authentication requirements
        const response = await axios.get('/api/v1/website/config');
        const config = response.data;

        console.log('Loaded website config:', config);

        // Save config to localStorage for future page loads
        try {
          localStorage.setItem('website_config', JSON.stringify(config));
        } catch (storageError) {
          console.warn('Failed to cache website config:', storageError);
        }

        // Update document title (only if we're not on a custom page)
        if (config.title) {
          // Check if we're on a page with a custom title
          const lastPageSlug = localStorage.getItem('last_page_slug');
          const currentPath = window.location.pathname;

          // Only update if we're not on a page with a cached custom title
          if (!lastPageSlug || !currentPath.includes(lastPageSlug)) {
            document.title = config.title;
          }
        }

        // Update favicon
        if (config.favicon_url) {
          updateDocumentFavicon(config.favicon_url);
        }
      } catch (error) {
        console.warn('Failed to load website configuration, using cached or defaults:', error);

        // Try to use cached config
        try {
          const cached = localStorage.getItem('website_config');
          if (cached) {
            const config = JSON.parse(cached);
            if (config.title) {
              // Check if we're on a page with a custom title
              const lastPageSlug = localStorage.getItem('last_page_slug');
              const currentPath = window.location.pathname;

              // Only update if we're not on a page with a cached custom title
              if (!lastPageSlug || !currentPath.includes(lastPageSlug)) {
                document.title = config.title;
              }
            }
            if (config.favicon_url) {
              updateDocumentFavicon(config.favicon_url);
            }
            return;
          }
        } catch (cacheError) {
          // Ignore cache errors
        }

        // Fallback to defaults if no cache available
        document.title = 'Your Church Website';
        updateDocumentFavicon('/dove-favicon.svg');
      }
    };

    // Run async but don't await - let the app continue loading
    loadAndApplyConfig();
  }, []);
};

/**
 * Helper function to update the document favicon
 */
const updateDocumentFavicon = (faviconUrl: string) => {
  try {
    // Remove existing favicon links
    const existingLinks = document.querySelectorAll('link[rel*="icon"]');
    existingLinks.forEach(link => link.remove());

    // Add new favicon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = faviconUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/x-icon';
    link.href = faviconUrl;
    document.head.appendChild(link);
  } catch (error) {
    console.warn('Failed to update favicon:', error);
  }
};
