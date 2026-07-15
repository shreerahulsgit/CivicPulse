/**
 * pages/auth/SplashPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated splash screen — shown once on app open.
 *
 * Flow:
 *   logged in        → role dashboard (immediate)
 *   onboarded before → /login (after animation)
 *   first visit      → /onboarding (after animation)
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Variants, Transition } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/router/routes'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ONBOARDED_KEY = 'civicpulse_onboarded'

function getDestination(isLoggedIn: boolean, role?: string): string {
  if (isLoggedIn) {
    if (role === 'admin')   return ROUTES.ADMIN_DASHBOARD
    if (role === 'officer') return ROUTES.OFFICER_DASHBOARD
    return ROUTES.CITIZEN_DASHBOARD
  }
  if (localStorage.getItem(ONBOARDED_KEY)) return ROUTES.LOGIN
  return ROUTES.ONBOARDING
}

// ── Animation variants ────────────────────────────────────────────────────────

const springFast: Transition = { type: 'spring' as const, stiffness: 380, damping: 22 }
const springMed:  Transition = { type: 'spring' as const, stiffness: 200, damping: 20 }
const smoothOut = [0.16, 1, 0.3, 1] as [number, number, number, number]

const logoContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
}

const mark: Variants = {
  hidden: { scale: 0, opacity: 0, rotate: -15 },
  show: {
    scale: 1, opacity: 1, rotate: 0,
    transition: springFast,
  },
}

const wordMark: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: {
    opacity: 1, x: 0,
    transition: { duration: 0.4, ease: smoothOut },
  },
}

const tagline: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: smoothOut, delay: 0.5 },
  },
}

const ringVariant: Variants = {
  hidden: { scale: 0.7, opacity: 0 },
  show: {
    scale: 1, opacity: 1,
    transition: { ...springMed, delay: 0.05 },
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SplashPage() {
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuthStore()

  useEffect(() => {
    const dest = getDestination(isLoggedIn, user?.role)
    const timer = setTimeout(() => navigate(dest, { replace: true }), 2600)
    return () => clearTimeout(timer)
  }, [isLoggedIn, user?.role, navigate])

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: '#111827' }}
      exit={{ opacity: 0, scale: 1.06, transition: { duration: 0.35 } }}
    >
      {/* Background gradient rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          variants={ringVariant}
          initial="hidden"
          animate="show"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-[420px] h-[420px] rounded-full border border-white/5"
        />
        <motion.div
          variants={ringVariant}
          initial="hidden"
          animate="show"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-[600px] h-[600px] rounded-full border border-white/[0.03]"
        />
        {/* Subtle glow blob */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)' }}
        />
      </div>

      {/* Logo group */}
      <motion.div
        variants={logoContainer}
        initial="hidden"
        animate="show"
        className="relative flex flex-col items-center gap-5"
      >
        {/* Icon mark */}
        <motion.div variants={mark} className="relative">
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-3xl bg-blue-500/20 blur-xl scale-125" />

          {/* Mark */}
          <div
            className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 50%, #60A5FA 100%)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 20px 40px rgba(59,130,246,0.35)',
            }}
          >
            <span
              className="text-white font-extrabold tracking-tight select-none"
              style={{ fontSize: '26px', letterSpacing: '-0.04em' }}
            >
              CP
            </span>

            {/* Inner shine */}
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)',
              }}
            />
          </div>
        </motion.div>

        {/* Wordmark */}
        <motion.div variants={wordMark} className="text-center">
          <h1
            className="text-white font-extrabold tracking-tight"
            style={{ fontSize: '32px', letterSpacing: '-0.04em' }}
          >
            CivicPulse
          </h1>
        </motion.div>
      </motion.div>

      {/* Tagline */}
      <motion.p
        variants={tagline}
        initial="hidden"
        animate="show"
        className="absolute bottom-0 left-0 right-0 pb-16 text-center"
        style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}
      >
        Your city. Your voice.
      </motion.p>

      {/* Loading dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        className="absolute bottom-10 flex gap-1.5"
      >
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="w-1 h-1 rounded-full bg-white/30"
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </motion.div>
    </motion.div>
  )
}
