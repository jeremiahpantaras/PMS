import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, AuthTokens, AuthState } from '@/types';
import { authService } from '@/services/authService';

interface AuthStore extends AuthState {
  setAuth: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  setLoading: (isLoading: boolean) => void;
  verifyAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (user, tokens) => {
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
        localStorage.setItem('user', JSON.stringify(user));
        // Mark the session as active. sessionStorage is cleared automatically
        // when the browser is closed, ensuring users must log in again.
        sessionStorage.setItem('session_active', '1');
        set({
          user,
          tokens,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('auth-storage');
        sessionStorage.removeItem('session_active');
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      updateUser: (user) => {
        // 1. Update standalone 'user' key
        localStorage.setItem('user', JSON.stringify(user));

        // 2. CRITICAL: Also patch the zustand persisted 'auth-storage' key
        //    so that on page refresh, rehydration uses the updated user
        try {
          const raw = localStorage.getItem('auth-storage');
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.state = { ...parsed.state, user };
            localStorage.setItem('auth-storage', JSON.stringify(parsed));
          }
        } catch (e) {
          console.error('Failed to patch auth-storage:', e);
        }

        // 3. Update zustand in-memory state
        set({ user });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      verifyAuth: async () => {
        console.log('🔐 Verifying authentication...');

        // If the browser was closed, sessionStorage is wiped automatically.
        // Absence of the marker means a new browser session — force re-login.
        if (!sessionStorage.getItem('session_active')) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          localStorage.removeItem('auth-storage');
          set({ isAuthenticated: false, isLoading: false, user: null, tokens: null });
          return false;
        }

        const token       = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');
        const userStr     = localStorage.getItem('user');

        if (!token || !userStr) {
          console.log('❌ No token or user found');
          set({ isAuthenticated: false, isLoading: false, user: null, tokens: null });
          return false;
        }

        try {
          const user = JSON.parse(userStr);
          const response = await authService.verifyToken(token);

          if (response.valid && refreshToken) {
            console.log('✅ Token valid, restoring session');
            set({
              user,
              tokens: { access: token, refresh: refreshToken },
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          } else {
            console.log('❌ Token invalid or expired');
            get().logout();
            return false;
          }
        } catch (error: any) {
          console.error('❌ Auth verification failed:', error);
          if (error.response) {
            console.error('Response error:', error.response.status, error.response.data);
          } else if (error.request) {
            console.error('Request error - no response received');
          } else {
            console.error('Error:', error.message);
          }
          get().logout();
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);