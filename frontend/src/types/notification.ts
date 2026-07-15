// ── Notification types ───────────────────────────────────────────────────────

export type NotificationType =
  | 'complaint_created'
  | 'complaint_assigned'
  | 'status_changed'
  | 'progress_update'
  | 'complaint_resolved'
  | 'duplicate_detected'

export interface Notification {
  id:           string
  user_id:      string
  title:        string
  message:      string
  type:         NotificationType
  complaint_id: string | null
  is_read:      boolean
  created_at:   string
}

export interface NotificationListResponse {
  total:     number
  unread:    number
  page:      number
  page_size: number
  items:     Notification[]
}

export interface UnreadCountResponse {
  unread_count: number
}

export interface NotificationPreference {
  user_id:        string
  email_enabled:  boolean
  in_app_enabled: boolean
  updated_at:     string
}
