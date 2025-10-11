import axios from 'axios';
import { auth } from '../lib/firebase';

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

// Helper endpoints for page staging/publish
export const pageApi = {
  // Autosave to staging by slug
  saveStaging: (slug: string, data: any) => api.put(`/v1/pages/staging/${encodeURIComponent(slug)}`, data),
  // Get staging by slug
  getStaging: (slug: string) => api.get(`/v1/pages/staging/${encodeURIComponent(slug)}`),
  // Publish staging to live
  publish: (slug: string) => api.post(`/v1/pages/publish/${encodeURIComponent(slug)}`),
};

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

// Optional: Handle token refresh on 401 responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token might be expired, try to refresh
      const user = auth.currentUser;
      if (user) {
        try {
          const newToken = await user.getIdToken(true); // Force refresh
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return api.request(error.config);
        } catch (refreshError) {
          console.error('Error refreshing token:', refreshError);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
