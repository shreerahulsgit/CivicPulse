/**
 * pages/officer/DashboardPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Officer Dashboard
 * Stats (Pending/Active/Resolved) + Pending Acceptances + Active Work.
 */

import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Clock, CheckCircle2, ChevronRight, AlertCircle, RefreshCcw
} from 'lucide-react'

import { BrandTopBar }        from '@/components/layout/TopBar'
import { AnimatedCounter }    from '@/components/ui/AnimatedCounter'
import { StatusBadge }        from '@/components/ui/Badge'
import { EmptyState }         from '@/components/ui/EmptyState'
import { Button }             from '@/components/ui/Button'
import { useUnreadCount }     from '@/hooks/useNotifications'
import { useOfficerComplaints, useOfficerPending, useOfficerInProgress } from '@/hooks/useOfficer'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'
import { ROUTES }             from '@/router/routes'
import type { Complaint }     from '@/types/complaint'

// ── Shared Complaint Row ──────────────────────────────────────────────────────

function OfficerComplaintRow({ complaint }: { complaint: Complaint }) {
  const navigate = useNavigate()
  
  return (
    <motion.div
      variants={fadeUp}
      onClick={() => navigate(`/officer/complaints/${complaint.id}`)}
      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors"
      whileTap={{ scale: 0.99 }}
    >
      <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex flex-col items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-[#6B7280] uppercase">ID</span>
        <span className="text-[11px] font-extrabold text-[#111827]">
          {complaint.id.slice(0, 4)}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#111827] truncate leading-snug">
          {complaint.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge status={complaint.status} size="sm" />
          <span className="text-[11px] text-[#9CA3AF] truncate">
            {complaint.location.address}
          </span>
        </div>
      </div>

      <ChevronRight size={16} className="text-[#D1D5DB] shrink-0" />
    </motion.div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OfficerDashboardPage() {
  const navigate = useNavigate()
  
  // Data hooks
  const { data: unreadData } = useUnreadCount()
  const { data: allData } = useOfficerComplaints({ limit: 100 })
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useOfficerPending({ limit: 5 })
  const { data: activeData, isLoading: activeLoading, refetch: refetchActive } = useOfficerInProgress({ limit: 5 })
  
  const unreadCount = unreadData?.unread_count ?? 0
  const allComplaints = allData ?? []
  const pending = pendingData ?? []
  const active = activeData ?? []
  
  const handleRefresh = () => {
    refetchPending()
    refetchActive()
  }

  // Calculate stats
  const resolvedCount = allComplaints.filter((c: Complaint) => c.status === 'resolved').length
  const activeCount   = active.length
  const pendingCount  = pending.length

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex flex-col min-h-dvh bg-[#F9FAFB]"
    >
      <BrandTopBar
        unreadCount={unreadCount}
        onBellClick={() => navigate(ROUTES.NOTIFICATIONS)}
      />

      <div className="flex-1 overflow-y-auto pb-24">
        <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-5 pt-3">
          
          {/* 1 ── Header ────────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="px-4 flex items-center justify-between">
            <div>
              <p className="text-[12px] text-[#9CA3AF] font-medium uppercase tracking-wider mb-0.5">
                Officer Duty
              </p>
              <h1 className="font-extrabold text-[#111827] text-[24px] leading-tight tracking-tight">
                Hi, Officer
              </h1>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9 w-9 p-0 rounded-xl">
              <RefreshCcw size={15} />
            </Button>
          </motion.div>

          {/* 2 ── Stats ─────────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="px-4 grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3 flex flex-col gap-2" style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
              <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] flex items-center justify-center">
                <AlertCircle size={15} className="text-[#D97706]" strokeWidth={2} />
              </div>
              <AnimatedCounter value={pendingCount} className="text-[26px] font-extrabold text-[#111827] leading-none" />
              <p className="text-[11px] font-medium text-[#9CA3AF]">Pending Action</p>
            </div>
            
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3 flex flex-col gap-2" style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
              <div className="w-8 h-8 rounded-xl bg-[#DBEAFE] flex items-center justify-center">
                <Clock size={15} className="text-[#2563EB]" strokeWidth={2} />
              </div>
              <AnimatedCounter value={activeCount} className="text-[26px] font-extrabold text-[#111827] leading-none" />
              <p className="text-[11px] font-medium text-[#9CA3AF]">In Progress</p>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3 flex flex-col gap-2" style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
              <div className="w-8 h-8 rounded-xl bg-[#DCFCE7] flex items-center justify-center">
                <CheckCircle2 size={15} className="text-[#16A34A]" strokeWidth={2} />
              </div>
              <AnimatedCounter value={resolvedCount} className="text-[26px] font-extrabold text-[#111827] leading-none" />
              <p className="text-[11px] font-medium text-[#9CA3AF]">Resolved</p>
            </div>
          </motion.div>

          {/* 3 ── Action Required (Pending) ─────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <div className="flex items-center justify-between px-4 mb-3">
              <h2 className="text-[15px] font-bold text-[#111827] tracking-tight">Action Required</h2>
            </div>
            <div className="mx-4 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden divide-y divide-[#F3F4F6]">
              {pendingLoading ? (
                <div className="p-3 text-center text-sm text-[#6B7280]">Loading...</div>
              ) : pending.length === 0 ? (
                <EmptyState title="No pending tasks" description="You have acknowledged all assigned complaints." size="sm" />
              ) : (
                pending.map((c: Complaint) => <OfficerComplaintRow key={c.id} complaint={c} />)
              )}
            </div>
          </motion.div>

          {/* 4 ── Active Work (In Progress) ─────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <div className="flex items-center justify-between px-4 mb-3">
              <h2 className="text-[15px] font-bold text-[#111827] tracking-tight">Active Work</h2>
              <button onClick={() => navigate(ROUTES.OFFICER_COMPLAINTS)} className="text-sm font-semibold text-[#111827] hover:underline">
                View all
              </button>
            </div>
            <div className="mx-4 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden divide-y divide-[#F3F4F6]">
              {activeLoading ? (
                <div className="p-3 text-center text-sm text-[#6B7280]">Loading...</div>
              ) : active.length === 0 ? (
                <EmptyState title="No active work" description="Accept a pending complaint to start working." size="sm" />
              ) : (
                active.map((c: Complaint) => <OfficerComplaintRow key={c.id} complaint={c} />)
              )}
            </div>
          </motion.div>

        </motion.div>
      </div>
    </motion.div>
  )
}
