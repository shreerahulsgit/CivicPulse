/**
 * api/analytics.ts — Analytics API calls
 */

import { apiClient } from './client'
import type {
  DashboardMetrics,
  DepartmentAnalytics,
  OfficerAnalytics,
  TrendAnalytics,
  WardAnalytics,
} from '@/types/admin'

export const analyticsApi = {
  dashboard: async (): Promise<DashboardMetrics> => {
    const res = await apiClient.get<DashboardMetrics>('/analytics/dashboard')
    return res.data
  },

  departments: async (): Promise<DepartmentAnalytics[]> => {
    const res = await apiClient.get<DepartmentAnalytics[]>('/analytics/departments')
    return res.data
  },

  officers: async (): Promise<OfficerAnalytics[]> => {
    const res = await apiClient.get<OfficerAnalytics[]>('/analytics/officers')
    return res.data
  },

  wards: async (): Promise<WardAnalytics[]> => {
    const res = await apiClient.get<WardAnalytics[]>('/analytics/wards')
    return res.data
  },

  trends: async (granularity: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<TrendAnalytics> => {
    const res = await apiClient.get<TrendAnalytics>('/analytics/trends', { params: { granularity } })
    return res.data
  },
}
