import { create } from 'zustand';
import { UserSummary } from '@velan/shared';
import { getOrCreateDeviceId, syncNativeDeviceId } from '@/lib/device';
import { api } from '@/lib/api';

const readStoredUser = (): UserSummary | null => {
  try {
    const raw = localStorage.getItem('velan_user');
    return raw ? (JSON.parse(raw) as UserSummary) : null;
  } catch {
    return null;
  }
};

interface AuthState {
  user: UserSummary | null;
  token: string | null;
  deviceId: string;
  isAuthenticated: boolean;
  isHydrating: boolean;
  setUser: (user: UserSummary | null, token?: string | null) => void;
  hydrateSession: () => Promise<void>;
  logout: () => void;
  getDeviceId: () => string;
}

// Kick off native device id synchronization if on Capacitor
syncNativeDeviceId();

const initialToken = localStorage.getItem('velan_token');
const initialUser = initialToken ? readStoredUser() : null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialUser,
  token: initialToken,
  deviceId: getOrCreateDeviceId(),
  isAuthenticated: !!initialToken,
  isHydrating: !!initialToken,
  setUser: (user, token) => {
    if (token) {
      localStorage.setItem('velan_token', token);
    } else if (token === null) {
      localStorage.removeItem('velan_token');
    }
    if (user) {
      localStorage.setItem('velan_user', JSON.stringify(user));
    } else if (user === null) {
      localStorage.removeItem('velan_user');
    }
    set({
      user,
      token: token !== undefined ? token : localStorage.getItem('velan_token'),
      isAuthenticated: !!(token !== undefined ? token : localStorage.getItem('velan_token')),
      isHydrating: false,
    });
  },
  hydrateSession: async () => {
    const token = get().token || localStorage.getItem('velan_token');
    if (!token) {
      set({ user: null, token: null, isAuthenticated: false, isHydrating: false });
      return;
    }

    set({ isHydrating: true });
    try {
      const res = await api.get('/api/auth/me');
      if (res.data?.user) {
        localStorage.setItem('velan_user', JSON.stringify(res.data.user));
        set({
          user: res.data.user,
          token,
          isAuthenticated: true,
          isHydrating: false,
        });
      } else {
        set({ isHydrating: false });
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('velan_token');
        localStorage.removeItem('velan_user');
        set({ user: null, token: null, isAuthenticated: false, isHydrating: false });
      } else {
        // Network/cold-start fallback: keep cached user if available
        set({ isHydrating: false });
      }
    }
  },
  logout: () => {
    localStorage.removeItem('velan_token');
    localStorage.removeItem('velan_user');
    set({ user: null, token: null, isAuthenticated: false, isHydrating: false });
  },
  getDeviceId: () => getOrCreateDeviceId(),
}));
