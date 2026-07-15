/**
 * api/admin.ts — Admin Control Center API calls
 */

import { apiClient } from './client'
import type {
  ComplaintAudit,
  ComplaintEscalation,
  DepartmentWorkload,
  OfficerWorkload,
} from '@/types/admin'

export const adminApi = {
  reassign: async (id: string, officer_id: string, reason: string) => {
    const res = await apiClient.patch(`/admin/complaints/${id}/reassign`, { officer_id, reason })
    return res.data
  },

  overrideDepartment: async (id: string, department_id: number, reason: string) => {
    const res = await apiClient.patch(`/admin/complaints/${id}/department`, { department_id, reason })
    return res.data
  },

  overrideOfficer: async (id: string, officer_id: string, reason: string) => {
    const res = await apiClient.patch(`/admin/complaints/${id}/officer`, { officer_id, reason })
    return res.data
  },

  escalate: async (id: string, reason: string): Promise<ComplaintEscalation> => {
    const res = await apiClient.post<ComplaintEscalation>(`/admin/complaints/${id}/escalate`, { reason })
    return res.data
  },

  audit: async (id: string): Promise<ComplaintAudit> => {
    const res = await apiClient.get<ComplaintAudit>(`/admin/complaints/${id}/audit`)
    return res.data
  },

  officerWorkloads: async (): Promise<OfficerWorkload[]> => {
    const res = await apiClient.get<OfficerWorkload[]>('/admin/workloads/officers')
    return res.data
  },

  departmentWorkloads: async (): Promise<DepartmentWorkload[]> => {
    const res = await apiClient.get<DepartmentWorkload[]>('/admin/workloads/departments')
    return res.data
  },

  createOfficer: async (data: {
    full_name: string
    email: string
    phone?: string
    password: string
    role: string
    zone_id?: number | null
    ward_id?: number | null
  }) => {
    const res = await apiClient.post('/admin/officers', data)
    return res.data
  },

  listOfficers: async () => {
    const res = await apiClient.get('/admin/officers')
    return res.data
  },

  listOfficerAssignments: async (officerId: string) => {
    const res = await apiClient.get(`/admin/officers/${officerId}/assignments`)
    return res.data
  },

  addOfficerAssignment: async (officerId: string, data: { department_id: number; ward_id: number }) => {
    const res = await apiClient.post(`/admin/officers/${officerId}/assignments`, data)
    return res.data
  },

  deleteOfficerAssignment: async (officerId: string, assignmentId: string) => {
    await apiClient.delete(`/admin/officers/${officerId}/assignments/${assignmentId}`)
  },

  listDepartments: async () => {
    const res = await apiClient.get('/admin/departments')
    return res.data
  },

  listWards: async () => {
    const res = await apiClient.get('/admin/wards')
    return res.data
  },

  listAllComplaints: async (params: {
    status?: string
    category_id?: number
    ward_id?: number
    officer_id?: string
    dept_id?: number
    search?: string
    skip?: number
    limit?: number
  }) => {
    const res = await apiClient.get('/admin/complaints', { params })
    return res.data
  },

  // ── User CRUD ────────────────────────────────────────────────────────────────

  listUsers: async (params?: { role_filter?: string; search?: string; skip?: number; limit?: number }) => {
    const res = await apiClient.get('/admin/users', { params })
    return res.data as UserListItem[]
  },

  getUser: async (userId: string) => {
    const res = await apiClient.get(`/admin/users/${userId}`)
    return res.data as UserListItem
  },

  createUser: async (data: {
    full_name: string
    email: string
    phone?: string
    password: string
    role: string
    zone_id?: number | null
  }) => {
    const res = await apiClient.post('/admin/users', data)
    return res.data as UserListItem
  },

  updateUser: async (userId: string, data: {
    full_name?: string
    phone?: string
    role?: string
    zone_id?: number | null
    is_active?: boolean
    password?: string
  }) => {
    const res = await apiClient.put(`/admin/users/${userId}`, data)
    return res.data as UserListItem
  },

  deleteUser: async (userId: string, hardDelete = false) => {
    await apiClient.delete(`/admin/users/${userId}`, { params: { hard_delete: hardDelete } })
  },

  getEscalated: async (): Promise<EscalatedComplaint[]> => {
    const res = await apiClient.get<EscalatedComplaint[]>('/admin/escalated')
    return res.data
  },
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EscalatedComplaint {
  id:               string
  title:            string
  status:           string
  severity_score:   number | null
  escalation_level: number       // 1 = zonal, 2 = admin
  escalated_at:     string | null
  created_at:       string
  ward_number:      string | null
  ward_name:        string | null
  zone_name:        string | null
  assigned_officer: string | null
}


// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserListItem {
  id:            string
  full_name:     string
  email:         string
  phone:         string | null
  role:          string
  auth_provider: string
  is_active:     boolean
  zone_id:       number | null
  created_at:    string
}
