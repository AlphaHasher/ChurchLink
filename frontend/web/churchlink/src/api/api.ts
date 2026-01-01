import axios, { AxiosRequestConfig } from 'axios';
import { auth } from '../lib/firebase';
import type { ChurchSettings } from '../helpers/ChurchSettingsHelper';

interface RetryableAxiosConfig extends AxiosRequestConfig {
  _retryOnce?: boolean;
}

const resolveApiBaseUrl = () => {
  const rawHost = import.meta.env.VITE_API_HOST?.trim();

  const shouldFallbackToSameOrigin = (url: string) => {
    if (typeof window === 'undefined') return false;
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      const currentHost = window.location.hostname;

      const isPrivateHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(hostname) ||
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

      // If we are deployed on a public host but VITE_API_HOST still points to a private LAN/localhost address,
      // ignore it and use same-origin.
      return isPrivateHost && currentHost !== hostname;
    } catch (error) {
      console.warn('[api] Invalid VITE_API_HOST configured, falling back to relative /api', error);
      return true;
    }
  };

  if (rawHost && !shouldFallbackToSameOrigin(rawHost)) {
    try {
      const normalized = rawHost.endsWith('/') ? rawHost : `${rawHost}/`;
      const resolved = new URL('api', normalized).toString();
      return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved;
    } catch (error) {
      console.warn('[api] Invalid VITE_API_HOST configured, falling back to relative /api', error);
    }
  }

  // Fallback to same-origin relative path so deployments behind a reverse proxy work out of the box.
  return '/api';
};

// Create API instance without store dependency
const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withXSRFToken: true,
  withCredentials: true,
});

// Public API instance without Firebase auth/interceptors (for proxy endpoints that don't need user auth)
export const publicApi = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withXSRFToken: true,
  withCredentials: true,
});

// Add Firebase auth token interceptor
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;

  if (user) {
    try {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.error('Error getting Firebase token:', error);
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Optional: Handle token refresh on 401 responses (single retry guard)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalConfig = error.config as RetryableAxiosConfig || {};
    if (status === 401) {
      const user = auth.currentUser;
      // Avoid infinite retry loops: retry at most once per request
      if (user && !originalConfig._retryOnce) {
        try {
          const newToken = await user.getIdToken(true);
          originalConfig._retryOnce = true;
          originalConfig.headers = {
            ...(originalConfig.headers || {}),
            Authorization: `Bearer ${newToken}`,
          };
          return api.request(originalConfig);
        } catch (refreshError) {
          console.error('Error refreshing token:', refreshError);
        }
      }
    }
    return Promise.reject(error);
  }
);

// Website Configuration API functions
export const websiteConfigApi = {
  // Get current website configuration (public)
  getConfig: async () => {
    const response = await api.get('/v1/website/config');
    return response.data;
  },

  // Update website configuration (admin only)
  updateConfig: async (config: { title?: string; favicon_url?: string; favicon_asset_id?: string; meta_description?: string }) => {
    const response = await api.put('/v1/website/config', config);
    return response.data;
  },

  // Upload favicon file using assets upload endpoint (admin only)
  uploadFavicon: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'system/favicon');
    formData.append('description', 'Website favicon image');

    // Use the existing assets upload system which has proper authentication
    const response = await api.post('/v1/assets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data; // Returns array of uploaded images
  },

  // Update favicon configuration to use specific asset (admin only)
  setFavicon: async (assetId: string) => {
    const faviconUrl = `/api/v1/assets/public/id/${assetId}`;
    const response = await api.put('/v1/website/config', {
      favicon_asset_id: assetId,
      favicon_url: faviconUrl
    });
    return response.data;
  },

  // Remove favicon (admin only)
  removeFavicon: async () => {
    const response = await api.put('/v1/website/config', {
      favicon_asset_id: null,
      favicon_url: null
    });
    return response.data;
  },

  // Update website title (admin only)
  updateTitle: async (title: string) => {
    const response = await api.put('/v1/website/title', { title });
    return response.data;
  },

  // Get admin website configuration with metadata (admin only)
  getAdminConfig: async () => {
    const response = await api.get('/v1/website/config/admin');
    return response.data;
  },

  // Get church settings (admin only)
  getChurchSettings: async () => {
    const response = await api.get('/v1/website/church/settings');
    return response.data;
  },

  // Update church settings (admin only)
  updateChurchSettings: async (settings: ChurchSettings) => {
    const response = await api.put('/v1/website/church/settings', settings);
    return response.data;
  },
};

export default api;
