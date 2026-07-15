/**
 * api/complaints.ts — Complaints API calls (full CRUD)
 */

import { apiClient } from './client'
import type {
  Complaint,
  ComplaintCreateRequest,
  ComplaintListResponse,
  ComplaintTimeline,
  Category,
} from '@/types/complaint'

export interface ComplaintsParams {
  skip?:      number
  limit?:     number
  status?:    string
  category_id?: number
}

export const complaintsApi = {
  // ── List ────────────────────────────────────────────────────────────────────
  list: async (params?: ComplaintsParams): Promise<ComplaintListResponse> => {
    const res = await apiClient.get<ComplaintListResponse>('/complaints', { params })
    return res.data
  },

  my: async (params?: ComplaintsParams): Promise<ComplaintListResponse> => {
    const res = await apiClient.get<ComplaintListResponse>('/complaints/my', { params })
    return res.data
  },

  // ── Read ────────────────────────────────────────────────────────────────────
  get: async (id: string): Promise<Complaint> => {
    const res = await apiClient.get<Complaint>(`/complaints/${id}`)
    return res.data
  },

  // ── Create ──────────────────────────────────────────────────────────────────
  create: async (data: ComplaintCreateRequest): Promise<Complaint> => {
    const res = await apiClient.post<Complaint>('/complaints', data)
    return res.data
  },

  // ── Update (edit title/description) ─────────────────────────────────────────
  update: async (id: string, data: { title?: string; description?: string }): Promise<Complaint> => {
    const res = await apiClient.patch<Complaint>(`/complaints/${id}`, data)
    return res.data
  },

  // ── Delete ──────────────────────────────────────────────────────────────────
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/complaints/${id}`)
  },

  // ── Timeline ────────────────────────────────────────────────────────────────
  timeline: async (id: string): Promise<ComplaintTimeline> => {
    const res = await apiClient.get<ComplaintTimeline>(`/complaints/${id}/timeline`)
    return res.data
  },

  // ── Categories ──────────────────────────────────────────────────────────────
  categories: async (): Promise<Category[]> => {
    const res = await apiClient.get<Category[]>('/categories')
    return res.data
  },

  // ── Image upload ────────────────────────────────────────────────────────────
  uploadImages: async (files: File[]): Promise<{ uploaded: { secure_url: string }[]; count: number }> => {
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    const res = await apiClient.post<{ uploaded: { secure_url: string }[]; count: number }>(
      '/uploads/images',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return res.data
  },
}
