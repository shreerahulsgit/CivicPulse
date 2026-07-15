/**
 * pages/admin/EscalatedPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin view: all auto-escalated complaints sorted by urgency.
 * Level-2 (admin) complaints shown first in red, Level-1 in orange.
 */

import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import { motion }              from 'framer-motion'
import {
  AlertTriangle, Clock, MapPin, User,
  ChevronRight, RefreshCcw, Zap, Shield,
} from 'lucide-react'
import { adminApi }   from '@/api/admin'
import type { EscalatedComplaint } from '@/api/admin'
import { TopBar }     from '@/components/layout/TopBar'
import { Button }     from '@/components/ui/Button'
import { Skeleton }   from '@/components/ui/Skeleton'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1)  return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function severityColor(score: number | null): string {
  const s = score ?? 5
  if (s >= 8) return '#EF4444'
  if (s >= 5) return '#F59E0B'
  return '#111827'
}

// ── Escalation Badge ─────────────────────────────────────────────────────────

function EscalationBadge({ level }: { level: number }) {
  if (level >= 2) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-500 border border-red-500/30">
      <Shield size={9} />
      Admin Escalated
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30">
      <AlertTriangle size={9} />
      Escalated
    </span>
  )
}

// ── Complaint Card ────────────────────────────────────────────────────────────

function EscalatedCard({ complaint, onClick }: { complaint: EscalatedComplaint; onClick: () => void }) {
  const isLevel2   = complaint.escalation_level >= 2
  const borderColor = isLevel2 ? 'border-red-500/40' : 'border-amber-500/40'
  const glowColor   = isLevel2 ? 'shadow-red-500/10' : 'shadow-amber-500/10'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`
        relative bg-[#1A1F2E] rounded-2xl p-4 border cursor-pointer
        shadow-lg ${glowColor} ${borderColor}
        active:scale-[0.99] transition-all
      `}
    >
      {/* Left severity stripe */}
      <div
        className="absolute left-0 top-4 bottom-4 w-1 rounded-full"
        style={{ backgroundColor: severityColor(complaint.severity_score) }}
      />

      <div className="ml-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <EscalationBadge level={complaint.escalation_level} />
            <span className="text-[10px] text-[#6B7280] font-medium capitalize px-2 py-0.5 bg-[#111827] rounded-full border border-[#1F2937]">
              {complaint.status.replace('_', ' ')}
            </span>
          </div>
          <ChevronRight size={16} className="text-[#374151] shrink-0 mt-0.5" />
        </div>

        {/* Title */}
        <h3 className="text-[14px] font-semibold text-white leading-snug mb-2 line-clamp-2">
          {complaint.title}
        </h3>

        {/* Meta row */}
        <div className="flex flex-wrap gap-3 text-[11px] text-[#6B7280]">
          {(complaint.ward_number || complaint.zone_name) && (
            <span className="flex items-center gap-1">
              <MapPin size={10} />
              {complaint.ward_number ? `Ward ${complaint.ward_number}` : ''}
              {complaint.ward_name ? ` · ${complaint.ward_name}` : ''}
              {complaint.zone_name ? ` · ${complaint.zone_name}` : ''}
            </span>
          )}
          {complaint.assigned_officer && (
            <span className="flex items-center gap-1">
              <User size={10} />
              {complaint.assigned_officer}
            </span>
          )}
          <span className="flex items-center gap-1 text-amber-400">
            <Clock size={10} />
            Escalated {timeAgo(complaint.escalated_at)}
          </span>
          <span className="flex items-center gap-1">
            <Zap size={10} style={{ color: severityColor(complaint.severity_score) }} />
            Severity {complaint.severity_score ?? '?'}/10
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EscalatedPage() {
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState<EscalatedComplaint[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.getEscalated()
      setComplaints(data)
    } catch {
      setError('Failed to load escalated complaints')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const level2 = complaints.filter(c => c.escalation_level >= 2)
  const level1 = complaints.filter(c => c.escalation_level === 1)

  return (
    <div className="min-h-screen bg-[#0B0F1A] pb-24">
      <TopBar title="Escalated Complaints" showBack />

      {/* Stats bar */}
      <div className="px-4 pt-4 pb-2 flex gap-3">
        <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{level2.length}</p>
          <p className="text-[10px] text-red-400/70 font-semibold uppercase tracking-wide mt-0.5">Admin Level</p>
        </div>
        <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{level1.length}</p>
          <p className="text-[10px] text-amber-400/70 font-semibold uppercase tracking-wide mt-0.5">Zonal Level</p>
        </div>
        <div className="flex-1 bg-[#1A1F2E] border border-[#1F2937] rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{complaints.length}</p>
          <p className="text-[10px] text-[#6B7280] font-semibold uppercase tracking-wide mt-0.5">Total</p>
        </div>
      </div>

      {/* Refresh */}
      <div className="px-4 pb-2 flex justify-end">
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-[11px] text-[#111827] font-medium py-1.5 px-3 rounded-xl bg-[#111827]/10 border border-[#111827]/20 active:scale-95 transition-transform"
        >
          <RefreshCcw size={11} />
          Refresh
        </button>
      </div>

      <div className="px-4 space-y-4">
        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <AlertTriangle size={40} className="mx-auto text-red-400 mb-3" />
            <p className="text-[#6B7280] text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={load} className="mt-4">Retry</Button>
          </div>
        )}

        {!loading && !error && complaints.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-[#1A1F2E] flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-[#111827]" />
            </div>
            <h3 className="text-white font-semibold mb-1">All Caught Up!</h3>
            <p className="text-[#6B7280] text-sm">No escalated complaints right now.</p>
          </div>
        )}

        {!loading && !error && level2.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest mb-3">
              🔴 Admin Level — Needs Immediate Action
            </p>
            <div className="space-y-3">
              {level2.map(c => (
                <EscalatedCard key={c.id} complaint={c} onClick={() => navigate(`/admin/complaints/${c.id}`)} />
              ))}
            </div>
          </div>
        )}

        {!loading && !error && level1.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-3">
              🟠 Zonal Level — Review Required
            </p>
            <div className="space-y-3">
              {level1.map(c => (
                <EscalatedCard key={c.id} complaint={c} onClick={() => navigate(`/admin/complaints/${c.id}`)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
