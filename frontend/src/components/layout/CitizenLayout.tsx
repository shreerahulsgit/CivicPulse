/**
 * components/layout/CitizenLayout.tsx
 * Wraps all citizen-facing pages with sidebar (desktop) + bottom nav (mobile).
 */
import { Outlet } from 'react-router-dom'
import { Sidebar }   from './Sidebar'
import { BottomNav } from './BottomNav'

export default function CitizenLayout() {
  return (
    <div className="flex min-h-dvh bg-[#F9FAFB] overflow-x-hidden">
      {/* Sidebar — desktop only */}
      <Sidebar />

      {/* Main content area — takes remaining width, clips horizontal overflow */}
      <main className="flex-1 min-w-0 overflow-x-hidden md:ml-60 md:px-[100px]">
        <Outlet />
      </main>

      {/* Fixed bottom nav — already position:fixed, just needs to exist in DOM */}
      <BottomNav />
    </div>
  )
}
