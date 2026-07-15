// ── Auth & User types ────────────────────────────────────────────────────────

export type UserRole =
  | 'citizen'
  | 'ward_officer'
  | 'zonal_officer'
  | 'dept_head'
  | 'admin'

export type AuthProvider = 'google' | 'email'

export interface User {
  id:            string
  email:         string
  full_name:     string
  role:          UserRole
  auth_provider: AuthProvider
  avatar_url?:   string | null
  phone?:        string | null
  is_active:     boolean
  created_at:    string
  updated_at:    string
}

/** POST /auth/login — admin email+password (OAuth2 form) */
export interface LoginRequest {
  username: string   // email used as username (OAuth2 compat)
  password: string
}

/** POST /auth/google — Firebase ID token */
export interface GoogleAuthRequest {
  id_token: string
}

export interface TokenResponse {
  access_token: string
  token_type:   string
  user:         User
}

export interface AuthState {
  user:             User | null
  token:            string | null
  isLoggedIn:       boolean
  isAdmin:          boolean
  isWardOfficer:    boolean
  isZonalOfficer:   boolean
  isDeptHead:       boolean
  isCitizen:        boolean
  isAnyOfficer:     boolean   // ward_officer | zonal_officer | dept_head
}
