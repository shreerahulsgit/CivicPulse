/**
 * pages/citizen/ProfilePage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Citizen profile — account info, complaint stats, settings, logout
 */

import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  User, Mail, Phone, Shield, LogOut, Bell,
  ChevronRight, FileText, CheckCircle2, Clock,
} from 'lucide-react'

import { TopBar }           from '@/components/layout/TopBar'
import { Avatar }           from '@/components/ui/Avatar'
import { AnimatedCounter }  from '@/components/ui/AnimatedCounter'
import { useAuthStore }     from '@/store/authStore'
import { useMyComplaints }  from '@/hooks/useComplaints'
import { useLogout }        from '@/hooks/useAuth'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'

// ── Stat mini card ────────────────────────────────────────────────────────────

function ProfileStat({ icon: Icon, label, value, color }: {
  icon: typeof FileText; label: string; value: number; color: string
}) {
  return (
    <div className="flex-1 bg-white rounded-2xl border border-[#E5E7EB] p-3 flex flex-col gap-1.5"
         style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
           style={{ background: `${color}20` }}>
        <Icon size={14} style={{ color }} strokeWidth={2} />
      </div>
      <AnimatedCounter value={value} duration={0.7}
        className="text-2xl font-extrabold text-[#111827] leading-none" />
      <p className="text-[11px] text-[#9CA3AF] font-medium leading-tight">{label}</p>
    </div>
  )
}

// ── Settings row ──────────────────────────────────────────────────────────────

function SettingsRow({ icon: Icon, label, sub, onClick, danger = false }: {
  icon: typeof User; label: string; sub?: string; onClick?: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#F9FAFB] transition-colors text-left"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                       ${danger ? 'bg-[#FEE2E2]' : 'bg-[#F3F4F6]'}`}>
        <Icon size={17} className={danger ? 'text-[#DC2626]' : 'text-[#374151]'} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[14px] font-semibold ${danger ? 'text-[#DC2626]' : 'text-[#111827]'}`}>
          {label}
        </p>
        {sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>}
      </div>
      {!danger && <ChevronRight size={16} className="text-[#D1D5DB]" />}
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const logout   = useLogout()

  const { data: complaintsData } = useMyComplaints({ limit: 50 })
  const complaints = complaintsData ?? []

  const totalComplaints  = complaints.length
  const resolvedCount    = complaints.filter((c: { status: string }) => c.status === 'resolved').length
  const inProgressCount  = complaints.filter(
    (c: { status: string }) => c.status === 'in_progress' || c.status === 'under_review'
  ).length

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : ''

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="min-h-dvh bg-[#F9FAFB] flex flex-col"
    >
      <TopBar title="Profile" showBack />

      <div className="flex-1 pb-24 overflow-y-auto">
        <motion.div
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className="space-y-4 pt-3"
        >
          {/* ── Avatar card ──────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="mx-4 bg-white rounded-3xl border border-[#E5E7EB] p-5"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <div className="flex items-center gap-4">
              <Avatar
                name={user?.full_name ?? '?'}
                size="xl"
                online
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-[18px] font-extrabold text-[#111827] tracking-tight truncate">
                  {user?.full_name}
                </h2>
                <p className="text-sm text-[#6B7280] truncate">{user?.email}</p>
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EEF2FF]">
                  <Shield size={10} className="text-[#111827]" />
                  <span className="text-[10px] font-bold text-[#111827] capitalize">{user?.role}</span>
                </div>
              </div>
            </div>

            {/* Member since */}
            {memberSince && (
              <p className="text-xs text-[#9CA3AF] mt-3 border-t border-[#F3F4F6] pt-3">
                Member since {memberSince}
              </p>
            )}
          </motion.div>

          {/* ── Stats row ────────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="flex gap-3 px-4">
            <ProfileStat icon={FileText}    label="Total"      value={totalComplaints} color="#111827" />
            <ProfileStat icon={Clock}       label="Active"     value={inProgressCount} color="#3B82F6" />
            <ProfileStat icon={CheckCircle2}label="Resolved"   value={resolvedCount}   color="#22C55E" />
          </motion.div>

          {/* ── Account section ───────────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="mx-4 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden divide-y divide-[#F3F4F6]"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <div className="px-4 py-3">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Account</p>
            </div>
            <SettingsRow icon={User}  label="Full Name"     sub={user?.full_name} />
            <SettingsRow icon={Mail}  label="Email Address" sub={user?.email} />
            {user?.phone && (
              <SettingsRow icon={Phone} label="Phone" sub={user.phone} />
            )}
          </motion.div>

          {/* ── Preferences ────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="mx-4 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden divide-y divide-[#F3F4F6]"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <div className="px-4 py-3">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Preferences</p>
            </div>
            <SettingsRow
              icon={Bell}
              label="Notifications"
              sub="Manage alerts & emails"
              onClick={() => navigate('/notifications')}
            />
          </motion.div>

          {/* ── Logout ───────────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="mx-4 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <SettingsRow
              icon={LogOut}
              label="Sign Out"
              danger
              onClick={logout}
            />
          </motion.div>

          {/* App version */}
          <motion.div variants={fadeUp}>
            <p className="text-center text-xs text-[#D1D5DB] pb-4">
              CivicPulse v1.0 · Built with ❤️ for better cities
            </p>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}
