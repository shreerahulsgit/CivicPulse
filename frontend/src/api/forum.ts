/**
 * api/forum.ts — Zone Forum REST client
 */

import { apiClient } from './client'

export interface ForumMessage {
  id:            string
  zone_id:       number
  user_id:       string
  user_name:     string
  user_role:     'citizen' | 'ward_officer' | 'zonal_officer' | 'admin' | string
  avatar_url:    string | null
  content:       string
  complaint_ref: string | null
  is_pinned:     boolean
  created_at:    string
}

export interface ZoneInfo {
  zone_id:     number
  zone_name:   string
  ward_number: string | null
}

export interface ZoneOption {
  zone_id:     number
  zone_name:   string
  zone_number: number
}

export const forumApi = {
  /** Resolve the calling user's zone (auto-detect, or pass explicit zone_id) */
  getMyZone: async (zoneId?: number): Promise<ZoneInfo> => {
    const res = await apiClient.get<ZoneInfo>('/forum/my/zone', {
      params: zoneId ? { zone_id: zoneId } : {},
    })
    return res.data
  },

  /** List all available zones for manual picker */
  listZones: async (): Promise<ZoneOption[]> => {
    const res = await apiClient.get<ZoneOption[]>('/forum/zones')
    return res.data
  },

  /** Resolve GPS coordinates to a zone using the existing /geo/resolve endpoint */
  resolveZoneFromGPS: async (lat: number, lng: number): Promise<ZoneInfo> => {
    const res = await apiClient.get('/geo/resolve', { params: { lat, lng } })
    return {
      zone_id:     res.data.zone_id,
      zone_name:   res.data.zone_name,
      ward_number: res.data.ward_number ?? null,
    }
  },

  /** Get message history — pass zone_id for manual-picker users (no ward linked) */
  getMyMessages: async (zoneId: number, limit = 50, beforeId?: string): Promise<ForumMessage[]> => {
    const res = await apiClient.get<ForumMessage[]>('/forum/my/messages', {
      params: { zone_id: zoneId, limit, before_id: beforeId },
    })
    return res.data
  },

  /** Post a message (REST fallback — WS is preferred) */
  postMessage: async (zoneId: number, content: string, complaintRef?: string): Promise<ForumMessage> => {
    const res = await apiClient.post<ForumMessage>(`/forum/${zoneId}/messages`, {
      content,
      complaint_ref: complaintRef ?? null,
    })
    return res.data
  },

  /** Delete a message */
  deleteMessage: async (zoneId: number, msgId: string): Promise<void> => {
    await apiClient.delete(`/forum/${zoneId}/messages/${msgId}`)
  },

  /** Toggle pin (officers only) */
  pinMessage: async (zoneId: number, msgId: string): Promise<ForumMessage> => {
    const res = await apiClient.post<ForumMessage>(`/forum/${zoneId}/messages/${msgId}/pin`)
    return res.data
  },

  /** Get pinned messages */
  getPinned: async (zoneId: number): Promise<ForumMessage[]> => {
    const res = await apiClient.get<ForumMessage[]>(`/forum/${zoneId}/pinned`)
    return res.data
  },
}
