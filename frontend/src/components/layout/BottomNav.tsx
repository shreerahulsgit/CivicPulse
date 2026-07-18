/**
 * src/components/layout/BottomNav.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Mobile bottom navigation — clean white, teal active state, Phosphor icons.
 * No glassmorphism. Solid white with top border.
 */

import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  House,
  PlusCircle,
  Bell,
  User,
  ClipboardText,
  SquaresFour,
  Users,
  ChartBar,
  Warning,
  ChatCircleDots,
} from '@phosphor-icons/react'
import { useAuthStore } from '@/store/authStore'

import { ROUTES } from '@/router/routes'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { queryKeys } from '@/lib/queryClient'
import { CountBadge } from '@/components/ui/Badge'

// ── Tab definitions ───────────────────────────────────────────────────────────

type PhosphorIconComponent = React.FC<{ size?: number; weight?: string; color?: string; className?: string }>

type Tab = {
  to:         string
  label:      string
  Icon:       PhosphorIconComponent
  showBadge?: boolean
}

const CITIZEN_TABS: Tab[] = [
  { to: ROUTES.CITIZEN_DASHBOARD, label: 'Home',    Icon: House as PhosphorIconComponent },
  { to: ROUTES.REPORT_COMPLAINT,  label: 'Report',  Icon: PlusCircle as PhosphorIconComponent },
  { to: ROUTES.FORUM,             label: 'Forum',   Icon: ChatCircleDots as PhosphorIconComponent },
  { to: ROUTES.NOTIFICATIONS,     label: 'Alerts',  Icon: Bell as PhosphorIconComponent, showBadge: true },
  { to: ROUTES.PROFILE,           label: 'Profile', Icon: User as PhosphorIconComponent },
]

const OFFICER_TABS: Tab[] = [
  { to: ROUTES.OFFICER_DASHBOARD,  label: 'Home',   Icon: House as PhosphorIconComponent },
  { to: ROUTES.OFFICER_COMPLAINTS, label: 'Queue',  Icon: ClipboardText as PhosphorIconComponent },
  { to: ROUTES.FORUM,              label: 'Forum',  Icon: ChatCircleDots as PhosphorIconComponent },
  { to: ROUTES.NOTIFICATIONS,      label: 'Alerts', Icon: Bell as PhosphorIconComponent, showBadge: true },
  { to: ROUTES.PROFILE,            label: 'Profile',Icon: User as PhosphorIconComponent },
]

const ADMIN_TABS: Tab[] = [
  { to: ROUTES.ADMIN_DASHBOARD,  label: 'Home',      Icon: SquaresFour as PhosphorIconComponent },
  { to: ROUTES.ADMIN_COMPLAINTS, label: 'Cases',     Icon: ClipboardText as PhosphorIconComponent },
  { to: ROUTES.ADMIN_ESCALATED,  label: 'Escalated', Icon: Warning as PhosphorIconComponent },
  { to: ROUTES.ADMIN_OFFICERS,   label: 'Officers',  Icon: Users as PhosphorIconComponent },
  { to: ROUTES.ADMIN_ANALYTICS,  label: 'Analytics', Icon: ChartBar as PhosphorIconComponent },
]

// ── Brand teal ────────────────────────────────────────────────────────────────
const ACTIVE = '#111827'
const MUTED  = '#9CA3AF'

// ── Component ─────────────────────────────────────────────────────────────────

export function BottomNav() {
  const { isAdmin, isAnyOfficer, isLoggedIn } = useAuthStore()
  const { pathname } = useLocation()

  const { data: unread } = useQuery({
    queryKey:       queryKeys.unreadCount(),
    queryFn:        notificationsApi.unreadCount,
    enabled:        isLoggedIn,
    refetchInterval:30_000,
  })
  const unreadCount = unread?.unread_count ?? 0

  if (!isLoggedIn) return null

  const tabs = isAdmin ? ADMIN_TABS : isAnyOfficer ? OFFICER_TABS : CITIZEN_TABS

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 md:hidden"
      role="navigation"
      aria-label="Main navigation"
    >
      <div
        className="bg-white border-t border-[#E5E7EB]"
        style={{ boxShadow: '0 -2px 12px rgba(15,23,42,0.06)' }}
      >
        <div
          className="flex items-stretch"
          style={{
            height: 'var(--bottom-nav-h)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            boxSizing: 'content-box',
          }}
        >
          {tabs.map(({ to, label, Icon, showBadge }) => {
            const isActive = to === '/'
              ? pathname === '/'
              : pathname === to || pathname.startsWith(to + '/')

            const badgeCount = showBadge ? unreadCount : 0

            return (
              <NavLink
                key={to}
                to={to}
                className="flex-1 flex flex-col items-center justify-center relative"
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active top indicator */}
                {isActive && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute top-0 w-10 h-[3px] rounded-b-full"
                    style={{ background: ACTIVE }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}

                {/* Icon */}
                <motion.div
                  className="relative mb-0.5"
                  animate={isActive ? { y: -1, scale: 1.05 } : { y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                >
                  <Icon
                    size={22}
                    weight={isActive ? 'duotone' : 'regular'}
                    color={isActive ? ACTIVE : MUTED}
                  />
                  <AnimatePresence>
                    {badgeCount > 0 && <CountBadge count={badgeCount} />}
                  </AnimatePresence>
                </motion.div>

                {/* Label */}
                <span
                  className="text-[10px] font-semibold transition-colors duration-200"
                  style={{ color: isActive ? ACTIVE : MUTED }}
                >
                  {label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
