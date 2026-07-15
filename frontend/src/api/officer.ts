/**
 * api/officer.ts — Officer Operations API calls
 */

import { apiClient } from './client'
import type { Complaint } from '@/types/complaint'

export const officerApi = {
  complaints:   async (params?: { skip?: number; limit?: number }) => {
    const res = await apiClient.get<Complaint[]>('/officer/complaints', { params })
    return res.data
  },

  pending: async (params?: { skip?: number; limit?: number }) => {
    const res = await apiClient.get<Complaint[]>('/officer/complaints/pending', { params })
    return res.data
  },

  inProgress: async (params?: { skip?: number; limit?: number }) => {
    const res = await apiClient.get<Complaint[]>('/officer/complaints/in-progress', { params })
    return res.data
  },

  accept: async (id: string) => {
    const res = await apiClient.patch<Complaint>(`/officer/complaints/${id}/accept`)
    return res.data
  },

  resolve: async (id: string) => {
    const res = await apiClient.patch<Complaint>(`/officer/complaints/${id}/resolve`)
    return res.data
  },

  addProgress: async (id: string, message: string) => {
    const res = await apiClient.post(`/officer/complaints/${id}/progress`, { message })
    return res.data
  },

  /** Upload a resolution photo (image_type = 'after') before marking resolved */
  uploadResolutionImage: async (id: string, file: File) => {
    const form = new FormData()
    form.append('image_type', 'after')
    form.append('files', file)
    const res = await apiClient.post(
      `/officer/complaints/${id}/resolution-images`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data
  },
}
