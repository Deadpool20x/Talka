import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface AuthState {
  userId: string | null;
  email: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (userId: string, email: string) => void;
  clearUser: () => void;
  init: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (userId, email) =>
    set({ userId, email, isAuthenticated: true, isLoading: false }),

  clearUser: () =>
    set({ userId: null, email: null, isAuthenticated: false, isLoading: false }),

  init: () => {
    // Hydrate existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        set({
          userId: session.user.id,
          email: session.user.email ?? null,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ userId: null, email: null, isAuthenticated: false, isLoading: false });
      }
    });

    // Keep store synchronized with real-time auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({
          userId: session.user.id,
          email: session.user.email ?? null,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ userId: null, email: null, isAuthenticated: false, isLoading: false });
      }
    });

    return () => subscription.unsubscribe();
  },
}));

// Typed selectors
export const selectIsAuthenticated = (s: AuthState) => s.isAuthenticated;
export const selectUserId = (s: AuthState) => s.userId;
