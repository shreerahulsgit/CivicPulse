/**
 * components/layout/Sidebar.tsx — Desktop Sidebar Navigation (md+)
 *
 * Hidden on mobile. Shows brand, nav links, user info at bottom.
 * Collapses to icon-only at a configurable breakpoint.
 */

import { NavLink } from 'react-router-dom'
import {
  Home, PlusCircle, Bell, User, ClipboardList,
  LayoutDashboard, Users, BarChart3, Building2,
  LogOut, ChevronRight, UserCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/router/routes'

const CITIZEN_LINKS = [
  { to: ROUTES.CITIZEN_DASHBOARD, label: 'Dashboard',   Icon: Home },
  { to: ROUTES.REPORT_COMPLAINT,  label: 'Report',      Icon: PlusCircle },
  { to: ROUTES.NOTIFICATIONS,     label: 'Alerts',      Icon: Bell },
  { to: ROUTES.PROFILE,           label: 'Profile',     Icon: User },
]

const OFFICER_LINKS = [
  { to: ROUTES.OFFICER_DASHBOARD,  label: 'Dashboard',   Icon: Home },
  { to: ROUTES.OFFICER_COMPLAINTS, label: 'Complaints',  Icon: ClipboardList },
  { to: ROUTES.NOTIFICATIONS,      label: 'Alerts',      Icon: Bell },
  { to: ROUTES.PROFILE,            label: 'Profile',     Icon: User },
]

const ADMIN_LINKS = [
  { to: ROUTES.ADMIN_DASHBOARD,   label: 'Dashboard',   Icon: LayoutDashboard },
  { to: ROUTES.ADMIN_ANALYTICS,   label: 'Analytics',   Icon: BarChart3 },
  { to: ROUTES.ADMIN_COMPLAINTS,  label: 'Complaints',  Icon: ClipboardList },
  { to: ROUTES.ADMIN_OFFICERS,    label: 'Officers',    Icon: Users },
  { to: ROUTES.ADMIN_USERS,       label: 'Users',       Icon: UserCircle2 },
  { to: ROUTES.ADMIN_DEPARTMENTS, label: 'Departments', Icon: Building2 },
]

export function Sidebar() {
  const { user, isAdmin, isAnyOfficer, logout } = useAuthStore()
  const links = isAdmin ? ADMIN_LINKS : isAnyOfficer ? OFFICER_LINKS : CITIZEN_LINKS

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border bg-white h-screen sticky top-0">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white text-sm font-bold">CP</span>
          </div>
          <span className="text-[17px] font-bold text-primary tracking-tight">CivicPulse</span>
        </div>
        {isAdmin && (
          <span className="mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wider text-danger bg-danger-muted px-2 py-0.5 rounded-full">
            Admin
          </span>
        )}
        {isAnyOfficer && (
          <span className="mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wider text-[#111827] bg-[#EEF2FF] px-2 py-0.5 rounded-full">
            Officer
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/' || to === ROUTES.OFFICER_DASHBOARD || to === ROUTES.ADMIN_DASHBOARD}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={14} className="opacity-60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-3 pb-6 pt-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-semibold">
              {user?.full_name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{user?.full_name}</p>
            <p className="text-xs text-muted truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg hover:bg-danger-muted text-muted hover:text-danger transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
