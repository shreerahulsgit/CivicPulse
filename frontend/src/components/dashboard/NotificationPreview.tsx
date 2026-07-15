/**
 * src/components/dashboard/NotificationPreview.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Last 3 notifications with unread dot indicator and "View all" link
 */

import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, CheckCircle2, AlertCircle, Info, ChevronRight } from 'lucide-react'
import { stagger, fadeUp } from '@/lib/motion'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/router/routes'
import type { Notification } from '@/types/notification'

// ── Icon per notification type ────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { Icon: typeof Bell; bg: string; color: string }> = {
  complaint_created:  { Icon: CheckCircle2, bg: '#DCFCE7', color: '#16A34A' },
  complaint_assigned: { Icon: Info,         bg: '#DBEAFE', color: '#2563EB' },
  status_changed:     { Icon: Info,         bg: '#EEF2FF', color: '#111827' },
  complaint_resolved: { Icon: CheckCircle2, bg: '#DCFCE7', color: '#16A34A' },
  duplicate_detected: { Icon: AlertCircle,  bg: '#FEF3C7', color: '#D97706' },
  progress_update:    { Icon: Info,         bg: '#DBEAFE', color: '#2563EB' },
}

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? { Icon: Bell, bg: '#F3F4F6', color: '#6B7280' }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins   = Math.floor(diffMs / 60_000)
  const hours  = Math.floor(mins  / 60)
  const days   = Math.floor(hours / 24)
  if (mins  < 1)   return 'Just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotifRow({ notif }: { notif: Notification }) {
  const { Icon, bg, color } = getConfig(notif.type)

  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center gap-3 px-4 py-3.5"
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: bg }}
      >
        <Icon size={16} style={{ color }} strokeWidth={2} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[13px] leading-snug truncate',
          notif.is_read ? 'text-[#374151] font-medium' : 'text-[#111827] font-semibold',
        )}>
          {notif.title}
        </p>
        <p className="text-[11px] text-[#9CA3AF] mt-0.5">
          {timeAgo(notif.created_at)}
        </p>
      </div>

      {/* Unread dot */}
      {!notif.is_read && (
        <div className="w-2 h-2 rounded-full bg-[#111827] shrink-0" />
      )}
    </motion.div>
  )
}

// ── Loading skeleton rows ──────────────────────────────────────────────────────

function NotifSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Skeleton width={36} height={36} rounded />
      <div className="flex-1 space-y-1.5">
        <Skeleton height={13} className="w-4/5" />
        <Skeleton height={11} className="w-1/3" />
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

interface NotificationPreviewProps {
  notifications: Notification[]
  unreadCount:   number
  isLoading:     boolean
}

export function NotificationPreview({
  notifications, unreadCount, isLoading,
}: NotificationPreviewProps) {
  const navigate = useNavigate()
  const recent   = notifications.slice(0, 3)

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-[#111827] tracking-tight">
            Notifications
          </h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2FF] text-[#111827]">
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate(ROUTES.NOTIFICATIONS)}
          className="text-sm font-semibold text-[#111827] hover:underline underline-offset-2"
        >
          See all
        </button>
      </div>

      {/* Card */}
      <div
        className="mx-4 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
      >
        {isLoading ? (
          <>
            <NotifSkeleton />
            <div className="h-px bg-[#F3F4F6] mx-4" />
            <NotifSkeleton />
            <div className="h-px bg-[#F3F4F6] mx-4" />
            <NotifSkeleton />
          </>
        ) : recent.length === 0 ? (
          <EmptyState
            Icon={Bell}
            title="No notifications yet"
            description="You'll see updates here when your complaints progress."
            size="sm"
          />
        ) : (
          <motion.div
            variants={stagger.container}
            initial="hidden"
            animate="show"
          >
            {recent.map((n, i) => (
              <div key={n.id}>
                <NotifRow notif={n} />
                {i < recent.length - 1 && (
                  <div className="h-px bg-[#F3F4F6] mx-4" />
                )}
              </div>
            ))}

            {/* View all footer */}
            <button
              onClick={() => navigate(ROUTES.NOTIFICATIONS)}
              className="w-full flex items-center justify-center gap-1.5 py-3.5
                         text-sm font-semibold text-[#111827] border-t border-[#F3F4F6]
                         hover:bg-[#F9FAFB] transition-colors"
            >
              View all notifications
              <ChevronRight size={14} />
            </button>
          </motion.div>
        )}
      </div>
    </section>
  )
}
