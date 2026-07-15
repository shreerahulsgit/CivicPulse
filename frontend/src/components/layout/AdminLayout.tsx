/**
 * components/layout/AdminLayout.tsx
 * Admin shell — wider sidebar, no bottom nav on desktop.
 */
import { Outlet } from 'react-router-dom'
import { Sidebar }   from './Sidebar'
import { BottomNav } from './BottomNav'

export default function AdminLayout() {
  return (
    <div className="flex min-h-dvh bg-[#F9FAFB] overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
