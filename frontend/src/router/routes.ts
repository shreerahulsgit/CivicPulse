/** Route path constants — single source of truth */

export const ROUTES = {
  // Pre-auth
  SPLASH:      '/splash',
  ONBOARDING:  '/onboarding',

  // Public
  LOGIN:    '/login',

  // Citizen
  CITIZEN_DASHBOARD:   '/',
  REPORT_COMPLAINT:    '/report',
  COMPLAINT_DETAIL:    '/complaints/:id',
  COMPLAINT_TRACKING:  '/complaints/:id/track',
  NOTIFICATIONS:       '/notifications',
  PROFILE:             '/profile',
  FORUM:               '/forum',

  // Officer
  OFFICER_DASHBOARD:   '/officer',
  OFFICER_COMPLAINTS:  '/officer/complaints',
  OFFICER_DETAIL:      '/officer/complaints/:id',

  // Admin
  ADMIN_DASHBOARD:     '/admin',
  ADMIN_ANALYTICS:     '/admin/analytics',
  ADMIN_COMPLAINTS:    '/admin/complaints',
  ADMIN_OFFICERS:      '/admin/officers',
  ADMIN_DEPARTMENTS:   '/admin/departments',
  ADMIN_USERS:         '/admin/users',
  ADMIN_ESCALATED:     '/admin/escalated',

  // Zonal Officer
  ZONAL_DASHBOARD:     '/zonal',
  ZONAL_COMPLAINTS:    '/zonal/complaints',
  ZONAL_WARD_OFFICERS: '/zonal/ward-officers',
} as const

/** Helper to build parameterised paths */
export const buildPath = {
  complaintDetail:   (id: string) => `/complaints/${id}`,
  complaintTracking: (id: string) => `/complaints/${id}/track`,
  officerDetail:     (id: string) => `/officer/complaints/${id}`,
}
