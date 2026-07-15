/**
 * pages/admin/ComplaintsPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin — All Complaints with filters, search, reassign & escalate.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, Search, AlertTriangle, ArrowRightLeft,
  ShieldAlert, RefreshCcw, Filter, X, ChevronDown, User,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { TopBar }        from '@/components/layout/TopBar'
import { StatusBadge }   from '@/components/ui/Badge'
import { SkeletonCard }  from '@/components/ui/Skeleton'
import { EmptyState }    from '@/components/ui/EmptyState'
import { Button, Input } from '@/components/ui'
import { useToast }      from '@/components/ui/Toast'
import { adminApi }      from '@/api/admin'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'
import type { Complaint } from '@/types/complaint'

// ── Status options ────────────────────────────────────────────────────────────
const STATUSES = [
  { value: '', label: 'All Status' },
  { value: 'submitted',   label: 'Submitted' },
  { value: 'under_review',label: 'Under Review' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
  { value: 'rejected',    label: 'Rejected' },
]

// ── Reassign Sheet ────────────────────────────────────────────────────────────
function ReassignSheet({ complaint, onClose }: { complaint: Complaint; onClose: () => void }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [officerId, setOfficerId] = useState('')
  const [reason, setReason] = useState('')

  const { data: officers = [] } = useQuery({
    queryKey: ['admin', 'officers-list'],
    queryFn: adminApi.listOfficers,
  })

  const reassignMutation = useMutation({
    mutationFn: () => adminApi.reassign(complaint.id, officerId, reason),
    onSuccess: () => {
      toast.success('Reassigned!', 'Complaint moved to new officer.')
      qc.invalidateQueries({ queryKey: ['admin', 'complaints'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Reassign failed')
    },
  })

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 z-10"
        style={{ boxShadow: '0 -8px 40px rgba(15,23,42,0.12)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[17px] font-bold text-[#111827]">Reassign Complaint</h2>
            <p className="text-[12px] text-[#6B7280] truncate max-w-[230px]">{complaint.title}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5 block">
              Select Officer
            </label>
            <div className="relative">
              <select
                value={officerId}
                onChange={e => setOfficerId(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-3 pr-10 text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]/30 appearance-none"
              >
                <option value="">Choose officer...</option>
                {(officers as any[]).map((o: any) => (
                  <option key={o.id} value={o.id}>{o.full_name} — {o.email}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5 block">
              Reason (min 10 chars)
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why this is being reassigned..."
              rows={3}
              className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-[13px] text-[#111827] bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#111827]/30"
            />
          </div>
        </div>

        <Button
          fullWidth size="lg"
          className="mt-5 h-[52px] rounded-2xl font-bold text-base"
          disabled={!officerId || reason.length < 10}
          isLoading={reassignMutation.isPending}
          loadingText="Reassigning..."
          onClick={() => reassignMutation.mutate()}
          leftIcon={<ArrowRightLeft size={16} />}
        >
          Confirm Reassign
        </Button>
      </motion.div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminComplaintsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()

  const [search, setSearch]           = useState('')
  const [statusFilter, setStatus]     = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [reassignTarget, setReassign] = useState<Complaint | null>(null)

  // Debounced search param (use the raw value for simplicity)
  const params = {
    search:  search || undefined,
    status:  statusFilter || undefined,
    limit:   100,
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'complaints', params],
    queryFn:  () => adminApi.listAllComplaints(params),
  })

  const complaints: Complaint[] = data ?? []

  const escalateMutation = useMutation({
    mutationFn: (id: string) => adminApi.escalate(id, 'Admin manually escalated from dashboard'),
    onSuccess: () => {
      toast.success('Escalated', 'Complaint escalated to higher priority.')
      qc.invalidateQueries({ queryKey: ['admin', 'complaints'] })
    },
    onError: () => toast.error('Failed to escalate'),
  })

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden" animate="show" exit="exit"
      className="flex flex-col min-h-dvh bg-[#F9FAFB]"
    >
      <TopBar
        title="All Complaints"
        showBack
        rightElement={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(f => !f)}>
              <Filter size={15} className={showFilters ? 'text-[#111827]' : ''} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCcw size={15} />
            </Button>
          </div>
        }
      />

      {/* Search + Filter Bar */}
      <div className="bg-white border-b border-[#E5E7EB] sticky top-14 z-10">
        <div className="px-4 py-3">
          <Input
            placeholder="Search by title or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            leadingIcon={<Search size={16} />}
          />
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-[#F3F4F6]"
            >
              <div className="px-4 pb-3 pt-2">
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">Status</p>
                <div className="flex gap-2 flex-wrap">
                  {STATUSES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setStatus(s.value)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${
                        statusFilter === s.value
                          ? 'bg-[#111827] text-white'
                          : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Complaint count pill */}
      {!isLoading && !isError && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-[11px] text-[#9CA3AF] font-medium">
            {complaints.length} complaint{complaints.length !== 1 ? 's' : ''} found
          </p>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-24">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : isError ? (
          <EmptyState
            Icon={AlertTriangle}
            title="Couldn't load complaints"
            action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
          />
        ) : complaints.length === 0 ? (
          <EmptyState
            Icon={ClipboardList}
            title="No complaints found"
            description={search || statusFilter ? 'Try adjusting your filters.' : 'No complaints in the system yet.'}
          />
        ) : (
          <motion.div variants={stagger.container} initial="hidden" animate="show" className="p-4 space-y-3">
            {complaints.map((c: Complaint) => (
              <motion.div
                key={c.id}
                variants={fadeUp}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-4"
                style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}
              >
                {/* Header row */}
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#6B7280] text-[10px] font-bold font-mono">
                      #{c.id.slice(0, 6)}
                    </span>
                    <StatusBadge status={c.status} size="sm" />
                  </div>
                  {c.severity_score && c.severity_score > 7 && (
                    <span className="text-[10px] font-bold text-[#DC2626] bg-[#FEE2E2] px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                      <AlertTriangle size={10} /> High
                    </span>
                  )}
                </div>

                <h3 className="text-[14px] font-bold text-[#111827] leading-snug mb-1 line-clamp-2">
                  {c.title}
                </h3>

                <p className="text-[11px] text-[#6B7280] mb-1">
                  📍 {c.location?.address || `${c.location?.latitude?.toFixed(4)}, ${c.location?.longitude?.toFixed(4)}`}
                </p>

                {/* Officer + Dept info */}
                <div className="flex items-center gap-3 mb-3 text-[11px] text-[#9CA3AF]">
                  <span className="flex items-center gap-1">
                    <User size={11} />
                    {(c as any).assigned_officer_name ?? 'Unassigned'}
                  </span>
                  <span>•</span>
                  <span>{new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-[#F3F4F6]">
                  <Button
                    variant="outline" size="sm" className="flex-1"
                    onClick={() => setReassign(c)}
                    leftIcon={<ArrowRightLeft size={13} />}
                  >
                    Reassign
                  </Button>
                  <Button
                    variant="outline" size="sm" className="flex-1 border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2]"
                    onClick={() => escalateMutation.mutate(c.id)}
                    isLoading={escalateMutation.isPending && (escalateMutation.variables as string) === c.id}
                    leftIcon={<ShieldAlert size={13} />}
                  >
                    Escalate
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Reassign bottom sheet */}
      <AnimatePresence>
        {reassignTarget && (
          <ReassignSheet complaint={reassignTarget} onClose={() => setReassign(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
