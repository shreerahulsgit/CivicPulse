/**
 * pages/auth/OnboardingPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 3-slide onboarding with:
 *   - Drag/swipe to advance (Framer Motion drag)
 *   - Animated slide transitions
 *   - Dot progress indicator
 *   - Skip + Next/Get Started buttons
 *   - Marks "onboarded" in localStorage on complete/skip
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue } from 'framer-motion'
import { ChevronRight, MapPin, Bell, ShieldCheck } from 'lucide-react'
import { ROUTES } from '@/router/routes'

// ── Slide data ────────────────────────────────────────────────────────────────

const SLIDES = [
  {
    id:          'report',
    Icon:        MapPin,
    iconBg:      'linear-gradient(135deg, #3B82F6 0%, #111827 100%)',
    iconGlow:    'rgba(17,24,39,0.3)',
    title:       'Report Civic Issues',
    description: 'Spot a pothole, broken streetlight, or overflowing drain? Report it in seconds with your location — right from your phone.',
    accentLight: '#EEF2FF',
    accentDark:  '#111827',
  },
  {
    id:          'track',
    Icon:        Bell,
    iconBg:      'linear-gradient(135deg, #22C55E 0%, #10B981 100%)',
    iconGlow:    'rgba(34,197,94,0.3)',
    title:       'Track in Real Time',
    description: 'Get live updates as your complaint moves through the system. Know who\'s assigned, what\'s happening, and when it\'s resolved.',
    accentLight: '#DCFCE7',
    accentDark:  '#22C55E',
  },
  {
    id:          'impact',
    Icon:        ShieldCheck,
    iconBg:      'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    iconGlow:    'rgba(245,158,11,0.3)',
    title:       'Make an Impact',
    description: 'Every complaint you file makes your city better. Join thousands of citizens who are building a cleaner, safer community together.',
    accentLight: '#FEF3C7',
    accentDark:  '#F59E0B',
  },
]

const ONBOARDED_KEY = 'civicpulse_onboarded'

// ── Slide illustration ────────────────────────────────────────────────────────

function SlideIllustration({
  slide,
  isActive,
}: {
  slide: typeof SLIDES[0]
  isActive: boolean
}) {
  const { Icon, iconBg, iconGlow, accentLight } = slide

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ height: '280px' }}
    >
      {/* Background accent circle */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={isActive ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute w-64 h-64 rounded-full"
        style={{ background: accentLight }}
      />

      {/* Floating decorative rings */}
      <motion.div
        animate={isActive ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="absolute w-52 h-52 rounded-full border-2 border-dashed"
        style={{ borderColor: `${slide.accentDark}30` }}
      />

      {/* Glow */}
      <div
        className="absolute w-28 h-28 rounded-full blur-3xl"
        style={{ background: iconGlow }}
      />

      {/* Main icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0, y: 20 }}
        animate={isActive
          ? { scale: 1, opacity: 1, y: 0 }
          : { scale: 0.5, opacity: 0, y: 20 }
        }
        transition={{
          type: 'spring', stiffness: 300, damping: 22, delay: isActive ? 0.1 : 0,
        }}
        className="relative w-24 h-24 rounded-3xl flex items-center justify-center"
        style={{
          background: iconBg,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.15), 0 20px 40px ${iconGlow}`,
        }}
      >
        <Icon size={40} color="white" strokeWidth={1.75} />

        {/* Shine */}
        <div
          className="absolute inset-0 rounded-3xl"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 60%)' }}
        />
      </motion.div>

      {/* Floating mini circles */}
      {[
        { size: 10, x: -80, y: -60, delay: 0 },
        { size: 7,  x: 90,  y: -40, delay: 0.3 },
        { size: 12, x: 70,  y: 80,  delay: 0.6 },
        { size: 6,  x: -70, y: 70,  delay: 0.9 },
      ].map((dot, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width:  dot.size,
            height: dot.size,
            left: `calc(50% + ${dot.x}px)`,
            top:  `calc(50% + ${dot.y}px)`,
            background: slide.accentDark,
            opacity: 0.4,
          }}
          animate={isActive
            ? { y: [-4, 4, -4], opacity: [0.4, 0.7, 0.4] }
            : { opacity: 0 }
          }
          transition={{
            duration: 3, repeat: Infinity, ease: 'easeInOut', delay: dot.delay,
          }}
        />
      ))}
    </div>
  )
}

// ── Dot indicator ─────────────────────────────────────────────────────────────

function ProgressDots({
  total, current, color,
}: {
  total: number
  current: number
  color: string
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width:   i === current ? 24 : 8,
            opacity: i === current ? 1 : 0.3,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="h-2 rounded-full"
          style={{ background: i === current ? color : '#D1D5DB' }}
        />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const SWIPE_CONFIDENCE = 8000
const swipePower = (offset: number, velocity: number) =>
  Math.abs(offset) * velocity

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(0)  // -1 = prev, 1 = next
  const dragX = useMotionValue(0)

  const slide = SLIDES[current]
  const isLast = current === SLIDES.length - 1

  const complete = () => {
    localStorage.setItem(ONBOARDED_KEY, '1')
    navigate(ROUTES.LOGIN, { replace: true })
  }

  const goNext = () => {
    if (isLast) { complete(); return }
    setDirection(1)
    setCurrent(c => c + 1)
  }

  const goPrev = () => {
    if (current === 0) return
    setDirection(-1)
    setCurrent(c => c - 1)
  }

  // Swipe drag end
  const onDragEnd = (_: unknown, { offset, velocity }: { offset: { x: number }; velocity: { x: number } }) => {
    const power = swipePower(offset.x, velocity.x)
    if (power < -SWIPE_CONFIDENCE) {
      goNext()
    } else if (power > SWIPE_CONFIDENCE) {
      goPrev()
    }
  }

  // Slide variants
  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d < 0 ? '100%' : '-100%', opacity: 0 }),
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: '#FFFFFF', maxWidth: '430px', margin: '0 auto' }}
    >
      {/* Skip button */}
      <div className="absolute top-0 right-0 z-10 p-5">
        {!isLast && (
          <button
            onClick={complete}
            className="text-sm font-medium px-3 py-1.5 rounded-full text-text-muted
                       hover:text-text-primary hover:bg-surface-sunken transition-all"
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence custom={direction} mode="popLayout">
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={onDragEnd}
            style={{ x: dragX }}
            className="absolute inset-0 flex flex-col"
          >
            {/* Illustration */}
            <div className="flex-1 flex items-center justify-center px-8">
              <SlideIllustration slide={slide} isActive />
            </div>

            {/* Text */}
            <div className="px-8 pb-6">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="text-[26px] font-extrabold text-text-primary tracking-tight leading-[1.15] mb-3"
              >
                {slide.title}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="text-[15px] text-text-muted leading-relaxed"
              >
                {slide.description}
              </motion.p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="px-6 pb-[calc(32px+env(safe-area-inset-bottom,0px))] pt-4 flex items-center justify-between">
        {/* Progress dots */}
        <ProgressDots
          total={SLIDES.length}
          current={current}
          color={slide.accentDark}
        />

        {/* Next / Get Started */}
        <motion.button
          onClick={goNext}
          className="h-14 px-8 rounded-2xl font-bold text-base text-white
                     flex items-center gap-2 shadow-lg active:scale-95 transition-transform"
          style={{
            background: isLast
              ? 'linear-gradient(135deg, #111827 0%, #1E3A5F 100%)'
              : `linear-gradient(135deg, ${slide.accentDark} 0%, ${slide.accentDark}cc 100%)`,
            boxShadow: `0 8px 24px ${slide.iconGlow}`,
          }}
          animate={{ scale: 1 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        >
          {isLast ? (
            <span>Get Started</span>
          ) : (
            <>
              <span>Next</span>
              <ChevronRight size={18} strokeWidth={2.5} />
            </>
          )}
        </motion.button>
      </div>
    </div>
  )
}
