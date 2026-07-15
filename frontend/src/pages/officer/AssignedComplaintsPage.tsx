/**
 * pages/officer/AssignedComplaintsPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * List of all complaints assigned to the officer with filtering.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, AlertCircle, ClipboardList } from 'lucide-react'

import { TopBar }             from '@/components/layout/TopBar'
import { StatusBadge }        from '@/components/ui/Badge'
import { SkeletonCard }       from '@/components/ui/Skeleton'
import { EmptyState }         from '@/components/ui/EmptyState'
import { useOfficerComplaints } from '@/hooks/useOfficer'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'
import type { Complaint } from '@/types/complaint'

export default function AssignedComplaintsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'resolved'>('all')
  const { data, isLoading, isError, refetch } = useOfficerComplaints({ limit: 100 })
  
  const allComplaints = data ?? []
  
  const filtered = allComplaints.filter((c: Complaint) => {
    if (filter === 'all') return true
    if (filter === 'pending') return c.status === 'submitted' || c.status === 'under_review'
    if (filter === 'active') return c.status === 'in_progress'
    if (filter === 'resolved') return c.status === 'resolved'
    return true
  })

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex flex-col min-h-dvh bg-[#F9FAFB]"
    >
      <TopBar title="My Tasks" showBack />

      {/* Filters */}
      <div className="px-4 py-3 bg-white border-b border-[#E5E7EB] flex gap-2 overflow-x-auto hide-scrollbar sticky top-14 z-10">
        {['all', 'pending', 'active', 'resolved'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors
              ${filter === f 
                ? 'bg-[#111827] text-white' 
                : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : isError ? (
          <EmptyState
            Icon={AlertCircle}
            title="Couldn't load tasks"
            action={<button onClick={() => refetch()} className="text-sm font-semibold text-[#111827]">Retry</button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            Icon={ClipboardList}
            title="No tasks found"
            description="You don't have any tasks matching this filter."
          />
        ) : (
          <motion.div variants={stagger.container} initial="hidden" animate="show" className="p-4 space-y-3">
            {filtered.map((c: Complaint) => (
              <motion.div
                key={c.id}
                variants={fadeUp}
                onClick={() => navigate(`/officer/complaints/${c.id}`)}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-4 cursor-pointer hover:shadow-md transition-shadow"
                style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2 items-center">
                    <span className="px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#6B7280] text-[10px] font-bold">
                      #{c.id.slice(0, 6)}
                    </span>
                    <span className="text-[11px] font-bold text-[#111827] uppercase">
                      {c.category?.name}
                    </span>
                  </div>
                  <StatusBadge status={c.status} size="sm" />
                </div>
                
                <h3 className="text-[15px] font-bold text-[#111827] leading-snug mb-1">
                  {c.title}
                </h3>
                
                <p className="text-[13px] text-[#6B7280] line-clamp-2 leading-relaxed mb-3">
                  {c.description}
                </p>
                
                <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                  <p className="text-[11px] text-[#9CA3AF] truncate max-w-[70%]">
                    📍 {c.location.address || `${c.location.latitude.toFixed(4)}, ${c.location.longitude.toFixed(4)}`}
                  </p>
                  <div className="w-6 h-6 rounded-full bg-[#F9FAFB] flex items-center justify-center">
                    <ChevronRight size={14} className="text-[#9CA3AF]" />
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
