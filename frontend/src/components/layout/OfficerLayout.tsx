/**
 * components/layout/OfficerLayout.tsx
 * Wraps officer pages — same shell as citizen but officer-labelled sidebar.
 */
import { Outlet } from 'react-router-dom'
import { Sidebar }   from './Sidebar'
import { BottomNav } from './BottomNav'

export default function OfficerLayout() {
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
