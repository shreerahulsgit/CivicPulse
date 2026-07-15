/**
 * src/components/ui/Card.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Surface card system — default, elevated, flat, interactive.
 * Framer Motion hover/tap for interactive cards.
 *
 * Exports:
 *   Card            — base container
 *   CardHeader      — top section with optional title + right slot
 *   CardBody        — main content area
 *   CardFooter      — bottom section
 *   CardTitle       — heading inside header
 *   CardDescription — secondary text
 *   InteractiveCard — pressable card with motion feedback
 *   StatCard        — metric display card (dashboard KPIs)
 */

import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── CVA ───────────────────────────────────────────────────────────────────────

const cardVariants = cva(
  'bg-surface rounded-[var(--radius-card)] overflow-hidden',
  {
    variants: {
      variant: {
        default:     'border border-border shadow-[var(--shadow-card)]',
        elevated:    'border border-border shadow-[var(--shadow-md)]',
        flat:        'border border-border',
        ghost:       '',
        sunken:      'bg-surface-sunken border border-border-subtle',
        outline:     'border-2 border-border',
      },
      padding: {
        none:   '',
        sm:     'p-3',
        md:     'p-4',
        lg:     'p-5',
        xl:     'p-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'none',
    },
  }
)

type CardProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  )
)
Card.displayName = 'Card'

// ── Card sections ─────────────────────────────────────────────────────────────

interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?:      React.ReactNode
  description?:React.ReactNode
  right?:      React.ReactNode
}

export function CardHeader({ title, description, right, className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn('px-4 pt-4 pb-0', className)} {...props}>
      {(title || right || description) ? (
        <div>
          <div className="flex items-start justify-between gap-3">
            {title && (
              <div className="flex-1 min-w-0">
                {typeof title === 'string' ? (
                  <h3 className="text-[15px] font-semibold text-text-primary tracking-tight truncate">
                    {title}
                  </h3>
                ) : title}
                {description && (
                  <p className="text-xs text-text-muted mt-0.5">{description}</p>
                )}
              </div>
            )}
            {right && <div className="shrink-0">{right}</div>}
          </div>
        </div>
      ) : children}
    </div>
  )
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-4 pb-4 pt-0 flex items-center gap-2 border-t border-border-subtle',
        className,
      )}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-[15px] font-semibold text-text-primary tracking-tight', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs text-text-muted leading-relaxed', className)} {...props} />
  )
}

// ── Interactive Card ──────────────────────────────────────────────────────────

type InteractiveCardProps = HTMLMotionProps<'div'> &
  VariantProps<typeof cardVariants> & {
    pressable?: boolean
  }

export const InteractiveCard = forwardRef<HTMLDivElement, InteractiveCardProps>(
  ({ className, variant = 'default', padding, pressable = true, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn(
        cardVariants({ variant, padding }),
        'cursor-pointer tap-highlight',
        'hover:shadow-[var(--shadow-card-hover)] hover:border-border-strong',
        'transition-shadow duration-200',
        className,
      )}
      whileHover={pressable ? { y: -1 } : undefined}
      whileTap={pressable ? { scale: 0.985, y: 0 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      {...props}
    />
  )
)
InteractiveCard.displayName = 'InteractiveCard'

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:       string
  value:       string | number
  icon?:       React.ReactNode
  delta?:      string          // e.g. "+12%" change
  deltaUp?:    boolean         // true = green, false = red
  accent?:     string          // Tailwind color class for icon bg
  className?:  string
  onClick?:    () => void
}

export function StatCard({
  label, value, icon, delta, deltaUp, accent = 'bg-surface-sunken',
  className, onClick,
}: StatCardProps) {
  return (
    <motion.div
      className={cn(
        'bg-surface rounded-[var(--radius-card)] border border-border',
        'shadow-[var(--shadow-card)] p-4 flex flex-col gap-3',
        onClick && 'cursor-pointer',
        className,
      )}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        {icon && (
          <div className={cn('w-9 h-9 rounded-[10px] flex items-center justify-center', accent)}>
            {icon}
          </div>
        )}
        {delta && (
          <span
            className={cn(
              'text-[11px] font-semibold rounded-full px-2 py-0.5',
              deltaUp
                ? 'bg-success-muted text-success'
                : 'bg-danger-muted text-danger',
            )}
          >
            {delta}
          </span>
        )}
      </div>
      <div>
        <motion.p
          className="text-[28px] font-bold text-text-primary tracking-tight leading-none"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {value}
        </motion.p>
        <p className="text-xs text-text-muted mt-1">{label}</p>
      </div>
    </motion.div>
  )
}
