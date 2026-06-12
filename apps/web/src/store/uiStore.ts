import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface UIState {
  isMobile: boolean;
  showCreateGroup: boolean;
  showGroupInfo: boolean;
  selectedMessageId: string | null;
  toast: Toast | null;

  setIsMobile: (isMobile: boolean) => void;
  setShowCreateGroup: (show: boolean) => void;
  setShowGroupInfo: (show: boolean) => void;
  setSelectedMessageId: (id: string | null) => void;
  showToast: (message: string, type: ToastType, durationMs?: number) => void;
  clearToast: () => void;
}

let toastId = 0;

export const useUIStore = create<UIState>((set) => ({
  isMobile: false,
  showCreateGroup: false,
  showGroupInfo: false,
  selectedMessageId: null,
  toast: null,

  setIsMobile: (isMobile) => set({ isMobile }),
  setShowCreateGroup: (show) => set({ showCreateGroup: show }),
  setShowGroupInfo: (show) => set({ showGroupInfo: show }),
  setSelectedMessageId: (id) => set({ selectedMessageId: id }),

  showToast: (message, type, durationMs = 3000) => {
    const id = ++toastId;
    set({ toast: { id, message, type } });
    // Auto-clear after duration
    setTimeout(() => {
      set((s) => (s.toast?.id === id ? { toast: null } : {}));
    }, durationMs);
  },

  clearToast: () => set({ toast: null }),
}));

// Typed selectors
export const selectToast = (s: UIState) => s.toast;
export const selectIsMobile = (s: UIState) => s.isMobile;
export const selectShowCreateGroup = (s: UIState) => s.showCreateGroup;
export const selectShowGroupInfo = (s: UIState) => s.showGroupInfo;
