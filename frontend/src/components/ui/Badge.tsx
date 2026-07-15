/**
 * src/components/ui/Badge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Badge + StatusBadge + Chip + DotBadge
 *
 * Exports:
 *   Badge          — generic label pill
 *   StatusBadge    — complaint lifecycle badge with animated dot
 *   Chip           — interactive filter chip (selectable)
 *   DotBadge       — pulsing notification dot
 *   CountBadge     — numeric count overlay (for nav icons)
 */

import { motion, AnimatePresence } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { badgePop } from '@/lib/motion'

// ── Badge ─────────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-[var(--radius-badge)] font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:  'bg-primary/10 text-primary',
        primary:  'bg-primary text-white',
        success:  'bg-success-muted text-green-700',
        warning:  'bg-warning-muted text-amber-700',
        danger:   'bg-danger-muted text-red-700',
        info:     'bg-info-muted text-blue-700',
        indigo:   'bg-[#F3F4F6] text-gray-700',
        muted:    'bg-surface-sunken text-text-muted border border-border',
        outline:  'border border-current bg-transparent',
        white:    'bg-white text-primary shadow-sm',
      },
      size: {
        sm: 'px-2    py-0.5  text-[10px] leading-4',
        md: 'px-2.5  py-0.5  text-[11px] leading-4',
        lg: 'px-3    py-1    text-xs',
      },
      pill: {
        true:  'rounded-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'md',
      pill:    false,
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?:      boolean
  dotClass?: string
}

export function Badge({
  className, variant, size, pill,
  dot, dotClass,
  children, ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size, pill }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            variant === 'success'  && 'bg-green-500',
            variant === 'warning'  && 'bg-amber-500',
            variant === 'danger'   && 'bg-red-500',
            variant === 'info'     && 'bg-blue-500',
            variant === 'indigo'   && 'bg-[#111827]',
            variant === 'default' || variant === 'primary' ? 'bg-primary' : '',
            dotClass,
          )}
        />
      )}
      {children}
    </span>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  submitted:            { label: 'Submitted',           bg: '#EEF2FF', color: '#111827', dot: '#111827' },
  under_review:         { label: 'Under Review',        bg: '#FEF3C7', color: '#D97706', dot: '#F59E0B' },
  in_progress:          { label: 'In Progress',         bg: '#DBEAFE', color: '#2563EB', dot: '#3B82F6' },
  pending_verification: { label: 'Awaiting Verification', bg: '#FEF9C3', color: '#CA8A04', dot: '#EAB308' },
  resolved:             { label: 'Resolved',            bg: '#DCFCE7', color: '#16A34A', dot: '#22C55E' },
  rejected:             { label: 'Rejected',            bg: '#FEE2E2', color: '#DC2626', dot: '#EF4444' },
} as const

type ComplaintStatus = keyof typeof STATUS_CONFIG

interface StatusBadgeProps {
  status:     ComplaintStatus | string
  showDot?:   boolean
  pulse?:     boolean
  size?:      'sm' | 'md' | 'lg'
  className?: string
}

export function StatusBadge({
  status, showDot = true, pulse = false, size = 'md', className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as ComplaintStatus] ?? {
    label: status, bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF',
  }

  const sizeClass = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-0.5 text-[11px] gap-1.5',
    lg: 'px-3 py-1 text-xs gap-2',
  }[size]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold leading-4',
        sizeClass, className,
      )}
      style={{ background: config.bg, color: config.color }}
    >
      {showDot && (
        <span className="relative flex shrink-0">
          {pulse && (
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full opacity-60"
              style={{ background: config.dot }}
              animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <span
            className="relative rounded-full"
            style={{
              background: config.dot,
              width:  size === 'sm' ? '5px' : '6px',
              height: size === 'sm' ? '5px' : '6px',
            }}
          />
        </span>
      )}
      {config.label}
    </span>
  )
}

// ── Chip (selectable filter) ──────────────────────────────────────────────────

interface ChipProps {
  label:      string
  selected?:  boolean
  onClick?:   () => void
  icon?:      React.ReactNode
  className?: string
  disabled?:  boolean
}

export function Chip({ label, selected, onClick, icon, className, disabled }: ChipProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-sm font-medium',
        'border transition-all duration-150 cursor-pointer select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        selected
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-surface text-text-secondary border-border hover:border-border-strong hover:text-text-primary',
        className,
      )}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {label}
    </motion.button>
  )
}

// ── Dot Badge (notification indicator) ───────────────────────────────────────

interface DotBadgeProps {
  visible?:   boolean
  pulse?:     boolean
  className?: string
  color?:     string
}

export function DotBadge({
  visible = true, pulse = true, className, color = '#EF4444',
}: DotBadgeProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          variants={badgePop}
          initial="hidden"
          animate="show"
          exit="exit"
          className={cn('relative flex w-2.5 h-2.5', className)}
        >
          {pulse && (
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full opacity-60"
              style={{ background: color }}
              animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <span
            className="relative inline-flex rounded-full w-2.5 h-2.5"
            style={{ background: color }}
          />
        </motion.span>
      )}
    </AnimatePresence>
  )
}

// ── Count Badge (nav icon overlay) ───────────────────────────────────────────

interface CountBadgeProps {
  count:      number
  max?:       number
  className?: string
}

export function CountBadge({ count, max = 99, className }: CountBadgeProps) {
  const display = count > max ? `${max}+` : String(count)

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key={count}
          variants={badgePop}
          initial="hidden"
          animate="show"
          exit="exit"
          className={cn(
            'absolute -top-1 -right-1 z-10',
            'min-w-[18px] h-[18px] px-1',
            'bg-danger text-white text-[10px] font-bold',
            'rounded-full flex items-center justify-center',
            'border-2 border-white',
            className,
          )}
        >
          {display}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
