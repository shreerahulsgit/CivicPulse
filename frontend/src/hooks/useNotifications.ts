/**
 * hooks/useNotifications.ts — Notification query + mutation hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { queryKeys } from '@/lib/queryClient'

export function useNotifications(params?: { skip?: number; limit?: number; unread_only?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn:  () => notificationsApi.list(params),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey:       queryKeys.unreadCount(),
    queryFn:        notificationsApi.unreadCount,
    refetchInterval: 15_000,
    staleTime:       10_000,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: queryKeys.notifPrefs(),
    queryFn:  notificationsApi.getPreference,
  })
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.updatePreference,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifPrefs() })
    },
  })
}
