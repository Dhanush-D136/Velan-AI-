import axios from 'axios';

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0');

const defaultBaseURL = isLocal ? 'http://localhost:5000/api' : '/api';
const baseURL = (import.meta as any).env?.VITE_API_URL || defaultBaseURL;

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
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

let refreshPromise: Promise<string | null> | null = null;

async function silentRefreshToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const newToken = res.data?.token || null;
        if (newToken) {
          localStorage.setItem('velan_token', newToken);
          if (res.data?.user) {
            localStorage.setItem('velan_user', JSON.stringify(res.data.user));
          }
        }
        return newToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('velan:reconnecting', { detail: false }));
    }
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;

    // Network error, timeout, 5xx, 429 -> NEVER log out; notify reconnecting banner
    if (!error?.response || status >= 500 || status === 429) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('velan:reconnecting', { detail: true }));
      }
      return Promise.reject(error);
    }

    if (status === 403 && error?.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('velan:password_change_required'));
      }
      return Promise.reject(error);
    }

    // Silent refresh on 401 (avoid infinite loop on /auth/refresh or /auth/login)
    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !String(originalRequest.url || '').includes('/auth/refresh') &&
      !String(originalRequest.url || '').includes('/auth/login')
    ) {
      originalRequest._retry = true;
      const newToken = await silentRefreshToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } else if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('velan:session_invalid'));
      }
    }

    return Promise.reject(error);
  }
);
