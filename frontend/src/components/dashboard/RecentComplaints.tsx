/**
 * src/components/dashboard/RecentComplaints.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Last 5 complaints list with status badges, category, date, skeleton loading
 */

import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CaretRight, WarningCircle } from '@phosphor-icons/react'
import { StatusBadge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { stagger, fadeUp } from '@/lib/motion'
import { ROUTES } from '@/router/routes'
import type { Complaint } from '@/types/complaint'

// ── Category icon colour map ──────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  pothole:            { bg: '#FEE2E2', text: '#DC2626' },
  garbage:            { bg: '#DCFCE7', text: '#16A34A' },
  water:              { bg: '#DBEAFE', text: '#2563EB' },
  drainage:           { bg: '#F9FAFB', text: '#111827' },
  streetlight:        { bg: '#FEF3C7', text: '#D97706' },
  road:               { bg: '#FCE7F3', text: '#BE185D' },
}

function getCategoryStyle(slug: string) {
  const key = Object.keys(CATEGORY_COLORS).find(k => slug?.toLowerCase().includes(k))
  return key ? CATEGORY_COLORS[key] : { bg: '#F3F4F6', text: '#6B7280' }
}

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return `${diffDays}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ── Complaint row ─────────────────────────────────────────────────────────────

function ComplaintRow({ complaint }: { complaint: Complaint }) {
  const navigate = useNavigate()
  const catStyle = getCategoryStyle(complaint.category?.name ?? '')

  return (
    <motion.div
      variants={fadeUp}
      onClick={() => navigate(ROUTES.COMPLAINT_DETAIL.replace(':id', complaint.id))}
      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer
                 hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors"
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
    >
      {/* Category dot */}
      <div
        className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold"
        style={{ background: catStyle.bg, color: catStyle.text }}
      >
        {(complaint.category?.name ?? 'Issue').slice(0, 2).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#111827] truncate leading-snug">
          {complaint.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <StatusBadge status={complaint.status} showDot size="sm" />
          <span className="text-[11px] text-[#9CA3AF]">
            {formatDateShort(complaint.created_at)}
          </span>
        </div>
      </div>

      {/* Chevron */}
      <CaretRight size={16} color="#D1D5DB" weight="bold" className="shrink-0" />
    </motion.div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

interface RecentComplaintsProps {
  complaints: Complaint[]
  isLoading:  boolean
  isError:    boolean
  onRetry:    () => void
  onViewAll:  () => void
}

export function RecentComplaints({
  complaints, isLoading, isError, onRetry, onViewAll,
}: RecentComplaintsProps) {
  const recent = complaints.slice(0, 5)

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-[15px] font-bold text-[#111827] tracking-tight">
          Recent Complaints
        </h2>
        {complaints.length > 0 && (
          <button
            onClick={onViewAll}
            className="text-sm font-semibold text-[#111827] hover:underline underline-offset-2"
          >
            View all
          </button>
        )}
      </div>

      {/* Card */}
      <div
        className="mx-4 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
      >
        {isLoading ? (
          <div className="p-3 space-y-3">
            {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : isError ? (
          <EmptyState
            Icon={WarningCircle}
            title="Couldn't load complaints"
            description="Tap to retry"
            action={
              <button
                onClick={onRetry}
                className="text-sm font-semibold text-[#111827]"
              >
                Retry
              </button>
            }
            size="sm"
          />
        ) : recent.length === 0 ? (
          <EmptyState
            title="No complaints yet"
            description="Report your first civic issue and track its progress here."
            size="sm"
          />
        ) : (
          <motion.div
            variants={stagger.container}
            initial="hidden"
            animate="show"
          >
            {recent.map((c, i) => (
              <div key={c.id}>
                <ComplaintRow complaint={c} />
                {i < recent.length - 1 && (
                  <div className="h-px bg-[#F3F4F6] mx-4" />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  )
}
