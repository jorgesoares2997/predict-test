import { create } from 'zustand';

interface UiState {
  isLogoutModalOpen: boolean;
  setLogoutModalOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isLogoutModalOpen: false,
  setLogoutModalOpen: (open) => set({ isLogoutModalOpen: open }),
}));
