/**
 * api/notifications.ts — Notifications API calls
 */

import { apiClient } from './client'
import type {
  Notification,
  NotificationListResponse,
  NotificationPreference,
  UnreadCountResponse,
} from '@/types/notification'

export const notificationsApi = {
  list: async (params?: { skip?: number; limit?: number; unread_only?: boolean }): Promise<NotificationListResponse> => {
    const res = await apiClient.get<NotificationListResponse>('/notifications', { params })
    return res.data
  },

  unreadCount: async (): Promise<UnreadCountResponse> => {
    const res = await apiClient.get<UnreadCountResponse>('/notifications/unread-count')
    return res.data
  },

  markRead: async (id: string): Promise<Notification> => {
    const res = await apiClient.patch<Notification>(`/notifications/${id}/read`)
    return res.data
  },

  markAllRead: async (): Promise<{ marked_read: number }> => {
    const res = await apiClient.patch('/notifications/read-all')
    return res.data
  },

  getPreference: async (): Promise<NotificationPreference> => {
    const res = await apiClient.get<NotificationPreference>('/notification-preferences')
    return res.data
  },

  updatePreference: async (data: Partial<Pick<NotificationPreference, 'email_enabled' | 'in_app_enabled'>>): Promise<NotificationPreference> => {
    const res = await apiClient.patch<NotificationPreference>('/notification-preferences', data)
    return res.data
  },
}
