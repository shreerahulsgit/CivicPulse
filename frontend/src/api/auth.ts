/**
 * api/auth.ts — Auth API calls
 *
 * Methods:
 *   googleLogin     — POST /auth/google  (Firebase ID token → JWT)
 *   adminLogin      — POST /auth/login   (email+password form, Swagger compat)
 *   citizenLogin    — POST /auth/login/json (email+password JSON for citizens)
 *   citizenRegister — POST /auth/register (citizen self-registration)
 *   me              — GET  /auth/me (current user profile)
 */

import { apiClient } from './client'
import type { LoginRequest, GoogleAuthRequest, TokenResponse, User } from '@/types/auth'

export const authApi = {
  /** Google Sign-In: send Firebase ID token to backend */
  googleLogin: async (data: GoogleAuthRequest): Promise<TokenResponse> => {
    const res = await apiClient.post<TokenResponse>('/auth/google', data)
    return res.data
  },

  /** Admin login: email + password (OAuth2 form-data for Swagger compat) */
  adminLogin: async (data: LoginRequest): Promise<TokenResponse> => {
    const form = new URLSearchParams()
    form.append('username', data.username)
    form.append('password', data.password)
    const res = await apiClient.post<TokenResponse>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return res.data
  },

  /** Citizen / officer email+password login — JSON body */
  citizenLogin: async (email: string, password: string): Promise<TokenResponse> => {
    const res = await apiClient.post<TokenResponse>('/auth/login/json', { email, password })
    return res.data
  },

  /** Citizen self-registration — creates new email-auth citizen account */
  citizenRegister: async (data: {
    full_name: string
    email: string
    phone?: string
    password: string
  }): Promise<TokenResponse> => {
    const res = await apiClient.post<TokenResponse>('/auth/register', data)
    return res.data
  },

  /** Get current authenticated user profile */
  me: async (): Promise<User> => {
    const res = await apiClient.get<User>('/auth/me')
    return res.data
  },
}
