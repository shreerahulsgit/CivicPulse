/**
 * store/authStore.ts — Zustand Auth Store
 *
 * Persists to localStorage under key: civicpulse_auth
 *
 * Exposes:
 *   user, token, isLoggedIn, isAdmin, isCitizen, isWardOfficer, etc.
 *   login(), logout(), setUser()
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types/auth'

interface AuthStore {
  user:           User | null
  token:          string | null

  // Derived booleans
  isLoggedIn:     boolean
  isAdmin:        boolean
  isWardOfficer:  boolean
  isZonalOfficer: boolean
  isDeptHead:     boolean
  isCitizen:      boolean
  isAnyOfficer:   boolean

  // Actions
  login:   (token: string, user: User) => void
  logout:  () => void
  setUser: (user: User) => void
}

const _deriveFlags = (user: User | null) => ({
  isLoggedIn:     user !== null,
  isAdmin:        user?.role === 'admin',
  isWardOfficer:  user?.role === 'ward_officer',
  isZonalOfficer: user?.role === 'zonal_officer',
  isDeptHead:     user?.role === 'dept_head',
  isCitizen:      user?.role === 'citizen',
  isAnyOfficer:   ['ward_officer', 'zonal_officer', 'dept_head'].includes(user?.role ?? ''),
})

const _emptyFlags = {
  isLoggedIn:     false,
  isAdmin:        false,
  isWardOfficer:  false,
  isZonalOfficer: false,
  isDeptHead:     false,
  isCitizen:      false,
  isAnyOfficer:   false,
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user:  null,
      token: null,
      ..._emptyFlags,

      login: (token, user) => {
        localStorage.setItem('civicpulse_token', token)
        set({ user, token, ..._deriveFlags(user) })
      },

      logout: () => {
        localStorage.removeItem('civicpulse_token')
        set({ user: null, token: null, ..._emptyFlags })
      },

      setUser: (user) => {
        set({ user, ..._deriveFlags(user) })
      },
    }),
    {
      name:    'civicpulse_auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const flags = _deriveFlags(state.user)
          Object.assign(state, flags)
          if (state.token) {
            localStorage.setItem('civicpulse_token', state.token)
          }
        }
      },
    }
  )
)
