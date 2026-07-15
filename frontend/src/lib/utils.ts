/**
 * lib/utils.ts — Shared utilities
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn/ui cn() helper — merges Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format ISO date string to "Jun 12, 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  })
}

/** Format ISO date string to relative time: "2 hours ago" */
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1)  return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7)     return `${days}d ago`
  return formatDate(iso)
}

/** Map complaint status → display label */
export const STATUS_LABELS: Record<string, string> = {
  submitted:    'Submitted',
  under_review: 'Under Review',
  in_progress:  'In Progress',
  resolved:     'Resolved',
  rejected:     'Rejected',
}

/** Map complaint status → Tailwind CSS class */
export function statusClass(status: string): string {
  return `status-${status}` // defined in index.css
}

/** Truncate text to `n` chars with ellipsis */
export function truncate(text: string, n = 80): string {
  return text.length > n ? `${text.slice(0, n)}…` : text
}
