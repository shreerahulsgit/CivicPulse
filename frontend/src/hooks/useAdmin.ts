/**
 * hooks/useAdmin.ts — Admin Control Center hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { analyticsApi } from '@/api/analytics'
import { queryKeys } from '@/lib/queryClient'

// ── Analytics Queries ─────────────────────────────────────────────────────────

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.analyticsDashboard(),
    queryFn:  analyticsApi.dashboard,
  })
}

export function useAdminTrends(granularity: 'daily' | 'weekly' | 'monthly' = 'daily') {
  return useQuery({
    queryKey: [...queryKeys.analyticsTrends(), granularity],
    queryFn:  () => analyticsApi.trends(granularity),
  })
}

export function useAdminDepartmentAnalytics() {
  return useQuery({
    queryKey: queryKeys.analyticsDepartments(),
    queryFn:  analyticsApi.departments,
  })
}

export function useAdminOfficerAnalytics() {
  return useQuery({
    queryKey: queryKeys.analyticsOfficers(),
    queryFn:  analyticsApi.officers,
  })
}

// ── Workload Queries ──────────────────────────────────────────────────────────

export function useOfficerWorkloads() {
  return useQuery({
    queryKey: ['admin', 'workloads', 'officers'],
    queryFn:  adminApi.officerWorkloads,
  })
}

export function useDepartmentWorkloads() {
  return useQuery({
    queryKey: ['admin', 'workloads', 'departments'],
    queryFn:  adminApi.departmentWorkloads,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useReassignComplaint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, officerId, reason }: { id: string; officerId: string; reason: string }) =>
      adminApi.reassign(id, officerId, reason),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.complaint(id) })
      qc.invalidateQueries({ queryKey: ['admin', 'workloads'] })
    },
  })
}

export function useEscalateComplaint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.escalate(id, reason),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.complaint(id) })
      qc.invalidateQueries({ queryKey: queryKeys.timeline(id) })
    },
  })
}
