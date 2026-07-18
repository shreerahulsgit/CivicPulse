import React from 'react'
/**
 * pages/admin/DashboardPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin Control Center — real data from /analytics/dashboard
 */

import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart3, Users, Building2, ClipboardList,
  CheckCircle2, AlertCircle, TrendingUp,
  Clock, Map, Calendar, Activity, Sparkles,
} from 'lucide-react'

import { BrandTopBar }       from '@/components/layout/TopBar'
import { AnimatedCounter }   from '@/components/ui/AnimatedCounter'
import { Skeleton }          from '@/components/ui/Skeleton'
import { useAdminDashboard } from '@/hooks/useAdmin'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'
import { ROUTES }            from '@/router/routes'

// ── Quick Link Card ──────────────────────────────────────────────────────────

function QuickLink({ icon: Icon, title, desc, onClick, color }: {
  icon: React.FC<{ size?: number; className?: string }>
  title: string; desc: string; onClick: () => void; color: string
}) {
  return (
    <motion.div
      variants={fadeUp}
      onClick={onClick}
      className="bg-white rounded-2xl border border-[#E5E7EB] p-4 cursor-pointer flex items-center gap-4 transition-shadow hover:shadow-md active:scale-[0.98]"
      style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <span style={{ color }}><Icon size={20} /></span>
      </div>
      <div>
        <h3 className="text-[15px] font-bold text-[#111827] leading-tight">{title}</h3>
        <p className="text-[12px] text-[#6B7280] mt-0.5">{desc}</p>
      </div>
    </motion.div>
  )
}

// ── Mini Stat Card ────────────────────────────────────────────────────────────

function MiniStat({ label, value, icon: Icon, color }: {
  label: string; value: number | string
  icon: React.FC<{ size?: number }>;  color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex flex-col gap-2"
      style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
        <span style={{ color }}><Icon size={16} /></span>
      </div>
      <div>
        <p className="text-[22px] font-extrabold text-[#111827] leading-none">
          {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
        </p>
        <p className="text-[11px] text-[#9CA3AF] mt-0.5 font-medium">{label}</p>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const { data: metrics, isLoading } = useAdminDashboard()

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex flex-col min-h-dvh bg-[#F9FAFB]"
    >
      <BrandTopBar />

      <div className="flex-1 overflow-y-auto pb-28">
        <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-5 pt-3">

          {/* Header */}
          <motion.div variants={fadeUp} className="px-4">
            <p className="text-[12px] text-[#9CA3AF] font-medium uppercase tracking-wider mb-0.5">
              Control Center
            </p>
            <h1 className="font-extrabold text-[#111827] text-[24px] leading-tight tracking-tight">
              Overview
            </h1>
          </motion.div>

          {/* Hero metrics card */}
          <motion.div variants={fadeUp} className="px-4">
            <div className="bg-[#111827] rounded-3xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-[#1F2937] to-transparent pointer-events-none" />
              <TrendingUp size={120} className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none" />

              {isLoading ? (
                <div className="space-y-4">
                  <div className="h-8 bg-white/10 rounded w-1/3 animate-pulse" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-12 bg-white/10 rounded animate-pulse" />
                    <div className="h-12 bg-white/10 rounded animate-pulse" />
                  </div>
                </div>
              ) : metrics ? (
                <div className="relative z-10">
                  <p className="text-white/60 text-[11px] font-bold uppercase tracking-wider mb-1">
                    Total System Complaints
                  </p>
                  <AnimatedCounter
                    value={metrics.total_complaints}
                    className="text-[36px] font-extrabold text-white leading-none tracking-tight"
                  />

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1 text-amber-400">
                        <AlertCircle size={12} />
                        <span className="text-[11px] font-medium">Open</span>
                      </div>
                      <AnimatedCounter value={metrics.open_complaints} className="text-[20px] font-bold text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1 text-[#22C55E]">
                        <CheckCircle2 size={12} />
                        <span className="text-[11px] font-medium">Resolved</span>
                      </div>
                      <AnimatedCounter value={metrics.resolved_complaints} className="text-[20px] font-bold text-white" />
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] text-white/50 mb-0.5">Today</p>
                      <p className="text-[16px] font-bold text-white">{metrics.complaints_today}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/50 mb-0.5">This Week</p>
                      <p className="text-[16px] font-bold text-white">{metrics.complaints_this_week}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/50 mb-0.5">This Month</p>
                      <p className="text-[16px] font-bold text-white">{metrics.complaints_this_month}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-white/70 text-[12px]">
                    <span>Avg Resolution Time</span>
                    <span className="font-bold text-white">
                      {metrics.avg_resolution_hours ? `${metrics.avg_resolution_hours.toFixed(1)}h` : 'N/A'}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>

          {/* Mini stat cards */}
          <motion.div variants={fadeUp} className="px-4">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
              </div>
            ) : metrics ? (
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Active Officers"   value={metrics.active_officers}   icon={Activity}    color="#111827" />
                <MiniStat label="Avg Resolve (hrs)" value={metrics.avg_resolution_hours?.toFixed(1) ?? 'N/A'} icon={Clock} color="#F59E0B" />
                <MiniStat label="Total Wards"       value={metrics.total_wards}        icon={Map}         color="#3B82F6" />
                <MiniStat label="Departments"       value={metrics.total_departments}  icon={Building2}   color="#10B981" />
              </div>
            ) : null}
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={fadeUp} className="px-4">
            <h2 className="text-[15px] font-bold text-[#111827] mb-3 ml-1">Modules</h2>
            <div className="space-y-3">
              <QuickLink
                icon={BarChart3}
                title="System Analytics"
                desc="Deep dive into trends & performance"
                color="#111827"
                onClick={() => navigate(ROUTES.ADMIN_ANALYTICS)}
              />
              <QuickLink
                icon={ClipboardList}
                title="All Complaints"
                desc="Manage & reassign civic issues"
                color="#3B82F6"
                onClick={() => navigate(ROUTES.ADMIN_COMPLAINTS)}
              />
              <QuickLink
                icon={Building2}
                title="Departments"
                desc="Department-wise resolution metrics"
                color="#F59E0B"
                onClick={() => navigate(ROUTES.ADMIN_DEPARTMENTS)}
              />
              <QuickLink
                icon={Users}
                title="Users"
                desc="View and manage user accounts"
                color="#10B981"
                onClick={() => navigate(ROUTES.ADMIN_USERS)}
              />
              <QuickLink
                icon={Calendar}
                title="Trends"
                desc="Daily / weekly / monthly charts"
                color="#EC4899"
                onClick={() => navigate(ROUTES.ADMIN_ANALYTICS)}
              />
            </div>
          </motion.div>

          {/* ── Gemini AI Banner ────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="px-4">
            <div
              className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: 'linear-gradient(135deg, #0c2d4a 0%, #312E81 100%)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-[14px] leading-tight">Gemini AI Active</p>
                <p className="text-gray-400 text-[11px] mt-0.5">
                  Auto-classifies complaints · Detects duplicates · Prioritises issues
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 text-[10px] font-bold uppercase">Live</span>
              </div>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </motion.div>
  )
}
