import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, KYCStatus } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  publicKey: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  setAuth: (user: User, token: string) => void;
  setPublicKey: (publicKey: string | null) => void;
  setKYCStatus: (status: KYCStatus) => void;
  updateUser: (user: User) => void;
  setAuthLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      publicKey: null,
      isAuthenticated: false,
      isAuthLoading: false,
      setAuth: (user, token) => set({ user, token, publicKey: user.publicKey, isAuthenticated: true }),
      setPublicKey: (publicKey) => set({ publicKey }),
      setKYCStatus: (status) =>
        set((state) => ({
          user: state.user ? { ...state.user, kycStatus: status } : null,
        })),
      updateUser: (user) =>
        set((state) => ({
          user,
          publicKey: user.publicKey ?? state.publicKey,
          isAuthenticated: Boolean(state.token),
        })),
      setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),
      logout: () => set({ user: null, token: null, publicKey: null, isAuthenticated: false, isAuthLoading: false }),
    }),
    {
      name: 'predict-io-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        publicKey: state.publicKey,
        isAuthenticated: state.isAuthenticated,
      }),
      merge: (persistedState, currentState) => {
        const state = (persistedState as Partial<AuthState>) || {};
        const token = state.token ?? currentState.token;
        return {
          ...currentState,
          ...state,
          isAuthenticated: Boolean(token),
          isAuthLoading: false,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setAuthLoading(false);
      },
      storage: {
        getItem: (name) => {
          if (typeof window === 'undefined') return null;
          const value = localStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          if (typeof window !== 'undefined') {
            localStorage.setItem(name, JSON.stringify(value));
          }
        },
        removeItem: (name) => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(name);
          }
        },
      },
    }
  )
);
