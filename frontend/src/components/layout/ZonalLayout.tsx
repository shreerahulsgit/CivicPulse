/**
 * components/layout/ZonalLayout.tsx
 * Shell for all Zonal Officer pages — styled to match AdminLayout/OfficerLayout.
 */
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, LogOut, Bell } from 'lucide-react'
import { ROUTES } from '@/router/routes'
import { useAuthStore } from '@/store/authStore'

const NAV_ITEMS = [
  { to: ROUTES.ZONAL_DASHBOARD,     icon: LayoutDashboard, label: 'Dashboard' },
  { to: ROUTES.ZONAL_COMPLAINTS,    icon: FileText,         label: 'Complaints' },
  { to: ROUTES.ZONAL_WARD_OFFICERS, icon: Users,            label: 'Officers' },
]

export default function ZonalLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate(ROUTES.LOGIN, { replace: true })
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[#F9FAFB]">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-white border-b border-[#E5E7EB]">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-extrabold shrink-0"
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #1F2937 100%)' }}
          >
            Z
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#111827] leading-tight">Zonal Officer</p>
            {user?.email && (
              <p className="text-[10px] text-[#9CA3AF] leading-none truncate max-w-[160px]">{user.email}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
            aria-label="Notifications"
          >
            <Bell size={17} />
          </button>
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#6B7280] hover:bg-red-50 hover:text-red-500 transition-colors"
            aria-label="Logout"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* ── Bottom Nav ───────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-[#E5E7EB] flex bg-white">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === ROUTES.ZONAL_DASHBOARD}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-[#7C3AED]' : 'text-[#9CA3AF] hover:text-[#111827]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    isActive ? 'bg-[#7C3AED]/10' : 'bg-transparent'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
