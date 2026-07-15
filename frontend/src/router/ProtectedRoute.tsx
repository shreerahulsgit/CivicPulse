/**
 * router/ProtectedRoute.tsx — Route Guard Component
 *
 * Usage:
 *   <ProtectedRoute requiredRole="citizen" />     — requires citizen role only
 *   <ProtectedRoute requiredRole="admin" />       — requires admin role
 *   <ProtectedRoute requiredRole="officer" />     — requires ward_officer or dept_head
 *   <ProtectedRoute requiredRole="zonal_officer" /> — requires zonal_officer role
 *
 * Redirect behaviour:
 *   Not logged in              → /login
 *   Wrong role (citizen→admin) → user's own home
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from './routes'

interface ProtectedRouteProps {
  requiredRole?: 'admin' | 'officer' | 'zonal_officer' | 'citizen'
}

function getUserHome(role: string): string {
  switch (role) {
    case 'admin':         return ROUTES.ADMIN_DASHBOARD
    case 'zonal_officer': return ROUTES.ZONAL_DASHBOARD
    case 'ward_officer':
    case 'dept_head':     return ROUTES.OFFICER_DASHBOARD
    default:              return ROUTES.CITIZEN_DASHBOARD
  }
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isLoggedIn, user } = useAuthStore()
  const location = useLocation()

  // Not authenticated → send to login
  if (!isLoggedIn || !user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  // Role check
  if (requiredRole) {
    if (requiredRole === 'citizen' && user.role !== 'citizen') {
      return <Navigate to={getUserHome(user.role)} replace />
    }
    if (requiredRole === 'admin' && user.role !== 'admin') {
      return <Navigate to={getUserHome(user.role)} replace />
    }
    if (requiredRole === 'zonal_officer' && user.role !== 'zonal_officer') {
      return <Navigate to={getUserHome(user.role)} replace />
    }
    if (requiredRole === 'officer' && !['ward_officer', 'dept_head'].includes(user.role)) {
      return <Navigate to={getUserHome(user.role)} replace />
    }
  }

  return <Outlet />
}

/** Public-only route: redirect logged-in users to their dashboard */
export function PublicOnlyRoute() {
  const { isLoggedIn, user } = useAuthStore()

  if (isLoggedIn && user) {
    return <Navigate to={getUserHome(user.role)} replace />
  }

  return <Outlet />
}
