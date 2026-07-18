/**
 * src/styles/design-system.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CivicPulse Design System — Single source of truth for all design decisions.
 *
 * Aesthetic: Uber precision × CRED premium × Google Maps clarity
 * Target:    390 px (iPhone 14 Pro) — mobile-first
 *
 * Consume in TS/TSX:  import { colors, typography, ... } from '@/styles/design-system'
 * CSS tokens live in: src/index.css  (@theme block)
 */

// ── Colors ───────────────────────────────────────────────────────────────────

export const colors = {
  // Brand
  primary:       '#111827',
  primaryLight:  '#1F2937',
  primaryMuted:  '#374151',
  primaryFaded:  '#6B7280',

  // Semantic
  success:       '#22C55E',
  successLight:  '#86EFAC',
  successMuted:  '#DCFCE7',
  successFaded:  '#F0FDF4',

  warning:       '#F59E0B',
  warningLight:  '#FCD34D',
  warningMuted:  '#FEF3C7',
  warningFaded:  '#FFFBEB',

  danger:        '#EF4444',
  dangerLight:   '#FCA5A5',
  dangerMuted:   '#FEE2E2',
  dangerFaded:   '#FFF5F5',

  info:          '#3B82F6',
  infoLight:     '#93C5FD',
  infoMuted:     '#DBEAFE',
  infoFaded:     '#EFF6FF',

  indigo:        '#111827',
  tealLight:    '#6B7280',
  tealMuted:    '#F3F4F6',

  // Surfaces
  background:    '#F9FAFB',
  surface:       '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#F3F4F6',

  // Borders
  border:        '#E5E7EB',
  borderStrong:  '#D1D5DB',
  borderSubtle:  '#F3F4F6',

  // Text
  textPrimary:   '#111827',
  textSecondary: '#374151',
  textTertiary:  '#9CA3AF',
  textDisabled:  '#D1D5DB',
  textInverse:   '#FFFFFF',
  textMuted:     '#6B7280',

  // Complaint status (Google Maps pin palette)
  status: {
    submitted:   { bg: '#EEF2FF', text: '#111827', dot: '#111827' },
    underReview: { bg: '#FEF3C7', text: '#D97706', dot: '#F59E0B' },
    inProgress:  { bg: '#DBEAFE', text: '#2563EB', dot: '#3B82F6' },
    resolved:    { bg: '#DCFCE7', text: '#16A34A', dot: '#22C55E' },
    rejected:    { bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444' },
  },
} as const

// ── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    sans: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
  },

  // px values (converted to rem in CSS)
  fontSize: {
    '2xs':  10,
    xs:     12,
    sm:     13,
    base:   15,
    md:     16,
    lg:     18,
    xl:     20,
    '2xl':  24,
    '3xl':  28,
    '4xl':  32,
    '5xl':  40,
  },

  fontWeight: {
    regular:   400,
    medium:    500,
    semibold:  600,
    bold:      700,
    extrabold: 800,
  },

  lineHeight: {
    tight:   1.2,
    snug:    1.375,
    normal:  1.5,
    relaxed: 1.625,
  },

  letterSpacing: {
    tight:  '-0.025em',
    normal: '0em',
    wide:   '0.025em',
    wider:  '0.05em',
    widest: '0.1em',
  },
} as const

// ── Spacing ───────────────────────────────────────────────────────────────────

export const spacing = {
  px:    '1px',
  0:     '0px',
  0.5:   '2px',
  1:     '4px',
  1.5:   '6px',
  2:     '8px',
  2.5:   '10px',
  3:     '12px',
  3.5:   '14px',
  4:     '16px',
  5:     '20px',
  6:     '24px',
  7:     '28px',
  8:     '32px',
  9:     '36px',
  10:    '40px',
  12:    '48px',
  14:    '56px',
  16:    '64px',
  20:    '80px',
  24:    '96px',

  // Layout-specific
  pageX:        '16px',  // horizontal page padding
  pageTop:      '16px',  // page top padding
  bottomNavH:   '64px',  // bottom nav height
  topBarH:      '64px',  // top bar height
  safeBottom:   'env(safe-area-inset-bottom, 16px)',
} as const

// ── Border Radius ────────────────────────────────────────────────────────────

export const radius = {
  none:    '0px',
  sm:      '6px',
  md:      '10px',
  lg:      '14px',
  xl:      '18px',
  '2xl':   '24px',
  full:    '9999px',

  // Component-specific
  button:  '12px',
  card:    '16px',
  input:   '12px',
  badge:   '6px',
  pill:    '9999px',
  chip:    '8px',
} as const

// ── Shadows ───────────────────────────────────────────────────────────────────

export const shadows = {
  none:     'none',
  xs:       '0 1px 2px rgba(15,23,42,0.04)',
  sm:       '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
  md:       '0 4px 6px -1px rgba(15,23,42,0.08), 0 2px 4px -1px rgba(15,23,42,0.04)',
  lg:       '0 10px 15px -3px rgba(15,23,42,0.08), 0 4px 6px -2px rgba(15,23,42,0.04)',
  xl:       '0 20px 25px -5px rgba(15,23,42,0.10), 0 10px 10px -5px rgba(15,23,42,0.04)',
  '2xl':    '0 25px 50px -12px rgba(15,23,42,0.25)',
  inner:    'inset 0 2px 4px rgba(15,23,42,0.06)',
  glow:     '0 0 0 4px rgba(15,23,42,0.10)',
  glowSuccess: '0 0 0 4px rgba(34,197,94,0.15)',
  glowDanger:  '0 0 0 4px rgba(239,68,68,0.15)',
  card:     '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
  cardHover:'0 4px 12px rgba(15,23,42,0.10)',
  bottomNav:'0 -1px 0 #E5E7EB, 0 -4px 16px rgba(15,23,42,0.04)',
  float:    '0 8px 24px rgba(15,23,42,0.12)',
} as const

// ── Animation ─────────────────────────────────────────────────────────────────

export const animation = {
  duration: {
    instant:  75,
    fast:     150,
    base:     200,
    slow:     300,
    slower:   400,
    slowest:  600,
  },
  easing: {
    linear:    'linear',
    in:        'cubic-bezier(0.4, 0, 1, 1)',
    out:       'cubic-bezier(0, 0, 0.2, 1)',
    inOut:     'cubic-bezier(0.4, 0, 0.2, 1)',
    spring:    'cubic-bezier(0.25, 1, 0.5, 1)',    // snappy spring
    bounce:    'cubic-bezier(0.34, 1.56, 0.64, 1)', // slight overshoot
    smooth:    'cubic-bezier(0.16, 1, 0.3, 1)',     // CRED-style ease-out expo
  },
} as const

// ── Breakpoints ───────────────────────────────────────────────────────────────

export const breakpoints = {
  xs:  '390px',    // iPhone 14 Pro — primary target
  sm:  '640px',
  md:  '768px',
  lg:  '1024px',
  xl:  '1280px',
  '2xl': '1536px',
} as const

// ── Z-index ───────────────────────────────────────────────────────────────────

export const zIndex = {
  hide:    -1,
  base:     0,
  raised:   1,
  dropdown: 10,
  sticky:   20,
  overlay:  30,
  modal:    40,
  toast:    50,
  tooltip:  60,
} as const

// ── Component size presets ────────────────────────────────────────────────────

export const componentSizes = {
  button: {
    xs:   { height: '32px', px: '12px', text: '12px', icon: 14 },
    sm:   { height: '36px', px: '14px', text: '13px', icon: 15 },
    md:   { height: '44px', px: '18px', text: '15px', icon: 16 },
    lg:   { height: '52px', px: '22px', text: '17px', icon: 18 },
    xl:   { height: '60px', px: '28px', text: '18px', icon: 20 },
    icon: { height: '44px', width: '44px' },
  },
  input: {
    sm:   { height: '36px', px: '12px', text: '13px' },
    md:   { height: '48px', px: '16px', text: '15px' },
    lg:   { height: '56px', px: '18px', text: '16px' },
  },
} as const
