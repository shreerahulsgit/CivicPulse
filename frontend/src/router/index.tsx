/**
 * router/index.tsx — Application Router
 */

import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute'
import { ROUTES } from './routes'
import { lazy } from 'react'

// ── Lazy page imports ─────────────────────────────────────────────────────────

// Pre-auth
const SplashPage      = lazy(() => import('@/pages/auth/SplashPage'))
const OnboardingPage  = lazy(() => import('@/pages/auth/OnboardingPage'))

// Public
const LoginPage     = lazy(() => import('@/pages/auth/LoginPage'))

// Citizen
const CitizenLayout           = lazy(() => import('@/components/layout/CitizenLayout'))
const CitizenDashboard        = lazy(() => import('@/pages/citizen/DashboardPage'))
const ReportComplaintPage     = lazy(() => import('@/pages/citizen/ReportComplaintPage'))
const ComplaintDetailPage     = lazy(() => import('@/pages/citizen/ComplaintDetailPage'))
const ComplaintTrackingPage   = lazy(() => import('@/pages/citizen/ComplaintTrackingPage'))
const NotificationsPage       = lazy(() => import('@/pages/citizen/NotificationsPage'))
const ProfilePage             = lazy(() => import('@/pages/citizen/ProfilePage'))
const CitizenForumPage        = lazy(() => import('@/pages/citizen/ForumPage'))

// Officer
const OfficerLayout           = lazy(() => import('@/components/layout/OfficerLayout'))
const OfficerDashboard        = lazy(() => import('@/pages/officer/DashboardPage'))
const AssignedComplaintsPage  = lazy(() => import('@/pages/officer/AssignedComplaintsPage'))
const OfficerComplaintDetail  = lazy(() => import('@/pages/officer/ComplaintDetailPage'))

// Admin
const AdminLayout             = lazy(() => import('@/components/layout/AdminLayout'))
const AdminDashboard          = lazy(() => import('@/pages/admin/DashboardPage'))
const AdminAnalyticsPage      = lazy(() => import('@/pages/admin/AnalyticsPage'))
const AdminComplaintsPage     = lazy(() => import('@/pages/admin/ComplaintsPage'))
const AdminOfficersPage       = lazy(() => import('@/pages/admin/OfficersPage'))
const AdminDepartmentsPage    = lazy(() => import('@/pages/admin/DepartmentsPage'))
const AdminUsersPage          = lazy(() => import('@/pages/admin/UsersPage'))
const AdminEscalatedPage      = lazy(() => import('@/pages/admin/EscalatedPage'))

// Zonal Officer
const ZonalLayout             = lazy(() => import('@/components/layout/ZonalLayout'))
const ZonalDashboard          = lazy(() => import('@/pages/zonal/DashboardPage'))
const ZonalComplaintsPage     = lazy(() => import('@/pages/zonal/ComplaintsPage'))
const ZonalWardOfficersPage   = lazy(() => import('@/pages/zonal/WardOfficersPage'))

// Shared layout wrapper — picks CitizenLayout/OfficerLayout/ZonalLayout by role
const SharedPagesLayout = lazy(() =>
  import('@/components/layout/SharedPagesLayout')
)


export const router = createBrowserRouter([
  // ── Pre-auth (always accessible) ─────────────────────────────────────────
  { path: ROUTES.SPLASH,     element: <SplashPage /> },
  { path: ROUTES.ONBOARDING, element: <OnboardingPage /> },

  // ── Public routes (redirect logged-in users to their home) ───────────────
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: ROUTES.LOGIN, element: <LoginPage /> },
    ],
  },

  // ── Citizen-only routes (no shared pages here) ──────────────────────────
  {
    element: <ProtectedRoute requiredRole="citizen" />,
    children: [
      {
        element: <CitizenLayout />,
        children: [
          { index: true,                     element: <CitizenDashboard /> },
          { path: ROUTES.REPORT_COMPLAINT,   element: <ReportComplaintPage /> },
          { path: ROUTES.COMPLAINT_DETAIL,   element: <ComplaintDetailPage /> },
          { path: ROUTES.COMPLAINT_TRACKING, element: <ComplaintTrackingPage /> },
        ],
      },
    ],
  },

  // ── Shared pages — any logged-in user, layout auto-selected by role ───────
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <SharedPagesLayout />,
        children: [
          { path: ROUTES.FORUM,         element: <CitizenForumPage /> },
          { path: ROUTES.NOTIFICATIONS, element: <NotificationsPage /> },
          { path: ROUTES.PROFILE,       element: <ProfilePage /> },
        ],
      },
    ],
  },

  {
    element: <ProtectedRoute requiredRole="officer" />,
    children: [
      {
        element: <OfficerLayout />,
        children: [
          { path: ROUTES.OFFICER_DASHBOARD,  element: <OfficerDashboard /> },
          { path: ROUTES.OFFICER_COMPLAINTS, element: <AssignedComplaintsPage /> },
          { path: ROUTES.OFFICER_DETAIL,     element: <OfficerComplaintDetail /> },
          // Shared pages — must be inside OfficerLayout so BottomNav renders
          { path: ROUTES.FORUM,              element: <CitizenForumPage /> },
          { path: ROUTES.NOTIFICATIONS,      element: <NotificationsPage /> },
          { path: ROUTES.PROFILE,            element: <ProfilePage /> },
        ],
      },
    ],
  },

  // ── Admin routes ──────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute requiredRole="admin" />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: ROUTES.ADMIN_DASHBOARD,   element: <AdminDashboard /> },
          { path: ROUTES.ADMIN_ANALYTICS,   element: <AdminAnalyticsPage /> },
          { path: ROUTES.ADMIN_COMPLAINTS,  element: <AdminComplaintsPage /> },
          { path: ROUTES.ADMIN_OFFICERS,    element: <AdminOfficersPage /> },
          { path: ROUTES.ADMIN_DEPARTMENTS, element: <AdminDepartmentsPage /> },
          { path: ROUTES.ADMIN_USERS,       element: <AdminUsersPage /> },
          { path: ROUTES.ADMIN_ESCALATED,   element: <AdminEscalatedPage /> },
        ],
      },
    ],
  },

  // ── Zonal Officer routes ──────────────────────────────────────────────────
  {
    element: <ProtectedRoute requiredRole="zonal_officer" />,
    children: [
      {
        element: <ZonalLayout />,
        children: [
          { path: ROUTES.ZONAL_DASHBOARD,     element: <ZonalDashboard /> },
          { path: ROUTES.ZONAL_COMPLAINTS,    element: <ZonalComplaintsPage /> },
          { path: ROUTES.ZONAL_WARD_OFFICERS, element: <ZonalWardOfficersPage /> },
        ],
      },
    ],
  },

  // ── Root redirect → splash ────────────────────────────────────────────────
  { path: '/',  element: <Navigate to={ROUTES.SPLASH} replace /> },
  { path: '*',  element: <Navigate to={ROUTES.SPLASH} replace /> },
])
