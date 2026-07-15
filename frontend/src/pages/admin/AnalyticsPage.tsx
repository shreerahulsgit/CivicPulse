/**
 * pages/admin/AnalyticsPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin Analytics — Trends charts wired to real backend data.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, AlertTriangle, RefreshCcw, CheckCircle2, AlertCircle } from 'lucide-react'

import { TopBar }             from '@/components/layout/TopBar'
import { Skeleton }           from '@/components/ui/Skeleton'
import { EmptyState }         from '@/components/ui/EmptyState'
import { Button }             from '@/components/ui/Button'
import { useAdminTrends, useAdminDepartmentAnalytics } from '@/hooks/useAdmin'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'

type Granularity = 'daily' | 'weekly' | 'monthly'

export default function AdminAnalyticsPage() {
  const [granularity, setGranularity] = useState<Granularity>('daily')

  const { data: trends, isLoading, isError, refetch } = useAdminTrends(granularity)
  const { data: deptData } = useAdminDepartmentAnalytics()

  const points = trends?.data_points ?? []

  const formatLabel = (period: string, gran: Granularity) => {
    if (gran === 'monthly') {
      return new Date(`${period}-01`).toLocaleString('en-US', { month: 'short' })
    }
    if (gran === 'weekly') return `W${period.split('-W')[1]}`
    return period.split('-')[2] // day number
  }

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex flex-col min-h-dvh bg-[#F9FAFB]"
    >
      <TopBar
        title="Analytics"
        showBack
        rightElement={
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCcw size={15} />
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto pb-24">
        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton height={200} rounded />
            <Skeleton height={200} rounded />
          </div>
        ) : isError ? (
          <EmptyState
            Icon={AlertTriangle}
            title="Couldn't load analytics"
            action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
          />
        ) : (
          <motion.div variants={stagger.container} initial="hidden" animate="show" className="p-4 space-y-4">

            {/* Granularity selector */}
            <motion.div variants={fadeUp} className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as Granularity[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-bold capitalize transition-colors ${
                    granularity === g
                      ? 'bg-[#111827] text-white'
                      : 'bg-white border border-[#E5E7EB] text-[#6B7280]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </motion.div>

            {/* Complaints trend bar chart */}
            <motion.div variants={fadeUp} className="bg-white rounded-3xl border border-[#E5E7EB] p-5" style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[15px] font-bold text-[#111827]">Complaint Volume</h3>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5 capitalize">{granularity} breakdown</p>
                </div>
                <TrendingUp size={16} className="text-[#539638]" />
              </div>

              {points.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] text-center py-8">No data for this period</p>
              ) : (
                <>
                  <div className="h-40 flex items-end gap-1.5">
                    {points.slice(-14).map((point, i) => {
                      const max = Math.max(...points.map(p => p.total_complaints), 1)
                      const heightPct = (point.total_complaints / max) * 100
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                          <div className="w-full relative" style={{ height: '120px' }}>
                            <motion.div
                              className="absolute bottom-0 w-full rounded-t-md bg-[#111827]"
                              initial={{ height: 0 }}
                              animate={{ height: `${heightPct}%` }}
                              transition={{ duration: 0.6, delay: i * 0.04 }}
                            />
                            <motion.div
                              className="absolute bottom-0 w-full rounded-t-md bg-[#22C55E]"
                              initial={{ height: 0 }}
                              animate={{ height: `${(point.resolved_complaints / Math.max(point.total_complaints, 1)) * heightPct}%` }}
                              transition={{ duration: 0.6, delay: i * 0.04 + 0.2 }}
                            />
                          </div>
                          <span className="text-[9px] font-medium text-[#9CA3AF] truncate w-full text-center">
                            {formatLabel(point.period, granularity)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[#111827]" />
                      <span className="text-[11px] text-[#6B7280]">Total</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[#22C55E]" />
                      <span className="text-[11px] text-[#6B7280]">Resolved</span>
                    </div>
                  </div>
                </>
              )}
            </motion.div>

            {/* Summary stats row */}
            {points.length > 0 && (
              <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total', value: points.reduce((s, p) => s + p.total_complaints, 0), color: '#111827', Icon: BarChart3 },
                  { label: 'Resolved', value: points.reduce((s, p) => s + p.resolved_complaints, 0), color: '#22C55E', Icon: CheckCircle2 },
                  { label: 'Open', value: points.reduce((s, p) => s + p.open_complaints, 0), color: '#F59E0B', Icon: AlertCircle },
                ].map(({ label, value, color, Icon }) => (
                  <div key={label} className="bg-white rounded-2xl border border-[#E5E7EB] p-3 text-center" style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
                    <Icon size={14} style={{ color, margin: '0 auto 4px' }} />
                    <p className="text-[20px] font-extrabold text-[#111827]">{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-medium">{label}</p>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Department breakdown */}
            {deptData && deptData.length > 0 && (
              <motion.div variants={fadeUp} className="bg-white rounded-3xl border border-[#E5E7EB] p-5" style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-bold text-[#111827]">By Department</h3>
                  <BarChart3 size={16} className="text-[#3B82F6]" />
                </div>
                <div className="space-y-3">
                  {deptData.slice(0, 6).map((dept: any) => {
                    const pct = dept.total > 0 ? Math.round((dept.resolved / dept.total) * 100) : 0
                    return (
                      <div key={dept.department_id}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[12px] font-medium text-[#111827] truncate">{dept.department_name}</span>
                          <span className="text-[11px] text-[#6B7280] shrink-0 ml-2">{dept.total} total</span>
                        </div>
                        <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-[#22C55E] rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5">{pct}% resolved</p>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
