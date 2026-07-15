/**
 * components/layout/SharedPagesLayout.tsx
 *
 * Wraps shared pages (Forum, Notifications, Profile) in the correct
 * role-specific layout so the right BottomNav renders for every role.
 */

import { lazy, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const CitizenLayout = lazy(() => import('./CitizenLayout'))
const OfficerLayout = lazy(() => import('./OfficerLayout'))
const ZonalLayout   = lazy(() => import('./ZonalLayout'))

export default function SharedPagesLayout() {
  const { user } = useAuthStore()

  if (!user) return <Outlet />

  const role = user.role

  if (role === 'ward_officer' || role === 'dept_head') {
    return (
      <Suspense fallback={null}>
        <OfficerLayout />
      </Suspense>
    )
  }

  if (role === 'zonal_officer') {
    return (
      <Suspense fallback={null}>
        <ZonalLayout />
      </Suspense>
    )
  }

  // citizen (default)
  return (
    <Suspense fallback={null}>
      <CitizenLayout />
    </Suspense>
  )
}
