/**
 * pages/zonal/DashboardPage.tsx — Zonal Officer Dashboard
 */

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle, Clock, MapPin,
  TrendingUp, Users, ChevronRight, RefreshCw,
} from 'lucide-react'
import { zonalApi } from '@/api/zonal'
import { stagger, fadeUp } from '@/lib/motion'
import { ROUTES } from '@/router/routes'

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
  sub?: string
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl p-4 flex items-center gap-4"
      style={{ background: 'var(--surface-card)', border: '1px solid var(--border)' }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: color + '1a' }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-muted">{label}</p>
        {sub && <p className="text-xs text-text-muted opacity-60">{sub}</p>}
      </div>
    </motion.div>
  )
}

export default function ZonalDashboardPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['zonal', 'dashboard'],
    queryFn: zonalApi.getDashboard,
    staleTime: 30_000,
  })

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="show"
      className="px-4 pt-6 pb-24 max-w-lg mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest font-semibold mb-1">
            Zonal Officer
          </p>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          {data && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={12} className="text-primary" />
              <span className="text-sm text-primary font-medium">{data.zone_name}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-border text-text-muted hover:text-primary hover:border-primary transition-colors"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-surface-sunken animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard label="Total Complaints" value={data.total_complaints} icon={TrendingUp} color="#3B82F6" />
            <StatCard label="Submitted" value={data.submitted} icon={Clock} color="#F59E0B" />
            <StatCard label="In Progress" value={data.in_progress} icon={AlertTriangle} color="#8B5CF6" />
            <StatCard label="Resolved" value={data.resolved} icon={CheckCircle} color="#10B981" />
          </div>

          {/* Zone info */}
          <motion.div
            variants={fadeUp}
            className="rounded-2xl p-4 mb-6"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={15} className="text-primary" />
              <span className="text-sm font-semibold text-text-primary">Zone Coverage</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-muted">Total Wards</p>
                <p className="text-xl font-bold text-text-primary">{data.total_wards}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted">Resolution Rate</p>
                <p className="text-xl font-bold text-success">
                  {data.total_complaints > 0
                    ? Math.round((data.resolved / data.total_complaints) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </motion.div>

          {/* Quick links */}
          <motion.div variants={fadeUp} className="space-y-2">
            <Link
              to={ROUTES.ZONAL_COMPLAINTS}
              className="flex items-center justify-between p-4 rounded-2xl border border-border hover:border-primary transition-colors"
              style={{ background: 'var(--surface-card)' }}
            >
              <div className="flex items-center gap-3">
                <TrendingUp size={18} className="text-primary" />
                <span className="text-sm font-semibold text-text-primary">View All Complaints</span>
              </div>
              <ChevronRight size={16} className="text-text-muted" />
            </Link>
            <Link
              to={ROUTES.ZONAL_WARD_OFFICERS}
              className="flex items-center justify-between p-4 rounded-2xl border border-border hover:border-primary transition-colors"
              style={{ background: 'var(--surface-card)' }}
            >
              <div className="flex items-center gap-3">
                <Users size={18} className="text-primary" />
                <span className="text-sm font-semibold text-text-primary">Manage Ward Officers</span>
              </div>
              <ChevronRight size={16} className="text-text-muted" />
            </Link>
          </motion.div>
        </>
      ) : null}
    </motion.div>
  )
}
