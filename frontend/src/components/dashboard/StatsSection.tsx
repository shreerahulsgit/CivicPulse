/**
 * src/components/dashboard/StatsSection.tsx
 * Horizontal-scroll stat pills — neutral black/grey palette.
 */

import { motion } from 'framer-motion'
import {
  ClipboardText,
  Spinner,
  CheckCircle,
  HourglassMedium,
  XCircle,
  ChartLineUp,
} from '@phosphor-icons/react'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { SkeletonStat }    from '@/components/ui/Skeleton'
import { stagger, fadeUp } from '@/lib/motion'
import type { Complaint }  from '@/types/complaint'

interface StatsSectionProps {
  complaints: Complaint[]
  isLoading:  boolean
}

// Stat card definitions — neutral tones + semantic colors only for status counts
const STATS = (complaints: Complaint[]) => [
  {
    label:  'Total Filed',
    value:  complaints.length,
    Icon:   ClipboardText,
    iconBg: '#F3F4F6',
    color:  '#374151',
    border: '#E5E7EB',
  },
  {
    label:  'In Progress',
    value:  complaints.filter(c => c.status === 'in_progress' || c.status === 'under_review').length,
    Icon:   Spinner,
    iconBg: '#DBEAFE',
    color:  '#1E40AF',
    border: '#BFDBFE',
  },
  {
    label:  'Resolved',
    value:  complaints.filter(c => c.status === 'resolved').length,
    Icon:   CheckCircle,
    iconBg: '#DCFCE7',
    color:  '#166534',
    border: '#BBF7D0',
  },
  {
    label:  'Pending',
    value:  complaints.filter(c => c.status === 'pending_verification').length,
    Icon:   HourglassMedium,
    iconBg: '#FEF3C7',
    color:  '#92400E',
    border: '#FDE68A',
  },
  {
    label:  'Rejected',
    value:  complaints.filter(c => c.status === 'rejected').length,
    Icon:   XCircle,
    iconBg: '#FEE2E2',
    color:  '#991B1B',
    border: '#FECACA',
  },
]

export function StatsSection({ complaints, isLoading }: StatsSectionProps) {
  if (isLoading) {
    return (
      <div className="grid grid-flow-col auto-cols-[120px] gap-3 px-4 overflow-x-auto pb-1 md:flex md:px-4 md:overflow-visible" style={{ scrollbarWidth: 'none' }}>
        {[0, 1, 2, 3].map(i => <SkeletonStat key={i} />)}
      </div>
    )
  }

  const stats = STATS(complaints)
  const resolvedRate = complaints.length > 0
    ? Math.round((complaints.filter(c => c.status === 'resolved').length / complaints.length) * 100)
    : 0

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="show"
      className="grid grid-flow-col auto-cols-[120px] gap-3 px-4 overflow-x-auto pb-1 md:flex md:px-4 md:overflow-visible"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {stats.map(({ label, value, Icon, iconBg, color, border }) => (
        <motion.div
          key={label}
          variants={fadeUp}
          className="flex-shrink-0 rounded-2xl border bg-white p-3.5 flex flex-col gap-2.5 md:flex-1 md:min-w-0 md:w-0"
          style={{
            borderColor: border,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
            <Icon size={18} color={color} weight="duotone" />
          </div>
          <AnimatedCounter
            value={value}
            duration={0.9}
            className="text-[26px] font-extrabold leading-none tracking-tight text-[#111827]"
          />
          <p className="text-[11px] font-semibold leading-tight text-[#6B7280]">{label}</p>
        </motion.div>
      ))}

      {/* Resolution rate */}
      {complaints.length > 0 && (
        <motion.div
          variants={fadeUp}
          className="flex-shrink-0 rounded-2xl border p-3.5 flex flex-col gap-2.5 md:flex-1 md:min-w-0 md:w-0"
          style={{
            background: '#111827',
            borderColor: '#1F2937',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <ChartLineUp size={18} color="white" weight="duotone" />
          </div>
          <div className="text-[26px] font-extrabold leading-none tracking-tight text-white">
            {resolvedRate}<span className="text-sm text-white/50">%</span>
          </div>
          <p className="text-[11px] font-semibold leading-tight text-white/50">Resolved Rate</p>
        </motion.div>
      )}
    </motion.div>
  )
}
