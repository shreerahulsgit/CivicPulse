/**
 * pages/citizen/ComplaintTrackingPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Live tracking view — status stepper + real officer timeline events.
 */

import { useParams, useNavigate } from 'react-router-dom'
import { motion }  from 'framer-motion'
import {
  User, Cpu, CheckCircle2, Clock, RefreshCcw, AlertCircle,
  FileText, ArrowRight, Image, MessageSquare, AlertTriangle,
} from 'lucide-react'

import { TopBar }                 from '@/components/layout/TopBar'
import { StatusBadge }            from '@/components/ui/Badge'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { EmptyState }             from '@/components/ui/EmptyState'
import { Button }                 from '@/components/ui/Button'
import { useComplaint, useComplaintTimeline } from '@/hooks/useComplaints'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'
import type { TimelineEntry } from '@/types/complaint'

// ── Status steps ──────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { id: 'submitted',    label: 'Submitted',    desc: "We've received your complaint.",              Icon: FileText },
  { id: 'under_review', label: 'Under Review', desc: 'Categorising and routing your issue.',        Icon: Cpu },
  { id: 'assigned',     label: 'Assigned',     desc: 'An officer has been assigned.',               Icon: User },
  { id: 'in_progress',  label: 'In Progress',  desc: 'Work is actively being done.',                Icon: Clock },
  { id: 'resolved',     label: 'Resolved',     desc: 'This issue has been resolved. Thank you!',   Icon: CheckCircle2 },
]

// ── Timeline Event Card ───────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function EventRow({ event }: { event: TimelineEntry }) {
  const statusMap: Record<string, string> = {
    submitted: 'Submitted', under_review: 'Under Review', assigned: 'Assigned',
    in_progress: 'In Progress', resolved: 'Resolved', rejected: 'Rejected',
  }

  return (
    <div className="flex gap-3 py-3 border-b border-[#F3F4F6] last:border-0">
      {/* Icon */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
        event.event_type === 'status_change'    ? 'bg-[#EEF2FF]' :
        event.event_type === 'progress_update'  ? 'bg-[#DBEAFE]' :
        event.event_type === 'escalation'       ? 'bg-[#FEF3C7]' : 'bg-[#DCFCE7]'
      }`}>
        {event.event_type === 'status_change'    && <ArrowRight    size={14} className="text-[#111827]" />}
        {event.event_type === 'progress_update'  && <MessageSquare size={14} className="text-[#2563EB]" />}
        {event.event_type === 'resolution_image' && <Image         size={14} className="text-[#16A34A]" />}
        {event.event_type === 'escalation'       && <AlertTriangle size={14} className="text-amber-500" />}
      </div>

      <div className="flex-1 min-w-0">
        {event.event_type === 'status_change' && (
          <p className="text-[13px] font-semibold text-[#111827]">
            Status → <span className="text-[#111827]">{statusMap[event.new_status ?? ''] ?? event.new_status}</span>
          </p>
        )}
        {event.event_type === 'progress_update' && (
          <p className="text-[13px] font-medium text-[#111827] leading-snug">{event.message}</p>
        )}
        {event.event_type === 'escalation' && (
          <div>
            <p className="text-[12px] font-bold text-amber-600 mb-0.5">⚠️ Complaint Escalated</p>
            <p className="text-[12px] text-amber-700/80 leading-snug">{event.message}</p>
          </div>
        )}
        {event.event_type === 'resolution_image' && (() => {
          const isAfter = event.image_type === 'AFTER' || event.image_type === 'after'
          return (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <p className={`text-[13px] font-bold ${isAfter ? 'text-[#16A34A]' : 'text-[#111827]'}`}>
                  {isAfter ? '✅ Resolution Proof Photo' : '📷 Before Photo'}
                </p>
                {isAfter && (
                  <span className="text-[9px] font-bold bg-[#DCFCE7] text-[#16A34A] px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    Confirmed
                  </span>
                )}
              </div>
              {event.secure_url && (
                <div className={`rounded-2xl overflow-hidden border-2 ${isAfter ? 'border-[#86EFAC]' : 'border-[#E5E7EB]'}`}>
                  <img
                    src={event.secure_url}
                    alt={isAfter ? 'Resolution proof' : 'Before photo'}
                    className="w-full max-h-52 object-cover"
                    loading="lazy"
                  />
                  {isAfter && (
                    <div className="px-3 py-2 bg-[#F0FDF4] flex items-center gap-1.5">
                      <Image size={11} className="text-[#16A34A]" />
                      <p className="text-[11px] font-semibold text-[#16A34A]">Officer confirmed resolution</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}
        <div className="flex items-center gap-2 mt-1">
          {event.actor_name && (
            <span className="text-[10px] text-[#6B7280] font-medium">{event.actor_name}</span>
          )}
          {event.actor_name && <span className="text-[#D1D5DB] text-[10px]">·</span>}
          <span className="text-[10px] text-[#9CA3AF]">{timeAgo(event.timestamp)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComplaintTrackingPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: complaint, isLoading: detailLoading, isError, refetch } = useComplaint(id ?? '')
  const { data: timelineData, isLoading: timelineLoading } = useComplaintTimeline(id ?? '')

  const events     = timelineData?.timeline ?? []
  const hasTimeline = events.length > 0

  if (isError) {
    return (
      <div className="min-h-dvh bg-[#F9FAFB] flex flex-col">
        <TopBar title="Live Tracking" showBack />
        <EmptyState
          Icon={AlertCircle}
          title="Complaint not found"
          description="We couldn't load the tracking details."
          action={<Button variant="secondary" onClick={() => navigate(-1)}>Go Back</Button>}
        />
      </div>
    )
  }

  const currentStepIndex = complaint
    ? STATUS_STEPS.findIndex(s => s.id === complaint.status)
    : 0

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden" animate="show" exit="exit"
      className="min-h-dvh bg-[#F9FAFB] flex flex-col"
    >
      <TopBar
        title="Live Tracking"
        showBack
        rightElement={
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCcw size={15} />
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto pb-32">
        <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4 pt-3">

          {/* ── Summary Card ──────────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="mx-4 bg-white rounded-3xl border border-[#E5E7EB] p-5 relative overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none"
              style={{ background: 'radial-gradient(circle, #111827 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

            {detailLoading ? (
              <SkeletonText lines={2} />
            ) : complaint ? (
              <>
                <div className="flex items-start justify-between gap-3 mb-2 relative z-10">
                  <div>
                    <h1 className="text-[18px] font-extrabold text-[#111827] leading-tight tracking-tight line-clamp-1">
                      {complaint.title}
                    </h1>
                    <p className="text-[12px] text-[#6B7280] mt-0.5 font-mono">
                      #{complaint.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <StatusBadge status={complaint.status} showDot />
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-[12px] font-medium text-[#111827] bg-[#EEF2FF] w-fit px-2.5 py-1 rounded-lg">
                  <Clock size={14} />
                  <span>Est. Resolution: 48h</span>
                </div>
              </>
            ) : null}
          </motion.div>

          {/* ── Vertical Status Stepper ──────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="px-4">
            <h2 className="text-[15px] font-bold text-[#111827] mb-3 ml-1">Status</h2>
            <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 pl-7"
              style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
              {detailLoading ? (
                <div className="space-y-6 py-2">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="flex gap-4">
                      <Skeleton width={24} height={24} rounded />
                      <Skeleton height={14} className="w-1/2 mt-1" />
                    </div>
                  ))}
                </div>
              ) : complaint ? (
                <div className="relative">
                  <div className="absolute left-[11px] top-3 bottom-4 w-[2px] bg-[#F3F4F6] -z-10" />
                  <motion.div
                    className="absolute left-[11px] top-3 w-[2px] bg-[#111827] -z-10"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(0, currentStepIndex * 25)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  />
                  {STATUS_STEPS.map((step, i) => {
                    const isCompleted = i <= currentStepIndex
                    const isCurrent   = i === currentStepIndex
                    return (
                      <div key={step.id} className="relative flex items-start gap-4 mb-6 last:mb-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 transition-colors duration-500
                          ${isCompleted ? 'bg-[#111827] border-[#111827]' : 'bg-white border-[#D1D5DB]'}`}>
                          {isCompleted
                            ? <CheckCircle2 size={12} className="text-white" strokeWidth={3} />
                            : <div className="w-1.5 h-1.5 rounded-full bg-[#D1D5DB]" />}
                        </div>
                        <div className="flex-1 pb-1">
                          <p className={`text-[14px] font-bold ${isCurrent ? 'text-[#111827]' : isCompleted ? 'text-[#374151]' : 'text-[#9CA3AF]'}`}>
                            {step.label}
                          </p>
                          {isCurrent && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-1.5 text-[12px] text-[#6B7280] bg-[#F9FAFB] p-2.5 rounded-xl border border-[#F3F4F6]"
                            >
                              {step.desc}
                            </motion.div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </motion.div>

          {/* ── Officer Assigned Card ─────────────────────────────────────────── */}
          {complaint && currentStepIndex >= 2 && (
            <motion.div variants={fadeUp} className="px-4">
              <div className="bg-[#1F2937] rounded-3xl p-4 flex items-center gap-4 shadow-lg">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <User size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wider">Assigned Officer</p>
                  <p className="text-[15px] font-bold text-white leading-tight">
                    {(complaint as any).assigned_officer_name ?? 'Field Agent'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Activity Timeline ─────────────────────────────────────────────── */}
          {(hasTimeline || timelineLoading) && (
            <motion.div variants={fadeUp} className="px-4">
              <h2 className="text-[15px] font-bold text-[#111827] mb-3 ml-1">Activity</h2>
              <div className="bg-white rounded-3xl border border-[#E5E7EB] px-4 py-2"
                style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
                {timelineLoading ? (
                  <div className="space-y-3 py-3">
                    {[1,2,3].map(i => <Skeleton key={i} height={50} rounded />)}
                  </div>
                ) : (
                  events.map((event, i) => <EventRow key={i} event={event} />)
                )}
              </div>
            </motion.div>
          )}

        </motion.div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-[var(--bottom-nav-h)] md:bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#F9FAFB] to-transparent pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <Button
            fullWidth variant="outline"
            className="bg-white rounded-2xl h-[52px] font-bold shadow-sm"
            onClick={() => navigate(`/complaints/${id}`)}
          >
            View Full Details
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
