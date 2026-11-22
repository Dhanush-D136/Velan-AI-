import { create } from 'zustand';
import { UserRole, UserSummary } from '@velan/shared';

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

// Generate or retrieve persistent unique device ID for device lock
const getOrCreateDeviceId = (): string => {
  let id = localStorage.getItem('velan_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    localStorage.setItem('velan_device_id', id);
  }
  return id;
};

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
