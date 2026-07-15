/**
 * hooks/useAuth.ts — Auth mutation hooks
 *
 * Hooks:
 *   useGoogleLogin() — Firebase Google Sign-In → backend /auth/google
 *   useAdminLogin()  — Email + password → backend /auth/login
 *   useLogout()      — Clear auth state + Firebase session
 */

import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { queryClient } from '@/lib/queryClient'
import { signInWithGoogle, firebaseLogout, handleGoogleRedirectResult } from '@/lib/firebase'
import { ROUTES } from '@/router/routes'
import type { User } from '@/types/auth'

// ── Shared post-login logic ───────────────────────────────────────────────────

function getRoleDashboard(role: string): string {
  switch (role) {
    case 'admin':         return ROUTES.ADMIN_DASHBOARD
    case 'zonal_officer': return ROUTES.ZONAL_DASHBOARD
    case 'ward_officer':
    case 'dept_head':     return ROUTES.OFFICER_DASHBOARD
    default:              return ROUTES.CITIZEN_DASHBOARD
  }
}

async function resolveAndRedirect(
  tokenData: { access_token: string; user: User },
  loginStore: (token: string, user: User) => void,
  navigate: ReturnType<typeof useNavigate>,
) {
  loginStore(tokenData.access_token, tokenData.user)
  const dest = getRoleDashboard(tokenData.user.role)
  navigate(dest, { replace: true })
}

// ── Google Login Hook ─────────────────────────────────────────────────────────

export function useGoogleLogin() {
  const { login } = useAuthStore()
  const navigate   = useNavigate()

  return useMutation({
    mutationFn: async () => {
      // 1. Open Google popup via Firebase (force-refreshes token)
      const { idToken } = await signInWithGoogle()
      // 2. Send fresh Firebase token to our backend
      const tokenData = await authApi.googleLogin({ id_token: idToken })
      return tokenData
    },
    onSuccess: (tokenData) => resolveAndRedirect(tokenData, login, navigate),
  })
}

// ── Handle redirect result (when popup was blocked) ───────────────────────────

export function useHandleGoogleRedirect() {
  const { login } = useAuthStore()
  const navigate   = useNavigate()

  return useMutation({
    mutationFn: async () => {
      const result = await handleGoogleRedirectResult()
      if (!result) return null
      const tokenData = await authApi.googleLogin({ id_token: result.idToken })
      return tokenData
    },
    onSuccess: (tokenData) => {
      if (tokenData) resolveAndRedirect(tokenData, login, navigate)
    },
  })
}

// ── Admin Login Hook (email + password) ───────────────────────────────────────

export function useAdminLogin() {
  const { login } = useAuthStore()
  const navigate   = useNavigate()

  return useMutation({
    mutationFn: authApi.adminLogin,
    onSuccess: (tokenData) => resolveAndRedirect(tokenData, login, navigate),
  })
}

// ── Logout Hook ───────────────────────────────────────────────────────────────

export function useLogout() {
  const { logout } = useAuthStore()
  const navigate   = useNavigate()

  return () => {
    logout()
    queryClient.clear()
    // Also sign out from Firebase
    firebaseLogout().catch(() => {})
    navigate(ROUTES.LOGIN, { replace: true })
  }
}
