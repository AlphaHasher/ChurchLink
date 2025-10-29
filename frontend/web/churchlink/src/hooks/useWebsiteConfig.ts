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
        
        // Update document title
        if (config.title) {
          document.title = config.title;
          console.log('Updated document title to:', config.title);
        }
        
        // Update favicon
        if (config.favicon_url) {
          updateDocumentFavicon(config.favicon_url);
          console.log('Updated favicon to:', config.favicon_url);
        }
      } catch (error) {
        console.warn('Failed to load website configuration, using defaults:', error);
        // Fallback to defaults if API fails
        document.title = 'ChurchLink';
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
