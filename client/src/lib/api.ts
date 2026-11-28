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

export interface RefreshOutcome {
  token: string | null;
  user?: any;
  sessionInvalid?: boolean;
  transientError?: boolean;
}

let refreshPromise: Promise<RefreshOutcome> | null = null;

export async function silentRefreshToken(): Promise<RefreshOutcome> {
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
        return { token: newToken, user: res.data?.user };
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          return { token: null, sessionInvalid: true };
        }
        return { token: null, transientError: true };
      })
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
      const outcome = await silentRefreshToken();
      if (outcome.token) {
        originalRequest.headers.Authorization = `Bearer ${outcome.token}`;
        return api(originalRequest);
      } else if (outcome.sessionInvalid && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('velan:session_invalid'));
      } else if (outcome.transientError && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('velan:reconnecting', { detail: true }));
      }
    }

    return Promise.reject(error);
  }
);
