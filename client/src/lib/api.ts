import axios from 'axios';

// Resolve base URL: check VITE_API_URL or default to localhost:5000/api in browser
const defaultBaseURL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';

const baseURL = (import.meta as any).env?.VITE_API_URL || defaultBaseURL;

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // Normalize paths: strip leading /api if baseURL already ends with /api to avoid /api/api/...
  if (config.url) {
    if (config.baseURL?.endsWith('/api') && config.url.startsWith('/api/')) {
      config.url = config.url.substring(4);
    }
  }

  const token = localStorage.getItem('velan_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const deviceId = localStorage.getItem('velan_device_id');
  if (deviceId) {
    config.headers['x-device-id'] = deviceId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);
