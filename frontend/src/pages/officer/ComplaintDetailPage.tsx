/**
 * pages/officer/ComplaintDetailPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Officer detailed view of a complaint.
 * Allows Accept, Add Progress, and Resolve actions.
 * Resolving requires a proof-of-resolution photo upload.
 */

import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Calendar, CheckCircle2, AlertCircle,
  MessageSquare, Navigation, RefreshCcw,
  Camera, ImagePlus, X, Upload,
} from 'lucide-react'

import { TopBar }                 from '@/components/layout/TopBar'
import { StatusBadge }            from '@/components/ui/Badge'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { EmptyState }             from '@/components/ui/EmptyState'
import { Button, Textarea }       from '@/components/ui'
import { useToast }               from '@/components/ui/Toast'
import { useComplaint }           from '@/hooks/useComplaints'
import { useAcceptComplaint, useAddProgress } from '@/hooks/useOfficer'
import { feedbackApi }            from '@/api/feedback'
import { apiClient }              from '@/api/client'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'

export default function OfficerComplaintDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { toast } = useToast()

  const { data: complaint, isLoading, isError, refetch } = useComplaint(id ?? '')
  
  // Actions
  const acceptMutation  = useAcceptComplaint()
  const progressMutation = useAddProgress()

  // Progress modal state
  const [showProgress, setShowProgress] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')

  // Resolve modal state
  const [showResolve, setShowResolve]       = useState(false)
  const [resolvePhoto, setResolvePhoto]     = useState<File | null>(null)
  const [resolvePreview, setResolvePreview] = useState<string | null>(null)
  const [resolveNote, setResolveNote]       = useState('')
  const [resolving, setResolving]           = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  if (isError) {
    return (
      <div className="min-h-dvh bg-[#F9FAFB] flex flex-col">
        <TopBar title="Task Details" showBack />
        <EmptyState
          Icon={AlertCircle}
          title="Complaint not found"
          action={<Button variant="secondary" onClick={() => navigate(-1)}>Go Back</Button>}
        />
      </div>
    )
  }

  const handleAccept = async () => {
    if (!id) return
    try {
      await acceptMutation.mutateAsync(id)
      toast.success('Task Accepted', 'You can now log progress or resolve this issue.')
      refetch()
    } catch {
      toast.error('Error', 'Failed to accept task.')
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResolvePhoto(file)
    setResolvePreview(URL.createObjectURL(file))
  }

  const handleRemovePhoto = () => {
    setResolvePhoto(null)
    if (resolvePreview) URL.revokeObjectURL(resolvePreview)
    setResolvePreview(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const handleResolveSubmit = async () => {
    if (!id) return
    setResolving(true)
    try {
      // Step 1: If photo chosen, upload it then attach
      if (resolvePhoto) {
        const form = new FormData()
        form.append('file', resolvePhoto)
        const uploadRes = await apiClient.post<{ public_id: string; secure_url: string }>(
          '/uploads/image', form, { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        await feedbackApi.attachResolutionPhoto(id, uploadRes.data.secure_url, uploadRes.data.public_id)
      }
      // Step 2: Mark pending_verification
      await feedbackApi.resolveComplaint(id, resolveNote.trim() || undefined)
      toast.success('Submitted! 🎉', 'Citizen will be asked to verify the resolution.')
      setShowResolve(false)
      handleRemovePhoto()
      setResolveNote('')
      refetch()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error('Failed to Submit', detail ?? 'Please try again.')
    } finally {
      setResolving(false)
    }
  }

  const handleProgress = async () => {
    if (!id || !progressMsg.trim()) return
    try {
      await progressMutation.mutateAsync({ id, message: progressMsg })
      toast.success('Progress Added', 'The citizen will be notified of this update.')
      setProgressMsg('')
      setShowProgress(false)
      refetch()
    } catch {
      toast.error('Error', 'Failed to add progress.')
    }
  }

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="min-h-dvh bg-[#F9FAFB] flex flex-col relative"
    >
      <TopBar
        title="Task Details"
        showBack
        rightElement={
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCcw size={15} />
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto pb-32">
        <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4 pt-3 px-4">
          
          {/* Header Card */}
          <motion.div variants={fadeUp} className="bg-white rounded-3xl border border-[#E5E7EB] p-5 shadow-sm">
            {isLoading ? <SkeletonText lines={3} /> : complaint ? (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#111827] text-[10px] font-bold">
                      #{complaint.id.slice(0, 8)}
                    </span>
                    <span className="text-[11px] font-bold text-[#6B7280] uppercase">
                      {complaint.category?.name}
                    </span>
                  </div>
                  <StatusBadge status={complaint.status} />
                </div>
                
                <h1 className="text-[20px] font-extrabold text-[#111827] leading-tight mb-2">
                  {complaint.title}
                </h1>
                
                <p className="text-[14px] text-[#374151] leading-relaxed">
                  {complaint.description}
                </p>
                
                {(complaint.ai_category || complaint.severity_score != null) && (
                  <div
                    className="mt-4 p-4 rounded-2xl border border-[#E0E7FF]"
                    style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F0FDF4 100%)' }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 rounded-md bg-[#111827] flex items-center justify-center">
                        <AlertCircle size={11} className="text-white" />
                      </div>
                      <p className="text-[11px] font-bold text-[#111827] uppercase tracking-wider">Gemini AI Insight</p>
                    </div>
                    {complaint.ai_category && (
                      <p className="text-[13px] font-semibold text-[#111827] mb-2">{complaint.ai_category}</p>
                    )}
                    {complaint.severity_score != null && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px] text-[#6B7280] font-bold uppercase">Priority</span>
                          <span className={`text-[11px] font-bold ${
                            complaint.severity_score >= 8 ? 'text-red-600' :
                            complaint.severity_score >= 5 ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            {complaint.severity_score >= 8 ? '🔴 High' :
                             complaint.severity_score >= 5 ? '🟡 Medium' : '🟢 Low'} · {complaint.severity_score}/10
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              complaint.severity_score >= 8 ? 'bg-red-500' :
                              complaint.severity_score >= 5 ? 'bg-amber-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${(complaint.severity_score / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </motion.div>

          {/* Location & Time */}
          <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm divide-y divide-[#F3F4F6]">
            {isLoading ? <div className="p-4"><Skeleton height={40} /></div> : complaint ? (
              <>
                <div className="p-4 flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] flex items-center justify-center shrink-0">
                    <MapPin size={18} className="text-[#6B7280]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-0.5">Location</p>
                    <p className="text-[14px] text-[#111827] font-semibold">{complaint.location.address || 'Location pinned on map'}</p>
                    <p className="text-[12px] text-[#6B7280]">{complaint.location.latitude.toFixed(4)}, {complaint.location.longitude.toFixed(4)}</p>
                  </div>
                  <a 
                    href={`https://maps.google.com/?q=${complaint.location.latitude},${complaint.location.longitude}`}
                    target="_blank" rel="noreferrer"
                    className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#111827] flex items-center justify-center shrink-0"
                  >
                    <Navigation size={18} />
                  </a>
                </div>
                
                <div className="p-4 flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] flex items-center justify-center shrink-0">
                    <Calendar size={18} className="text-[#6B7280]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-0.5">Reported On</p>
                    <p className="text-[14px] text-[#111827] font-semibold">
                      {new Date(complaint.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </>
            ) : null}
          </motion.div>

          {/* Photos */}
          {complaint?.images && complaint.images.length > 0 && (
            <motion.div variants={fadeUp}>
              <h3 className="text-[15px] font-bold text-[#111827] mb-2 px-1">Attached Evidence</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {complaint.images.map(img => (
                  <div key={img.id} className="relative w-32 h-32 rounded-2xl overflow-hidden shrink-0 border border-[#E5E7EB]">
                    <img src={img.image_url} alt="Evidence" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </motion.div>
      </div>

      {/* Action Footer */}
      {complaint && (complaint.status === 'submitted' || complaint.status === 'under_review' || complaint.status === 'in_progress') && (
        <div className="fixed bottom-[var(--bottom-nav-h)] md:bottom-0 inset-x-0 p-4 bg-white border-t border-[#E5E7EB] z-40">
          <div className="max-w-md mx-auto flex gap-3">
            {(complaint.status === 'submitted' || complaint.status === 'under_review') ? (
              <Button 
                fullWidth 
                size="lg" 
                onClick={handleAccept} 
                isLoading={acceptMutation.isPending}
                leftIcon={<CheckCircle2 size={18} />}
              >
                Accept Task
              </Button>
            ) : complaint.status === 'in_progress' ? (
              <>
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setShowProgress(true)}
                  leftIcon={<MessageSquare size={16} />}
                >
                  Update
                </Button>
                <Button 
                  className="flex-1 bg-[#16A34A] hover:bg-[#15803D]" 
                  onClick={() => setShowResolve(true)}
                  leftIcon={<Camera size={16} />}
                >
                  Resolve
                </Button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Progress Bottom Sheet ────────────────────────────────────────── */}
      <AnimatePresence>
        {showProgress && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowProgress(false)}
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-[var(--bottom-nav-h)] md:bottom-0 inset-x-0 bg-white rounded-t-3xl z-50 p-5 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-[#E5E7EB] rounded-full mx-auto mb-4" />
              <h2 className="text-xl font-bold text-[#111827] mb-1">Add Progress Update</h2>
              <p className="text-sm text-[#6B7280] mb-4">This update will be visible to the citizen.</p>
              
              <Textarea 
                placeholder="e.g., Arrived at location, waiting for equipment..."
                value={progressMsg}
                onChange={(e) => setProgressMsg(e.target.value)}
                rows={4}
              />
              
              <div className="mt-4 flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setShowProgress(false)}>Cancel</Button>
                <Button fullWidth onClick={handleProgress} isLoading={progressMutation.isPending} disabled={!progressMsg.trim()}>
                  Post Update
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Resolve with Photo Bottom Sheet ────────────────────────────── */}
      <AnimatePresence>
        {showResolve && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => !resolving && setShowResolve(false)}
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-[var(--bottom-nav-h)] md:bottom-0 inset-x-0 bg-white rounded-t-3xl z-50 shadow-2xl max-h-[85dvh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="sticky top-0 bg-white pt-3 pb-2 px-5 border-b border-[#F3F4F6]">
                <div className="w-12 h-1.5 bg-[#E5E7EB] rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[18px] font-extrabold text-[#111827]">Resolve Complaint</h2>
                    <p className="text-[12px] text-[#6B7280]">Upload a proof photo showing the issue is fixed</p>
                  </div>
                  <button
                    onClick={() => !resolving && setShowResolve(false)}
                    className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280]"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Photo picker */}
                <div>
                  <p className="text-[12px] font-bold text-[#111827] uppercase tracking-wider mb-2">
                    Resolution Photo <span className="text-red-500">*</span>
                  </p>

                  {resolvePreview ? (
                    <div className="relative rounded-2xl overflow-hidden border-2 border-[#16A34A]">
                      <img
                        src={resolvePreview}
                        alt="Resolution proof"
                        className="w-full h-52 object-cover"
                      />
                      <button
                        onClick={handleRemovePhoto}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white"
                      >
                        <X size={15} />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 p-3">
                        <p className="text-white text-[11px] font-semibold">✓ Photo selected</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full h-44 rounded-2xl border-2 border-dashed border-[#D1D5DB] bg-[#F9FAFB] flex flex-col items-center justify-center gap-2 transition-colors hover:border-[#111827] hover:bg-[#EEF2FF] active:bg-[#E0E7FF]"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] flex items-center justify-center">
                        <ImagePlus size={22} className="text-[#111827]" />
                      </div>
                      <div className="text-center">
                        <p className="text-[13px] font-bold text-[#111827]">Tap to upload photo</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">JPG, PNG or WEBP · max 10 MB</p>
                      </div>
                    </button>
                  )}

                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>

                {/* Optional note */}
                <div>
                  <p className="text-[12px] font-bold text-[#111827] uppercase tracking-wider mb-2">
                    Resolution Note <span className="text-[#9CA3AF] font-normal">(optional)</span>
                  </p>
                  <Textarea
                    value={resolveNote}
                    onChange={e => setResolveNote(e.target.value)}
                    rows={3}
                    placeholder="Describe what was done to fix the issue..."
                  />
                </div>

                {/* Tip banner */}
                <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <Camera size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-800 leading-relaxed">
                    Take a clear photo showing the issue is fully resolved. The citizen will review and confirm.
                  </p>
                </div>

                {/* Submit */}
                <Button
                  fullWidth
                  size="lg"
                  className="bg-[#16A34A] hover:bg-[#15803D] mt-2"
                  isLoading={resolving}
                  loadingText="Submitting..."
                  onClick={handleResolveSubmit}
                  leftIcon={<Upload size={17} />}
                >
                  Submit Resolution
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
