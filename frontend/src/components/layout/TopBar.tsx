/**
 * src/components/layout/TopBar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium mobile top bar — mobile-first, clean, teal brand.
 * No glassmorphism. Solid white with crisp border.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  MagnifyingGlass,
  X,
  Bell,
  SignOut,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { CountBadge } from '@/components/ui/Badge'
import { fadeIn } from '@/lib/motion'

// ── Standard TopBar ───────────────────────────────────────────────────────────

interface TopBarProps {
  title:          string
  showBack?:      boolean
  onBack?:        () => void
  rightElement?:  React.ReactNode
  showSearch?:    boolean
  onSearch?:      (query: string) => void
  showBell?:      boolean
  unreadCount?:   number
  className?:     string
  transparent?:   boolean
  large?:         boolean
}

export function TopBar({
  title, showBack, onBack, rightElement,
  showSearch, onSearch,
  showBell, unreadCount = 0,
  className, transparent, large,
}: TopBarProps) {
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const handleBack = () => {
    if (onBack) onBack()
    else navigate(-1)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.(query)
  }

  const handleSearchClose = () => {
    setSearchOpen(false)
    setQuery('')
    onSearch?.('')
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 md:mx-[-100px] md:w-[calc(100%+200px)]',
        transparent
          ? 'bg-transparent'
          : 'bg-white border-b border-[#E5E7EB]',
        className,
      )}
      style={{ height: 'var(--top-bar-h)' }}
    >
      <AnimatePresence mode="wait">
        {searchOpen ? (
          <motion.form
            key="search"
            variants={fadeIn}
            initial="hidden"
            animate="show"
            exit="exit"
            onSubmit={handleSearchSubmit}
            className="flex items-center h-full px-4 gap-2"
          >
            <input
              autoFocus
              type="search"
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                onSearch?.(e.target.value)
              }}
              placeholder="Search complaints…"
              className="flex-1 h-9 bg-[#F3F4F6] rounded-lg px-4 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none border border-[#E5E7EB] focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/15 transition-colors"
            />
            <button
              type="button"
              onClick={handleSearchClose}
              className="p-2 rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] transition-colors"
              aria-label="Close search"
            >
              <X size={18} weight="bold" />
            </button>
          </motion.form>
        ) : (
          <motion.div
            key="normal"
            variants={fadeIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className="flex items-center h-full px-4 gap-1"
          >
            {showBack && (
              <motion.button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-xl mr-1 hover:bg-[#F3F4F6] text-[#111827] transition-colors"
                whileTap={{ scale: 0.90 }}
                transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                aria-label="Go back"
              >
                <ArrowLeft size={20} weight="bold" />
              </motion.button>
            )}

            <div className="flex-1 min-w-0">
              <motion.h1
                layout
                className={cn(
                  'text-[#111827] font-semibold tracking-tight truncate',
                  large ? 'text-[22px]' : 'text-[17px]',
                )}
              >
                {title}
              </motion.h1>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {showSearch && (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 rounded-xl hover:bg-[#F3F4F6] text-[#374151] transition-colors"
                  aria-label="Open search"
                >
                  <MagnifyingGlass size={19} weight="bold" />
                </button>
              )}
              {showBell && (
                <button
                  className="relative p-2 rounded-xl hover:bg-[#F3F4F6] text-[#374151] transition-colors"
                  aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                >
                  <Bell size={19} weight="bold" />
                  <AnimatePresence>
                    {unreadCount > 0 && <CountBadge count={unreadCount} />}
                  </AnimatePresence>
                </button>
              )}
              {rightElement}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ── Brand TopBar (citizen dashboard) ─────────────────────────────────────────

interface BrandTopBarProps {
  unreadCount?: number
  onBellClick?: () => void
  className?:   string
}

export function BrandTopBar({ unreadCount = 0, onBellClick, className }: BrandTopBarProps) {
  const { user, logout } = useAuthStore()

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <header
      className={cn('sticky top-0 z-40 bg-white border-b border-[#E5E7EB] md:mx-[-100px] md:w-[calc(100%+200px)]', className)}
      style={{ height: 'var(--top-bar-h)' }}
    >
      <div className="flex items-center h-full px-4 gap-3">
        {/* Brand icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          style={{ background: '#111827', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}

        >
          <img
            src="/apple-touch-icon.png"
            alt="CivicPulse"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[#9CA3AF] leading-none mb-0.5 font-medium">{greeting()}</p>
          <p className="text-[15px] font-semibold text-[#111827] truncate leading-none">
            {user?.full_name?.split(' ')[0] ?? 'Welcome'}
          </p>
        </div>

        <button
          onClick={onBellClick}
          className="relative p-2 rounded-xl hover:bg-[#F3F4F6] text-[#374151] transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell size={20} weight="bold" />
          <AnimatePresence>
            {unreadCount > 0 && <CountBadge count={unreadCount} />}
          </AnimatePresence>
        </button>

        <button
          onClick={logout}
          className="p-2 rounded-xl hover:bg-red-50 text-red-500 transition-colors"
          aria-label="Sign out"
        >
          <SignOut size={20} weight="bold" />
        </button>
      </div>
    </header>
  )
}
