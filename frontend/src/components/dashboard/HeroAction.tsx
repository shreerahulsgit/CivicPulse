/**
 * src/components/dashboard/HeroAction.tsx
 * Full-width CTA + Quick Actions — neutral monochrome, no bloom.
 */

import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  PlusCircle,
  ArrowRight,
  MapPin,
  Binoculars,
  ChatCircleDots,
  Bell,
} from '@phosphor-icons/react'
import { ROUTES } from '@/router/routes'

const QUICK_ACTIONS = [
  {
    label: 'Track',
    Icon:  Binoculars,
    route: '/citizen/complaints',
    bg:    '#F3F4F6',
    color: '#374151',
  },
  {
    label: 'Forum',
    Icon:  ChatCircleDots,
    route: ROUTES.FORUM,
    bg:    '#F0FDF4',
    color: '#166534',
  },
  {
    label: 'Alerts',
    Icon:  Bell,
    route: ROUTES.NOTIFICATIONS,
    bg:    '#FEF3C7',
    color: '#92400E',
  },
]

export function HeroAction() {
  const navigate = useNavigate()

  return (
    <div className="px-4 space-y-3">
      {/* Main Report CTA */}
      <motion.div
        onClick={() => navigate(ROUTES.REPORT_COMPLAINT)}
        className="rounded-2xl overflow-hidden cursor-pointer relative select-none"
        style={{
          background: '#111827',
          boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
        }}
        whileTap={{ scale: 0.975 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        {/* Subtle texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative p-5 flex items-center gap-4">
          <div
            className="w-13 h-13 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <PlusCircle size={26} color="white" weight="duotone" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-[0.1em] mb-0.5">
              Civic Action
            </p>
            <h2 className="text-white font-bold leading-tight" style={{ fontSize: '20px', letterSpacing: '-0.02em' }}>
              Report New Issue
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin size={11} color="rgba(255,255,255,0.4)" weight="fill" />
              <p className="text-white/40 text-xs font-medium">GPS-pinned · AI categorised</p>
            </div>
          </div>

          <motion.div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowRight size={16} color="white" weight="bold" />
          </motion.div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {QUICK_ACTIONS.map(({ label, Icon, route, bg, color }) => (
          <motion.button
            key={label}
            type="button"
            onClick={() => navigate(route)}
            className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl border border-[#E5E7EB] bg-white transition-all"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            whileTap={{ scale: 0.93 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
              <Icon size={20} color={color} weight="duotone" />
            </div>
            <span className="text-[12px] font-semibold text-[#374151]">{label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
