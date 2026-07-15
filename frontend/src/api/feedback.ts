/**
 * api/feedback.ts — Resolution Proof + Citizen Feedback API client
 */

import { apiClient } from './client'

export interface FeedbackData {
  id:         string
  rating:     number
  comment:    string | null
  created_at: string
}

export const feedbackApi = {
  /** Officer: mark complaint as pending_verification with optional note */
  resolveComplaint: async (
    complaintId: string,
    note?: string,
  ): Promise<{ message: string; auto_close_at: string }> => {
    const res = await apiClient.post(`/complaints/${complaintId}/resolve`, null, {
      params: note ? { note } : {},
    })
    return res.data
  },

  /** Officer: attach Cloudinary resolution photo after uploading via /uploads/image */
  attachResolutionPhoto: async (
    complaintId: string,
    photoUrl: string,
    photoId: string,
  ): Promise<void> => {
    await apiClient.patch(`/complaints/${complaintId}/resolution-photo`, {
      photo_url: photoUrl,
      photo_id:  photoId,
    })
  },

  /** Citizen: accept or reject the officer's resolution */
  submitVerdict: async (
    complaintId: string,
    verdict: 'accepted' | 'rejected',
    reason?: string,
  ): Promise<{ message: string; status: string }> => {
    const res = await apiClient.post(`/complaints/${complaintId}/verdict`, {
      verdict,
      reason: reason ?? null,
    })
    return res.data
  },

  /** Citizen: submit star rating (1–5) after accepting resolution */
  submitFeedback: async (
    complaintId: string,
    rating: number,
    comment?: string,
  ): Promise<{ message: string; rating: number }> => {
    const res = await apiClient.post(`/complaints/${complaintId}/feedback`, {
      rating,
      comment: comment ?? null,
    })
    return res.data
  },

  /** Get feedback for a complaint (owner / officer / admin) */
  getFeedback: async (complaintId: string): Promise<FeedbackData | null> => {
    const res = await apiClient.get<{ feedback: FeedbackData | null }>(
      `/complaints/${complaintId}/feedback`,
    )
    return res.data.feedback
  },
}
