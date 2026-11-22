import { create } from 'zustand';
import { UserRole, UserSummary } from '@velan/shared';
import { getOrCreateDeviceId, syncNativeDeviceId } from '@/lib/device';

interface AuthState {
  user: UserSummary | null;
  token: string | null;
  deviceId: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: UserSummary | null, token?: string | null) => void;
  logout: () => void;
  getDeviceId: () => string;
}

// Kick off native device id synchronization if on Capacitor
syncNativeDeviceId();

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('velan_token'),
  deviceId: getOrCreateDeviceId(),
  isAuthenticated: !!localStorage.getItem('velan_token'),
  isLoading: false,
  setUser: (user, token) => {
    if (token) {
      localStorage.setItem('velan_token', token);
    } else if (token === null) {
      localStorage.removeItem('velan_token');
    }
    set({
      user,
      token: token !== undefined ? token : localStorage.getItem('velan_token'),
      isAuthenticated: !!user,
      isLoading: false,
    });
  },
  logout: () => {
    localStorage.removeItem('velan_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
  getDeviceId: () => getOrCreateDeviceId(),
}));
