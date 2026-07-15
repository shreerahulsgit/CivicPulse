// ── Complaint types ──────────────────────────────────────────────────────────

export type ComplaintStatus =
  | 'submitted'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'pending_verification'
  | 'resolved'
  | 'rejected'

export interface Location {
  id:        string
  address:   string | null
  latitude:  number
  longitude: number
}

export interface Category {
  id:          number
  name:        string
  description: string | null
}

export interface ComplaintImage {
  id:        string
  image_url: string
}

export interface ComplaintFeedback {
  id:         string
  rating:     number
  comment:    string | null
  created_at: string
}

export interface Complaint {
  id:                   string
  title:                string
  description:          string
  status:               ComplaintStatus
  category_id:          number
  category:             Category
  location:             Location
  user_id:              string
  ward_id?:             number
  department_id?:       number
  assigned_officer_id?: string
  ai_category?:         string
  severity_score?:      number
  duplicate_group_id?:  string
  matched_complaint_id?:string
  similarity_score?:    number
  escalation_level?:    number
  escalated_at?:        string
  is_overdue?:          boolean
  images:               ComplaintImage[]
  // Resolution fields
  resolution_note?:      string | null
  resolution_photo_url?: string | null
  resolution_photo_id?:  string | null
  auto_close_at?:        string | null
  citizen_verdict?:      string | null
  citizen_verdict_at?:   string | null
  feedback?:             ComplaintFeedback | null
  created_at:           string
  updated_at:           string
}

export interface ComplaintCreateRequest {
  title:       string
  description: string
  category_id: number
  location: {
    latitude:  number
    longitude: number
    address?:  string
  }
  image_urls?: string[]
}

export type ComplaintListResponse = Complaint[]

export interface StatusHistoryEntry {
  id:         string
  old_status: ComplaintStatus
  new_status: ComplaintStatus
  updated_by: string
  note?:      string
  updated_at: string
}

export interface ProgressUpdate {
  id:         string
  officer_id: string
  message:    string
  created_at: string
}

export interface ResolutionImage {
  id:         string
  secure_url: string
  image_type: 'before' | 'after'
  uploaded_at:string
}

export interface TimelineEntry {
  event_type:  string
  timestamp:   string
  actor_id?:   string
  actor_name?: string
  old_status?: string
  new_status?: string
  message?:    string
  secure_url?: string
  image_type?: string
}

export interface ComplaintTimeline {
  complaint_id:  string
  total_events:  number
  timeline:      TimelineEntry[]
}
