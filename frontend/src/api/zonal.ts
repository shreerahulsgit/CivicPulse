/**
 * api/zonal.ts — Zonal Officer API client
 */

import { apiClient } from './client'
import type { AxiosResponse } from 'axios'

export interface ZonalDashboardStats {
  zone_id: number
  zone_name: string
  total_complaints: number
  submitted: number
  in_progress: number
  resolved: number
  total_wards: number
}

export interface ZonalComplaintItem {
  id: string
  title: string
  status: string
  ward_id: number | null
  ward_number: string | null  // e.g. "W-14" or "14"
  ward_name: string | null    // e.g. "Thiruvottiyur"
  category_id: number | null
  severity_score: number | null
  created_at: string
  assigned_officer_id: string | null
}

export interface WardOfficerCreate {
  full_name: string
  email: string
  password: string
  phone?: string
  ward_id: number
}

export interface WardOfficer {
  id: string
  full_name: string
  email: string
  phone: string | null
  is_active: boolean
  zone_id: number | null
  ward_id: number | null
  ward_number: string | null  // human-readable, e.g. "14"
  ward_name: string | null    // e.g. "Thiruvottiyur"
  created_at: string
}

export interface ZoneWard {
  id: number
  ward_number: string
  ward_name: string | null
  has_officer: boolean
}

export const zonalApi = {
  getDashboard: (): Promise<ZonalDashboardStats> =>
    apiClient.get('/zonal/dashboard').then((r: AxiosResponse<ZonalDashboardStats>) => r.data),

  getComplaints: (params?: { skip?: number; limit?: number; status_filter?: string }): Promise<ZonalComplaintItem[]> =>
    apiClient.get('/zonal/complaints', { params }).then((r: AxiosResponse<ZonalComplaintItem[]>) => r.data),

  getWardOfficers: (): Promise<WardOfficer[]> =>
    apiClient.get('/zonal/ward-officers').then((r: AxiosResponse<WardOfficer[]>) => r.data),

  getZoneWards: (): Promise<ZoneWard[]> =>
    apiClient.get('/zonal/wards').then((r: AxiosResponse<ZoneWard[]>) => r.data),

  createWardOfficer: (payload: WardOfficerCreate): Promise<WardOfficer> =>
    apiClient.post('/zonal/ward-officers', payload).then((r: AxiosResponse<WardOfficer>) => r.data),

  deactivateWardOfficer: (officerId: string): Promise<WardOfficer> =>
    apiClient.put(`/zonal/ward-officers/${officerId}/deactivate`).then((r: AxiosResponse<WardOfficer>) => r.data),
}
