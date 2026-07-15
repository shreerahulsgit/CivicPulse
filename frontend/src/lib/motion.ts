/**
 * src/lib/motion.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CivicPulse Framer Motion Preset Library
 *
 * Aesthetic: Uber precision × CRED premium × Google Maps clarity
 *
 * All variants follow the { hidden, show, exit } convention so AnimatePresence
 * works correctly with `mode="wait"` for page transitions.
 *
 * Usage:
 *   import { fadeUp, pageTransition, stagger } from '@/lib/motion'
 *
 *   <motion.div variants={fadeUp} initial="hidden" animate="show" exit="exit">
 *
 *   <motion.ul variants={stagger.container}>
 *     <motion.li variants={stagger.item}>
 */

import type { Variants, Transition } from 'framer-motion'

// ── Shared spring/easing configs ──────────────────────────────────────────────

const springSnappy: Transition = {
  type: 'spring', stiffness: 500, damping: 35, mass: 0.8,
}

const springSmooth: Transition = {
  type: 'spring', stiffness: 280, damping: 28, mass: 0.9,
}

const easeSmoothOut: Transition = {
  duration: 0.28, ease: [0.16, 1, 0.3, 1],   // expo out — CRED style
}

const easeFastOut: Transition = {
  duration: 0.18, ease: [0, 0, 0.2, 1],
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Presets
// ═══════════════════════════════════════════════════════════════════════════

/** Fade in only — overlays, modal backdrops, tooltips */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:   { opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } },
}

/** Fade + slide up — most common card/list entry */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0,  transition: easeSmoothOut },
  exit:   { opacity: 0, y: -8, transition: easeFastOut },
}

/** Fade + slide down — dropdowns, notification panels from top */
export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -14 },
  show:   { opacity: 1, y: 0,   transition: easeSmoothOut },
  exit:   { opacity: 0, y: -8,  transition: easeFastOut },
}

/** Slide up from bottom — bottom sheets, mobile drawers */
export const slideUp: Variants = {
  hidden: { opacity: 0, y: '100%' },
  show:   { opacity: 1, y: '0%',   transition: springSmooth },
  exit:   { opacity: 0, y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
}

/** Slide in from right — detail pages, drill-down */
export const slideRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  show:   { opacity: 1, x: 0,   transition: { ...easeSmoothOut, duration: 0.32 } },
  exit:   { opacity: 0, x: -20, transition: easeFastOut },
}

/** Slide in from left — back navigation */
export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  show:   { opacity: 1, x: 0,  transition: { ...easeSmoothOut, duration: 0.32 } },
  exit:   { opacity: 0, x: 20, transition: easeFastOut },
}

/** Scale + fade — modals, popovers, context menus */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show:   { opacity: 1, scale: 1,    transition: { ...springSnappy, duration: 0.22 } },
  exit:   { opacity: 0, scale: 0.96, transition: easeFastOut },
}

/** Scale from bottom — bottom modal sheets */
export const scaleInBottom: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 16 },
  show:   { opacity: 1, scale: 1,    y: 0, transition: springSmooth },
  exit:   { opacity: 0, scale: 0.96, y: 12, transition: easeFastOut },
}

// ═══════════════════════════════════════════════════════════════════════════
// Page Transitions
// ═══════════════════════════════════════════════════════════════════════════

/** Standard page transition — used in <AnimatePresence mode="wait"> */
export const pageTransition: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
    filter: 'blur(4px)',
  },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.32,
      ease: [0.16, 1, 0.3, 1],
      filter: { duration: 0.2 },
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(2px)',
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  },
}

/** Uber-style page transition — slides left on forward, right on back */
export const pageSlide = {
  forward: {
    hidden: { opacity: 0, x: '100%' },
    show:   { opacity: 1, x: '0%',   transition: springSmooth },
    exit:   { opacity: 0, x: '-30%', transition: easeFastOut },
  } as Variants,
  back: {
    hidden: { opacity: 0, x: '-100%' },
    show:   { opacity: 1, x: '0%',    transition: springSmooth },
    exit:   { opacity: 0, x: '30%',   transition: easeFastOut },
  } as Variants,
}

// ═══════════════════════════════════════════════════════════════════════════
// Stagger Containers
// ═══════════════════════════════════════════════════════════════════════════

/** Stagger — wrap a list in the container, use item for children */
export const stagger = {
  container: {
    hidden: {},
    show: {
      transition: {
        staggerChildren:  0.055,
        delayChildren:    0.05,
      },
    },
    exit: {
      transition: {
        staggerChildren:  0.03,
        staggerDirection: -1,
      },
    },
  } as Variants,

  item: fadeUp,

  /** Faster stagger for dense lists */
  itemFast: {
    hidden: { opacity: 0, y: 10 },
    show:   { opacity: 1, y: 0,  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
    exit:   { opacity: 0,        transition: { duration: 0.1 } },
  } as Variants,
}

// ═══════════════════════════════════════════════════════════════════════════
// Micro-interactions
// ═══════════════════════════════════════════════════════════════════════════

/** Button / card tap feedback */
export const tapSpring = {
  whileTap:  { scale: 0.96, transition: springSnappy },
  whileHover:{ scale: 1.01, transition: springSnappy },
}

/** Icon-only button tap */
export const tapBounce = {
  whileTap:  { scale: 0.90, transition: { ...springSnappy, stiffness: 600 } },
  whileHover:{ scale: 1.05, transition: springSnappy },
}

/** Notification badge entrance */
export const badgePop: Variants = {
  hidden: { scale: 0, opacity: 0 },
  show: {
    scale: 1, opacity: 1,
    transition: { type: 'spring', stiffness: 600, damping: 20 },
  },
  exit: {
    scale: 0, opacity: 0,
    transition: { duration: 0.12 },
  },
}

/** Pulsing status dot */
export const pulseDot = {
  animate: {
    scale:   [1, 1.3, 1],
    opacity: [1, 0.7, 1],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
}

/** Shake — form validation error */
export const shake: Variants = {
  hidden: { x: 0 },
  show:   {
    x: [0, -8, 8, -6, 6, -3, 3, 0],
    transition: { duration: 0.45, ease: 'easeInOut' },
  },
}

/** Number counter roll */
export const numberRoll: Variants = {
  hidden: { y: 16, opacity: 0 },
  show:   { y: 0,  opacity: 1, transition: easeSmoothOut },
  exit:   { y: -16, opacity: 0, transition: easeFastOut },
}

// ═══════════════════════════════════════════════════════════════════════════
// Layout Animations
// ═══════════════════════════════════════════════════════════════════════════

/** Smooth layout transition for reordering items */
export const layoutTransition: Transition = {
  type: 'spring', stiffness: 400, damping: 30,
}

/** Shared element transition config */
export const sharedElement: Transition = {
  type: 'spring', stiffness: 350, damping: 30, mass: 1,
}
