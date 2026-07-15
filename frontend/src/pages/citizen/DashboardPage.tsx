/**
 * pages/citizen/DashboardPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Citizen Dashboard — Uber × CRED × Google Maps
 *
 * Sections:
 *   1. Greeting Header (BrandTopBar + dynamic greeting)
 *   2. Stat Cards     (Total / In Progress / Resolved — animated counters)
 *   3. Hero Action    (Report New Issue CTA)
 *   4. Recent Complaints (last 5, status badges, skeleton)
 *   5. Mini Map       (Leaflet complaint markers)
 *   6. Notification Preview (last 3, unread count)
 *
 * UX:
 *   - Pull-to-refresh (touch drag gesture)
 *   - pageTransition entrance animation
 *   - Stagger children
 *   - Skeleton + error states on all data sections
 */

import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { ArrowsCounterClockwise } from '@phosphor-icons/react'


import { useAuthStore }        from '@/store/authStore'
import { useMyComplaints }     from '@/hooks/useComplaints'
import { useNotifications }    from '@/hooks/useNotifications'
import { useUnreadCount }      from '@/hooks/useNotifications'

import { BrandTopBar }         from '@/components/layout/TopBar'
import { StatsSection }        from '@/components/dashboard/StatsSection'
import { HeroAction }          from '@/components/dashboard/HeroAction'
import { RecentComplaints }    from '@/components/dashboard/RecentComplaints'
import { MiniMap }             from '@/components/dashboard/MiniMap'
import { NotificationPreview } from '@/components/dashboard/NotificationPreview'

import { pageTransition, stagger, fadeUp } from '@/lib/motion'
import { ROUTES }              from '@/router/routes'

// ── Pull-to-refresh hook ──────────────────────────────────────────────────────

const PTR_THRESHOLD = 72   // px drag to trigger refresh

function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false)
  const y     = useMotionValue(0)
  const scale = useTransform(y, [0, PTR_THRESHOLD], [0, 1])
  const startY = useRef(0)

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const scrollTop = (e.currentTarget as HTMLElement).scrollTop
    if (scrollTop > 0) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) y.set(Math.min(delta * 0.4, PTR_THRESHOLD + 20))
  }

  const onTouchEnd = useCallback(async () => {
    if (y.get() >= PTR_THRESHOLD && !refreshing) {
      setRefreshing(true)
      y.set(PTR_THRESHOLD)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        y.set(0)
      }
    } else {
      y.set(0)
    }
  }, [y, refreshing, onRefresh])

  return { y, scale, refreshing, onTouchStart, onTouchMove, onTouchEnd }
}

// ── Greeting helper ───────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CitizenDashboardPage() {
  const navigate    = useNavigate()
  const { user }    = useAuthStore()
  const firstName   = user?.full_name?.split(' ')[0] ?? 'there'

  // ── Data queries ────────────────────────────────────────────────────────────

  const {
    data:       complaintsData,
    isLoading:  complaintsLoading,
    isError:    complaintsError,
    refetch:    refetchComplaints,
  } = useMyComplaints({ limit: 50 })

  const {
    data:      notifsData,
    isLoading: notifsLoading,
    refetch:   refetchNotifs,
  } = useNotifications({ limit: 3 })

  const { data: unreadData } = useUnreadCount()

  const complaints  = complaintsData           ?? []
  const notifs      = notifsData?.items        ?? []
  const unreadCount = unreadData?.unread_count ?? 0

  // ── Pull-to-refresh ─────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchComplaints(), refetchNotifs()])
  }, [refetchComplaints, refetchNotifs])

  const { y, scale, refreshing, onTouchStart, onTouchMove, onTouchEnd } =
    usePullToRefresh(handleRefresh)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex flex-col bg-[#F9FAFB] min-h-dvh"
    >
      {/* Brand top bar */}
      <BrandTopBar
        unreadCount={unreadCount}
        onBellClick={() => navigate(ROUTES.NOTIFICATIONS)}
      />

      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {(y.get() > 0 || refreshing) && (
          <motion.div
            style={{ scaleY: scale, originY: 0 }}
            className="flex items-center justify-center py-3 bg-[#F9FAFB]"
          >
            <motion.div
              animate={refreshing ? { rotate: 360 } : {}}
              transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : {}}
            >
              <ArrowsCounterClockwise
                size={18}
                weight="bold"
                color={refreshing ? '#111827' : '#9CA3AF'}
              />
            </motion.div>
            <span className="ml-2 text-xs text-[#9CA3AF] font-medium">
              {refreshing ? 'Refreshing…' : 'Pull to refresh'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable content */}
      <div
        className="flex-1"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
        <motion.div
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className="space-y-5 pt-3"
        >
          {/* 1 ── Greeting ───────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="px-4">
            <p className="text-[12px] text-[#9CA3AF] font-medium uppercase tracking-wider mb-0.5">
              {getGreeting()}
            </p>
            <h1
              className="font-extrabold text-[#111827] leading-tight"
              style={{ fontSize: '26px', letterSpacing: '-0.03em' }}
            >
              {firstName} 👋
            </h1>
            <p className="text-[#6B7280] text-sm mt-1">
              Here's what's happening in your area.
            </p>
          </motion.div>

          {/* 2 ── Stat cards ─────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <StatsSection
              complaints={complaints}
              isLoading={complaintsLoading}
            />
          </motion.div>

          {/* 3 ── Hero action ─────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <HeroAction />
          </motion.div>

          {/* 4 ── Recent complaints ───────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <RecentComplaints
              complaints={complaints}
              isLoading={complaintsLoading}
              isError={complaintsError}
              onRetry={refetchComplaints}
              onViewAll={() => navigate(ROUTES.REPORT_COMPLAINT)}
            />
          </motion.div>

          {/* 5 ── Mini map ────────────────────────────────────────────────── */}
          {!complaintsLoading && complaints.length > 0 && (
            <motion.div variants={fadeUp}>
              <MiniMap complaints={complaints} />
            </motion.div>
          )}

          {/* 6 ── Notification preview ────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <NotificationPreview
              notifications={notifs}
              unreadCount={unreadCount}
              isLoading={notifsLoading}
            />
          </motion.div>

          {/* Footer spacer */}
          <div className="h-2" />
        </motion.div>
      </div>
    </motion.div>
  )
}
