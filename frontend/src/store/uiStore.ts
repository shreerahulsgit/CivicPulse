/**
 * store/uiStore.ts — Global UI State
 */

import { create } from 'zustand'

interface UIStore {
  // Mobile bottom sheet / modal control
  activeModal:    string | null
  openModal:      (id: string) => void
  closeModal:     () => void

  // Global loading overlay (for auth redirects, etc.)
  isGlobalLoading: boolean
  setGlobalLoading:(v: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  activeModal:     null,
  openModal:       (id) => set({ activeModal: id }),
  closeModal:      ()   => set({ activeModal: null }),

  isGlobalLoading: false,
  setGlobalLoading:(v)  => set({ isGlobalLoading: v }),
}))
