/**
 * pages/citizen/NotificationsPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full notification feed — paginated, mark-read, mark-all-read
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell, CheckCircle2, AlertCircle, Info,
  Check, CheckCheck,
} from 'lucide-react'

import { TopBar }                             from '@/components/layout/TopBar'
import { Button }                             from '@/components/ui/Button'
import { Skeleton }                           from '@/components/ui/Skeleton'
import { EmptyState }                         from '@/components/ui/EmptyState'
import { useNotifications, useMarkRead, useMarkAllRead, useUnreadCount } from '@/hooks/useNotifications'
import { pageTransition, stagger, fadeUp }    from '@/lib/motion'
import { cn }                                 from '@/lib/utils'
import type { Notification }                  from '@/types/notification'

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { Icon: typeof Bell; bg: string; color: string; label: string }> = {
  complaint_created:  { Icon: CheckCircle2, bg: '#DCFCE7', color: '#16A34A', label: 'Filed'    },
  complaint_assigned: { Icon: Info,         bg: '#DBEAFE', color: '#2563EB', label: 'Assigned' },
  status_changed:     { Icon: Info,         bg: '#EEF2FF', color: '#111827', label: 'Update'   },
  complaint_resolved: { Icon: CheckCircle2, bg: '#DCFCE7', color: '#16A34A', label: 'Resolved' },
  duplicate_detected: { Icon: AlertCircle,  bg: '#FEF3C7', color: '#D97706', label: 'Duplicate'},
  progress_update:    { Icon: Info,         bg: '#DBEAFE', color: '#2563EB', label: 'Progress' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ── Notification card ─────────────────────────────────────────────────────────

function NotifCard({ notif }: { notif: Notification }) {
  const { mutate: markRead } = useMarkRead()
  const cfg = TYPE_CONFIG[notif.type] ?? { Icon: Bell, bg: '#F3F4F6', color: '#6B7280', label: 'Alert' }
  const { Icon } = cfg

  return (
    <motion.div
      variants={fadeUp}
      onClick={() => { if (!notif.is_read) markRead(notif.id) }}
      className={cn(
        'flex items-start gap-3 px-4 py-4 cursor-pointer',
        'hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors',
        !notif.is_read && 'bg-[#FAFAFE]',
      )}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: cfg.bg }}
      >
        <Icon size={17} style={{ color: cfg.color }} strokeWidth={2} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-[14px] leading-snug flex-1',
            notif.is_read ? 'text-[#374151] font-medium' : 'text-[#111827] font-semibold',
          )}>
            {notif.title}
          </p>
          {!notif.is_read && (
            <div className="w-2 h-2 rounded-full bg-[#111827] shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-[13px] text-[#6B7280] mt-0.5 leading-relaxed line-clamp-2">
          {notif.message}
        </p>
        <p className="text-[11px] text-[#9CA3AF] mt-1.5">{timeAgo(notif.created_at)}</p>
      </div>
    </motion.div>
  )
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function NotifSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      <Skeleton width={40} height={40} rounded />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton height={14} className="w-3/4" />
        <Skeleton height={12} className="w-full" />
        <Skeleton height={11} className="w-1/4" />
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const { data, isLoading, isError, refetch } = useNotifications({
    skip:  page * PAGE_SIZE,
    limit: PAGE_SIZE,
  })
  const { data: unreadData } = useUnreadCount()
  const { mutate: markAllRead, isPending: markingAll } = useMarkAllRead()

  const notifs     = data?.items ?? []
  const total      = data?.total ?? 0
  const unread     = unreadData?.unread_count ?? 0
  const hasMore    = (page + 1) * PAGE_SIZE < total

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="min-h-dvh bg-[#F9FAFB] flex flex-col"
    >
      {/* Top bar */}
      <TopBar
        title={`Notifications${unread > 0 ? ` (${unread})` : ''}`}
        showBack
        rightElement={
          unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              isLoading={markingAll}
              onClick={() => markAllRead()}
              leftIcon={<CheckCheck size={15} />}
              className="text-[#111827]"
            >
              All read
            </Button>
          ) : undefined
        }
      />

      {/* Content */}
      <div className="flex-1 pb-24">
        {isLoading ? (
          <div className="bg-white mt-3 mx-4 rounded-2xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
            {Array.from({ length: 5 }).map((_, i) => <NotifSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <EmptyState
            Icon={AlertCircle}
            title="Couldn't load notifications"
            action={<Button variant="secondary" size="sm" onClick={() => refetch()}>Retry</Button>}
          />
        ) : notifs.length === 0 ? (
          <EmptyState
            Icon={Bell}
            title="You're all caught up!"
            description="No notifications yet. We'll alert you when something happens."
            size="md"
          />
        ) : (
          <motion.div
            variants={stagger.container}
            initial="hidden"
            animate="show"
            className="bg-white mt-3 mx-4 rounded-2xl border border-[#E5E7EB] divide-y divide-[#F3F4F6] overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
          >
            {notifs.map(n => <NotifCard key={n.id} notif={n} />)}
          </motion.div>
        )}

        {/* Load more */}
        {hasMore && !isLoading && (
          <div className="flex justify-center py-4">
            <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)}>
              Load more
            </Button>
          </div>
        )}

        {/* Mark all read floating button on mobile */}
        {unread > 0 && !isLoading && (
          <div className="fixed bottom-20 right-4">
            <motion.button
              onClick={() => markAllRead()}
              className="flex items-center gap-2 px-4 h-10 rounded-full bg-[#111827] text-white text-sm font-semibold shadow-lg"
              whileTap={{ scale: 0.95 }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Check size={14} />
              Mark all read
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
