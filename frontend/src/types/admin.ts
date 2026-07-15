// ── Admin types ──────────────────────────────────────────────────────────────

export interface OfficerWorkload {
  officer_id:           string
  officer_name:         string
  email:                string
  assigned_total:       number
  pending:              number
  in_progress:          number
  resolved_today:       number
  avg_resolution_hours: number | null
}

export interface DepartmentWorkload {
  department_id:        number
  department_name:      string
  total:                number
  open:                 number
  resolved:             number
  avg_resolution_hours: number | null
}

export interface ComplaintEscalation {
  id:           string
  complaint_id: string
  escalated_by: string | null
  reason:       string
  created_at:   string
}

export interface AuditEntry {
  event:      string
  actor_id:   string | null
  actor_name: string | null
  detail:     string
  timestamp:  string
}

export interface ComplaintAudit {
  complaint_id:          string
  title:                 string
  current_status:        string
  department_id:         number | null
  department_name:       string | null
  assigned_officer_id:   string | null
  assigned_officer_name: string | null
  duplicate_group_id:    string | null
  matched_complaint_id:  string | null
  similarity_score:      number | null
  ai_category:           string | null
  escalation_count:      number
  total_events:          number
  audit_trail:           AuditEntry[]
}

// ── Analytics types ──────────────────────────────────────────────────────────

export interface DashboardMetrics {
  total_complaints:     number
  open_complaints:      number
  resolved_complaints:  number
  rejected_complaints:  number
  avg_resolution_hours: number | null
  active_officers:      number
  total_departments:    number
  total_wards:          number
  complaints_today:     number
  complaints_this_week: number
  complaints_this_month:number
}

export interface DepartmentAnalytics {
  department_id:        number
  department_name:      string
  total:                number
  resolved:             number
  pending:              number
  avg_resolution_hours: number | null
}

export interface OfficerAnalytics {
  officer_id:           string
  officer_name:         string
  assigned:             number
  resolved:             number
  avg_completion_hours: number | null
}

export interface WardAnalytics {
  ward_id:   number
  ward_name: string
  count:     number
}


export interface TrendPoint {
  period:               string
  total_complaints:     number
  resolved_complaints:  number
  open_complaints:      number
}

export interface TrendAnalytics {
  granularity:  string
  days_back:    number
  data_points:  TrendPoint[]
}
