/**
 * pages/zonal/ComplaintsPage.tsx — All complaints in the zone
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { RefreshCw, Search, AlertCircle } from 'lucide-react'
import { zonalApi } from '@/api/zonal'
import { stagger, fadeUp } from '@/lib/motion'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
]

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  submitted:    { bg: '#FEF3C7', text: '#92400E' },
  in_progress:  { bg: '#EDE9FE', text: '#5B21B6' },
  resolved:     { bg: '#D1FAE5', text: '#065F46' },
  rejected:     { bg: '#FEE2E2', text: '#991B1B' },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#F3F4F6', text: '#374151' }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text }}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

export default function ZonalComplaintsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['zonal', 'complaints', statusFilter],
    queryFn: () => zonalApi.getComplaints({
      limit: 100,
      status_filter: statusFilter || undefined,
    }),
    staleTime: 20_000,
  })

  const filtered = data?.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="show"
      className="px-4 pt-6 pb-24 max-w-lg mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest font-semibold mb-1">Zone Complaints</p>
          <h1 className="text-2xl font-bold text-text-primary">All Complaints</h1>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-border text-text-muted hover:text-primary transition-colors"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </motion.div>

      {/* Search */}
      <motion.div variants={fadeUp} className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search complaints..."
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-surface-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
        />
      </motion.div>

      {/* Status filter pills */}
      <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              statusFilter === opt.value
                ? 'bg-primary text-white'
                : 'bg-surface-sunken text-text-muted hover:text-text-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </motion.div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-surface-sunken animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 py-16 text-center">
          <AlertCircle size={40} className="text-text-muted opacity-30" />
          <p className="text-text-muted text-sm">No complaints found</p>
        </motion.div>
      ) : (
        <motion.div variants={stagger.container} className="space-y-3">
          {filtered.map(complaint => (
            <motion.div
              key={complaint.id}
              variants={fadeUp}
              className="rounded-2xl p-4"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
                  {complaint.title}
                </p>
                <StatusBadge status={complaint.status} />
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span>
                  {complaint.ward_number
                    ? `Ward ${complaint.ward_number}${complaint.ward_name ? ` · ${complaint.ward_name}` : ''}`
                    : '—'}
                </span>
                {complaint.severity_score != null && (
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: complaint.severity_score >= 7 ? '#EF4444' : complaint.severity_score >= 4 ? '#F59E0B' : '#10B981' }}
                    />
                    Priority {complaint.severity_score}
                  </span>
                )}
                <span>{new Date(complaint.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
