/**
 * pages/citizen/ComplaintDetailPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full complaint detail view with timeline, status, AI info, map preview.
 */

import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Calendar, ChevronRight, Clock, User, Tag, Cpu,
  RefreshCcw, AlertCircle, CheckCircle2, Camera, Star, X, ThumbsUp, ThumbsDown,
} from 'lucide-react'

import { TopBar }                 from '@/components/layout/TopBar'
import { StatusBadge }            from '@/components/ui/Badge'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { EmptyState }             from '@/components/ui/EmptyState'
import { Button }                 from '@/components/ui/Button'
import { Input, Textarea }        from '@/components/ui/Input'
import { useToast }               from '@/components/ui/Toast'
import { useComplaint, useComplaintTimeline, useUpdateComplaint, useDeleteComplaint } from '@/hooks/useComplaints'
import { feedbackApi }            from '@/api/feedback'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'
import type { TimelineEntry } from '@/types/complaint'

// ── Timeline event row ────────────────────────────────────────────────────────

const EVENT_ICONS: Record<string, typeof CheckCircle2> = {
  created:          CheckCircle2,
  status_changed:   RefreshCcw,
  status_change:    RefreshCcw,
  assigned:         User,
  progress_update:  Clock,
  resolved:         CheckCircle2,
  resolution_image: Camera,
}

function TimelineRow({ event, isLast }: { event: TimelineEntry; isLast: boolean }) {
  const Icon = EVENT_ICONS[event.event_type] ?? Clock
  const isResolutionImage = event.event_type === 'resolution_image'
  const isAfterPhoto      = isResolutionImage && (event.image_type === 'AFTER' || event.image_type === 'after')

  return (
    <div className="flex gap-3">
      {/* Left column */}
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          isAfterPhoto ? 'bg-[#DCFCE7]' : 'bg-[#EEF2FF]'
        }`}>
          <Icon size={13} className={isAfterPhoto ? 'text-[#16A34A]' : 'text-[#111827]'} strokeWidth={2} />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-[#E5E7EB] my-1" />}
      </div>

      {/* Right content */}
      <div className={`flex-1 pb-4`}>
        {/* Label */}
        {isResolutionImage ? (
          <div className="flex items-center gap-1.5 mb-1.5">
            <p className={`text-[13px] font-bold ${
              isAfterPhoto ? 'text-[#16A34A]' : 'text-[#111827]'
            }`}>
              {isAfterPhoto ? '✅ Resolution Proof Photo' : '📷 Before Photo'}
            </p>
            {isAfterPhoto && (
              <span className="text-[9px] font-bold bg-[#DCFCE7] text-[#16A34A] px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                Resolved
              </span>
            )}
          </div>
        ) : (
          <p className="text-[13px] font-semibold text-[#111827] capitalize">
            {event.event_type.replace(/_/g, ' ')}
          </p>
        )}

        {/* Progress message */}
        {event.message && (
          <p className="text-[12px] text-[#6B7280] mt-0.5">{event.message}</p>
        )}

        {/* Status change arrow */}
        {(event.old_status || event.new_status) && (
          <div className="flex items-center gap-2 mt-1">
            {event.old_status && (
              <StatusBadge status={event.old_status as never} size="sm" />
            )}
            {event.old_status && event.new_status && (
              <ChevronRight size={12} className="text-[#9CA3AF]" />
            )}
            {event.new_status && (
              <StatusBadge status={event.new_status as never} size="sm" />
            )}
          </div>
        )}

        {/* Resolution proof photo */}
        {isResolutionImage && event.secure_url && (
          <div className={`mt-2 rounded-2xl overflow-hidden border-2 ${
            isAfterPhoto ? 'border-[#86EFAC]' : 'border-[#E5E7EB]'
          }`}>
            <img
              src={event.secure_url}
              alt={isAfterPhoto ? 'Resolution proof' : 'Before photo'}
              className="w-full max-h-56 object-cover"
              loading="lazy"
            />
            {isAfterPhoto && (
              <div className="px-3 py-2 bg-[#F0FDF4] flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-[#16A34A]" />
                <p className="text-[11px] font-semibold text-[#16A34A]">
                  Officer confirmed resolution
                </p>
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-[#9CA3AF] mt-1.5">
          {new Date(event.timestamp).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
          {event.actor_name && ` · ${event.actor_name}`}
        </p>
      </div>
    </div>
  )
}

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-xl bg-[#F9FAFB] flex items-center justify-center shrink-0">
        <Icon size={15} className="text-[#6B7280]" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[11px] text-[#9CA3AF] font-medium">{label}</p>
        <p className="text-[14px] text-[#111827] font-semibold mt-0.5">{value}</p>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

import { useState } from 'react'

export default function ComplaintDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { toast } = useToast()

  const {
    data: complaint, isLoading: detailLoading, isError: detailError, refetch,
  } = useComplaint(id ?? '')

  const {
    data: timeline, isLoading: timelineLoading,
  } = useComplaintTimeline(id ?? '')

  const updateMutation = useUpdateComplaint()
  const deleteMutation = useDeleteComplaint()

  const [editing, setEditing]         = useState(false)
  const [editTitle, setEditTitle]     = useState('')
  const [editDesc, setEditDesc]       = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Verdict & Rating state
  const [showRatingModal, setShowRatingModal]   = useState(false)
  const [showRejectModal, setShowRejectModal]   = useState(false)
  const [rating, setRating]                     = useState(0)
  const [hoverRating, setHoverRating]           = useState(0)
  const [ratingComment, setRatingComment]       = useState('')
  const [rejectReason, setRejectReason]         = useState('')
  const [verdictLoading, setVerdictLoading]     = useState(false)

  const handleAccept = async () => {
    if (!id) return
    setVerdictLoading(true)
    try {
      await feedbackApi.submitVerdict(id, 'accepted')
      refetch()
      setShowRatingModal(true)
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error('Error', detail ?? 'Could not submit verdict.')
    } finally {
      setVerdictLoading(false)
    }
  }

  const handleReject = async () => {
    if (!id) return
    setVerdictLoading(true)
    try {
      await feedbackApi.submitVerdict(id, 'rejected', rejectReason)
      toast.success('Complaint Reopened', 'The officer will be notified and fix the issue.')
      setShowRejectModal(false)
      setRejectReason('')
      refetch()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error('Error', detail ?? 'Could not submit verdict.')
    } finally {
      setVerdictLoading(false)
    }
  }

  const handleRatingSubmit = async () => {
    if (!id || rating === 0) return
    try {
      await feedbackApi.submitFeedback(id, rating, ratingComment.trim() || undefined)
      toast.success('Thanks for rating! ⭐', 'Your feedback helps improve the service.')
      setShowRatingModal(false)
      refetch()
    } catch {
      toast.error('Error', 'Could not submit rating.')
    }
  }

  const canEdit = complaint?.status === 'submitted'

  const startEdit = () => {
    if (!complaint) return
    setEditTitle(complaint.title)
    setEditDesc(complaint.description)
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!complaint) return
    try {
      await updateMutation.mutateAsync({ id: complaint.id, data: { title: editTitle, description: editDesc } })
      toast.success('Updated!', 'Complaint updated successfully.')
      setEditing(false)
      refetch()
    } catch {
      toast.error('Update failed', 'Could not update complaint.')
    }
  }

  const handleDelete = async () => {
    if (!complaint) return
    try {
      await deleteMutation.mutateAsync(complaint.id)
      toast.success('Deleted', 'Complaint has been removed.')
      navigate(-1)
    } catch {
      toast.error('Delete failed', 'Could not delete this complaint.')
    }
  }

  if (detailError) {
    return (
      <div className="min-h-dvh bg-[#F9FAFB] flex flex-col">
        <TopBar title="Complaint" showBack />
        <EmptyState
          Icon={AlertCircle}
          title="Complaint not found"
          description="This complaint may have been removed or you don't have access."
          action={<Button variant="secondary" onClick={() => navigate(-1)}>Go Back</Button>}
        />
      </div>
    )
  }

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="min-h-dvh bg-[#F9FAFB] flex flex-col"
    >
      <TopBar
        title="Complaint Detail"
        showBack
        rightElement={
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCcw size={15} />
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto pb-24">
        <motion.div
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className="space-y-4 pt-3"
        >
          {/* ── Header card ──────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="mx-4 bg-white rounded-3xl border border-[#E5E7EB] p-5"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            {detailLoading ? (
              <SkeletonText lines={3} />
            ) : complaint ? (
              <>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <StatusBadge status={complaint.status} showDot />
                  <span className="text-[11px] text-[#9CA3AF]">
                    #{complaint.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                {editing ? (
                  <div className="space-y-3">
                    <Input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      placeholder="Title"
                    />
                    <Textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={4}
                      placeholder="Description"
                    />
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-[20px] font-extrabold text-[#111827] leading-tight tracking-tight">
                      {complaint.title}
                    </h1>
                    <p className="text-[14px] text-[#6B7280] mt-2 leading-relaxed">
                      {complaint.description}
                    </p>
                    {canEdit && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-[#F3F4F6]">
                        <Button variant="secondary" size="sm" onClick={startEdit}>
                          ✏️ Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="text-red-500 hover:bg-red-50"
                        >
                          🗑️ Delete
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : null}
          </motion.div>

          {/* ── Details card ─────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="mx-4 bg-white rounded-2xl border border-[#E5E7EB] divide-y divide-[#F3F4F6] px-4"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            {detailLoading ? (
              <div className="py-4 space-y-3">
                {[0,1,2,3].map(i => (
                  <div key={i} className="flex gap-3">
                    <Skeleton width={32} height={32} rounded />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton height={10} className="w-1/3" />
                      <Skeleton height={14} className="w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : complaint ? (
              <>
                <InfoRow
                  icon={Tag}
                  label="Category"
                  value={complaint.category?.name ?? '—'}
                />
                <InfoRow
                  icon={MapPin}
                  label="Location"
                  value={complaint.location.address || `${complaint.location.latitude.toFixed(4)}, ${complaint.location.longitude.toFixed(4)}`}
                />
                <InfoRow
                  icon={Calendar}
                  label="Filed on"
                  value={new Date(complaint.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                />
                {complaint.ai_category && (
                  <InfoRow
                    icon={Cpu}
                    label="AI Classification"
                    value={complaint.ai_category}
                  />
                )}
                {complaint.severity_score != null && (
                  <InfoRow
                    icon={AlertCircle}
                    label="Severity Score"
                    value={`${complaint.severity_score} / 10`}
                  />
                )}
              </>
            ) : null}
          </motion.div>

          {/* ── AI Insights card ───────────────────────────────────────────── */}
          {complaint && (complaint.ai_category || complaint.severity_score != null) && (
            <motion.div variants={fadeUp} className="px-4">
              <div
                className="rounded-2xl border border-[#E0E7FF] p-4"
                style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F0FDF4 100%)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-[#111827] flex items-center justify-center">
                    <Cpu size={12} className="text-white" />
                  </div>
                  <p className="text-[12px] font-bold text-[#111827] uppercase tracking-wider">Gemini AI Insights</p>
                </div>

                {complaint.ai_category && (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-0.5">Classified As</p>
                    <p className="text-[14px] font-bold text-[#111827]">{complaint.ai_category}</p>
                  </div>
                )}

                {complaint.severity_score != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Priority Level</p>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        complaint.severity_score >= 8 ? 'bg-red-100 text-red-600' :
                        complaint.severity_score >= 5 ? 'bg-amber-100 text-amber-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {complaint.severity_score >= 8 ? 'High' :
                         complaint.severity_score >= 5 ? 'Medium' : 'Low'} · {complaint.severity_score}/10
                      </span>
                    </div>
                    <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          complaint.severity_score >= 8 ? 'bg-red-500' :
                          complaint.severity_score >= 5 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(complaint.severity_score / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {complaint.matched_complaint_id && (
                  <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <AlertCircle size={13} className="text-amber-500 shrink-0" />
                    <p className="text-[11px] text-amber-700 font-medium">
                      Similar complaint detected in your area. Your report has been linked.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Photos ───────────────────────────────────────────────────── */}
          {complaint?.images && complaint.images.length > 0 && (
            <motion.div variants={fadeUp} className="px-4">
              <p className="text-[13px] font-bold text-[#111827] mb-2">Photos</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {complaint.images.map(img => (
                  <img
                    key={img.id}
                    src={img.image_url}
                    alt="Complaint"
                    className="w-24 h-24 rounded-xl object-cover border border-[#E5E7EB] shrink-0"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Verification Card (pending_verification) ───────────────────── */}
          {complaint?.status === 'pending_verification' && (
            <motion.div variants={fadeUp} className="px-4">
              <div
                className="rounded-2xl border-2 border-amber-300 p-5 space-y-4"
                style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shrink-0">
                    <Camera size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[14px] font-extrabold text-amber-900">Officer Marked This Resolved</p>
                    <p className="text-[11px] text-amber-700">Please verify if the issue is actually fixed</p>
                  </div>
                </div>

                {complaint.resolution_photo_url && (
                  <img
                    src={complaint.resolution_photo_url}
                    alt="Resolution proof"
                    className="w-full h-48 object-cover rounded-xl border border-amber-200"
                  />
                )}

                {complaint.resolution_note && (
                  <div className="bg-white/70 rounded-xl p-3 border border-amber-200">
                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">Officer's Note</p>
                    <p className="text-[13px] text-[#111827]">{complaint.resolution_note}</p>
                  </div>
                )}

                {complaint.auto_close_at && (
                  <p className="text-[11px] text-amber-700 text-center">
                    ⏰ Auto-closes on {new Date(complaint.auto_close_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} if no response
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    className="flex-1 bg-[#16A34A] hover:bg-[#15803D]"
                    isLoading={verdictLoading}
                    onClick={handleAccept}
                    leftIcon={<ThumbsUp size={15} />}
                  >
                    Yes, Fixed!
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setShowRejectModal(true)}
                    leftIcon={<ThumbsDown size={15} />}
                  >
                    Not Fixed
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Resolved — show citizen rating if exists ─────────────────────── */}
          {complaint?.status === 'resolved' && complaint.feedback && (
            <motion.div variants={fadeUp} className="px-4">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                <p className="text-[12px] font-bold text-green-700 uppercase tracking-wider mb-2">Your Rating</p>
                <div className="flex items-center gap-1 mb-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={20}
                      className={complaint.feedback!.rating >= s
                        ? 'text-amber-400 fill-amber-400' : 'text-[#D1D5DB]'}
                    />
                  ))}
                  <span className="text-[13px] font-bold text-[#111827] ml-1">
                    {complaint.feedback.rating}/5
                  </span>
                </div>
                {complaint.feedback.comment && (
                  <p className="text-[13px] text-[#374151] mt-1">{complaint.feedback.comment}</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Timeline ─────────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="mx-4">
            <p className="text-[15px] font-bold text-[#111827] mb-3">Activity Timeline</p>
            <div
              className="bg-white rounded-2xl border border-[#E5E7EB] p-4"
              style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
            >
              {timelineLoading ? (
                <div className="space-y-4">
                  {[0,1,2].map(i => (
                    <div key={i} className="flex gap-3">
                      <Skeleton width={28} height={28} rounded />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton height={13} className="w-2/3" />
                        <Skeleton height={11} className="w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (timeline?.timeline ?? []).length === 0 ? (
                <p className="text-sm text-[#9CA3AF] text-center py-4">No activity yet</p>
              ) : (
                (timeline?.timeline ?? []).map((event, i, arr) => (
                  <TimelineRow key={i} event={event} isLast={i === arr.length - 1} />
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Delete confirmation modal ───────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
          >
            <h3 className="text-lg font-bold text-[#111827] mb-2">Delete Complaint?</h3>
            <p className="text-sm text-[#6B7280] mb-4">
              This action cannot be undone. The complaint and all associated data will be permanently removed.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-red-500 hover:bg-red-600"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Star Rating Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showRatingModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-5"
            >
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[20px] font-extrabold text-[#111827]">Rate the Service</h2>
                    <p className="text-[12px] text-[#6B7280] mt-0.5">How well was your complaint handled?</p>
                  </div>
                  <button
                    onClick={() => setShowRatingModal(false)}
                    className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280]"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Stars */}
                <div className="flex justify-center gap-3 my-5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(s)}
                      className="transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star
                        size={40}
                        className={
                          (hoverRating || rating) >= s
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-[#D1D5DB]'
                        }
                      />
                    </button>
                  ))}
                </div>

                {rating > 0 && (
                  <p className="text-center text-[13px] font-semibold text-[#6B7280] mb-4">
                    {['','Poor','Fair','Good','Very Good','Excellent!'][rating]}
                  </p>
                )}

                <Textarea
                  value={ratingComment}
                  onChange={e => setRatingComment(e.target.value)}
                  rows={3}
                  placeholder="Optional comment..."
                  className="mb-4"
                />

                <Button
                  fullWidth
                  variant="primary"
                  disabled={rating === 0}
                  onClick={handleRatingSubmit}
                >
                  Submit Rating
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Reject Reason Bottom Sheet ──────────────────────────────────── */}
      <AnimatePresence>
        {showRejectModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => !verdictLoading && setShowRejectModal(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-[var(--bottom-nav-h,0px)] md:bottom-0 inset-x-0 bg-white rounded-t-3xl z-50 shadow-2xl"
            >
              <div className="p-5 space-y-4">
                <div className="w-12 h-1.5 bg-[#E5E7EB] rounded-full mx-auto mb-1" />
                <div>
                  <h2 className="text-[18px] font-extrabold text-[#111827]">What's wrong?</h2>
                  <p className="text-[12px] text-[#6B7280]">Tell us why the issue isn't fixed</p>
                </div>

                <div className="space-y-2">
                  {['Issue not fixed at all', 'Partially fixed', 'Wrong location addressed', 'Other'].map(reason => (
                    <button
                      key={reason}
                      onClick={() => setRejectReason(reason)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-[13px] font-medium transition-colors ${
                        rejectReason === reason
                          ? 'border-red-400 bg-red-50 text-red-700'
                          : 'border-[#E5E7EB] text-[#111827] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                <Button
                  fullWidth
                  variant="primary"
                  className="bg-red-500 hover:bg-red-600"
                  disabled={!rejectReason}
                  isLoading={verdictLoading}
                  onClick={handleReject}
                >
                  Reject & Reopen
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
