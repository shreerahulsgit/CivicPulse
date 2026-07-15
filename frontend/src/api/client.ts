/**
 * api/client.ts — Axios instance
 *
 * Reads JWT token from Zustand auth store on every request.
 * On 401 → clears auth and redirects to /login.
 */

/// <reference types="vite/client" />
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

// ── Request interceptor — attach JWT ─────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  // Read token directly from localStorage to avoid circular Zustand import
  const token = localStorage.getItem('civicpulse_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor — handle 401 (expired/invalid token) ────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear all auth state
      localStorage.removeItem('civicpulse_token')
      localStorage.removeItem('civicpulse_auth')   // Zustand persist key
      // Hard redirect — carries a flag so LoginPage can show a "session expired" toast
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?expired=1'
      }
    }
    return Promise.reject(error)
  }
)
