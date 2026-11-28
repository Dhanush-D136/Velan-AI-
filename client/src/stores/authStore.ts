import { create } from 'zustand';
import { UserSummary } from '@velan/shared';
import { getOrCreateDeviceId, syncNativeDeviceId } from '@/lib/device';
import { api, silentRefreshToken } from '@/lib/api';

const readStoredUser = (): UserSummary | null => {
  try {
    const raw = localStorage.getItem('velan_user');
    return raw ? (JSON.parse(raw) as UserSummary) : null;
  } catch {
    return null;
  }
};

const authChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('velan_auth_channel')
    : null;

interface AuthState {
  user: UserSummary | null;
  token: string | null;
  deviceId: string;
  isAuthenticated: boolean;
  isHydrating: boolean;
  initialising: boolean;
  setUser: (user: UserSummary | null, token?: string | null) => void;
  hydrateSession: () => Promise<void>;
  logout: (reason?: string) => void;
  getDeviceId: () => string;
}

syncNativeDeviceId();

const initialToken = localStorage.getItem('velan_token');
const initialUser = initialToken ? readStoredUser() : null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialUser,
  token: initialToken,
  deviceId: getOrCreateDeviceId(),
  isAuthenticated: !!initialToken,
  isHydrating: true,
  initialising: true,

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
    const nextToken = token !== undefined ? token : localStorage.getItem('velan_token');
    set({
      user,
      token: nextToken,
      isAuthenticated: !!nextToken && !!user,
      isHydrating: false,
      initialising: false,
    });
    authChannel?.postMessage({ type: 'SYNC_USER', user, token: nextToken });
  },

  hydrateSession: async () => {
    set({ isHydrating: true, initialising: true });

    try {
      // 1. Attempt silent refresh using httpOnly 90-day rotating cookie first (deduplicated)
      const outcome = await silentRefreshToken();

      if (outcome.token && outcome.user) {
        set({
          user: outcome.user,
          token: outcome.token,
          isAuthenticated: true,
          isHydrating: false,
          initialising: false,
        });
        return;
      }

      if (outcome.transientError) {
        const cached = readStoredUser();
        const tok = localStorage.getItem('velan_token');
        set({
          user: cached,
          token: tok,
          isAuthenticated: !!cached && !!tok,
          isHydrating: false,
          initialising: false,
        });
        return;
      }

      // 2. Fallback to existing access token + /api/auth/me
      const token = get().token || localStorage.getItem('velan_token');
      if (!token) {
        set({ user: null, token: null, isAuthenticated: false, isHydrating: false, initialising: false });
        return;
      }

      const res = await api.get('/api/auth/me');
      if (res.data?.user) {
        localStorage.setItem('velan_user', JSON.stringify(res.data.user));
        set({
          user: res.data.user,
          token,
          isAuthenticated: true,
          isHydrating: false,
          initialising: false,
        });
      } else {
        set({ isHydrating: false, initialising: false });
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        localStorage.removeItem('velan_token');
        localStorage.removeItem('velan_user');
        set({ user: null, token: null, isAuthenticated: false, isHydrating: false, initialising: false });
      } else {
        // Network error / timeout / 5xx / 429: NEVER log out on transient failures
        const cached = readStoredUser();
        const tok = localStorage.getItem('velan_token');
        set({
          user: cached,
          token: tok,
          isAuthenticated: !!cached && !!tok,
          isHydrating: false,
          initialising: false,
        });
      }
    }
  },

  logout: (reason?: string) => {
    const token = localStorage.getItem('velan_token');
    if (token) {
      api.post('/api/logout', { reason: reason || 'logout' }).catch(() => {});
    }
    localStorage.removeItem('velan_token');
    localStorage.removeItem('velan_user');
    set({ user: null, token: null, isAuthenticated: false, isHydrating: false, initialising: false });
    authChannel?.postMessage({ type: 'LOGOUT' });
  },

  getDeviceId: () => getOrCreateDeviceId(),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('velan:session_invalid', () => {
    localStorage.removeItem('velan_token');
    localStorage.removeItem('velan_user');
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isHydrating: false, initialising: false });
  });

  window.addEventListener('velan:password_change_required', () => {
    const curr = useAuthStore.getState().user;
    if (curr && !curr.mustChangePassword) {
      useAuthStore.setState({ user: { ...curr, mustChangePassword: true } });
    }
  });

  authChannel?.addEventListener('message', (ev) => {
    if (ev.data?.type === 'LOGOUT') {
      useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isHydrating: false, initialising: false });
    } else if (ev.data?.type === 'SYNC_USER' && ev.data.user) {
      useAuthStore.setState({ user: ev.data.user, token: ev.data.token, isAuthenticated: !!ev.data.token });
    }
  });
}
