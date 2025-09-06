import axios from 'axios';
import { auth } from '../lib/firebase';

// Create API instance without store dependency
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_HOST}/api`,
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
