/**
 * lib/queryClient.ts — TanStack Query Client
 *
 * Default configuration:
 *   staleTime:  60s  — cached data considered fresh for 1 minute
 *   gcTime:     5m   — unused queries garbage-collected after 5 minutes
 *   retry:      1    — one retry on failure (avoids hammering 401s)
 *   refetchOnWindowFocus: true — refresh on tab focus (good for notifications)
 */

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            60 * 1000,        // 1 min
      gcTime:               5 * 60 * 1000,    // 5 min
      retry:                1,
      refetchOnWindowFocus: true,
      refetchOnReconnect:   true,
    },
    mutations: {
      retry: 0,
    },
  },
})

// ── Query key factory ─────────────────────────────────────────────────────────
// Centralised so invalidation is always consistent.

export const queryKeys = {
  // Auth
  me: () => ['auth', 'me'] as const,

  // Complaints
  complaints:     (params?: object) => ['complaints', params]              as const,
  myComplaints:   (params?: object) => ['complaints', 'my', params]       as const,
  complaint:      (id: string)      => ['complaints', id]                  as const,
  timeline:       (id: string)      => ['complaints', id, 'timeline']      as const,

  // Notifications
  notifications:  (params?: object) => ['notifications', params]          as const,
  unreadCount:    ()                 => ['notifications', 'unread-count']  as const,
  notifPrefs:     ()                 => ['notifications', 'prefs']         as const,

  // Officer
  officerComplaints:   (params?: object) => ['officer', 'complaints', params]      as const,
  officerPending:      (params?: object) => ['officer', 'pending', params]         as const,
  officerInProgress:   (params?: object) => ['officer', 'in-progress', params]     as const,

  // Analytics
  analyticsDashboard:   () => ['analytics', 'dashboard']    as const,
  analyticsDepartments: () => ['analytics', 'departments']  as const,
  analyticsOfficers:    () => ['analytics', 'officers']     as const,
  analyticsWards:       () => ['analytics', 'wards']        as const,
  analyticsTrends:      () => ['analytics', 'trends']       as const,

  // Admin
  officerWorkloads:     () => ['admin', 'workloads', 'officers']     as const,
  departmentWorkloads:  () => ['admin', 'workloads', 'departments']  as const,
  complaintAudit: (id: string) => ['admin', 'audit', id]            as const,
}
