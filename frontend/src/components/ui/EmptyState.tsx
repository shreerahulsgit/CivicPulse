/**
 * src/components/ui/EmptyState.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Empty + Error state placeholders with Framer Motion entrance
 */

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle, WifiOff, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fadeUp, stagger } from '@/lib/motion'
import { Button } from './Button'

interface EmptyStateProps {
  Icon?:        LucideIcon
  illustration?:React.ReactNode
  title:        string
  description?: string
  action?:      React.ReactNode
  size?:        'sm' | 'md' | 'lg'
  className?:   string
}

export function EmptyState({
  Icon, illustration, title, description, action, size = 'md', className,
}: EmptyStateProps) {
  const iconSize  = { sm: 20, md: 28, lg: 36 }[size]
  const iconWrap  = { sm: 'w-12 h-12', md: 'w-16 h-16', lg: 'w-20 h-20' }[size]
  const titleSize = { sm: 'text-sm',   md: 'text-base',  lg: 'text-lg'  }[size]
  const descSize  = { sm: 'text-xs',   md: 'text-sm',    lg: 'text-sm'  }[size]
  const py        = { sm: 'py-8',      md: 'py-12',      lg: 'py-16'    }[size]

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="show"
      className={cn(
        'flex flex-col items-center justify-center text-center px-6',
        py, className,
      )}
    >
      {/* Icon / illustration */}
      {(Icon || illustration) && (
        <motion.div variants={fadeUp}>
          {illustration ?? (
            Icon ? (
            <div
              className={cn(
                'rounded-2xl flex items-center justify-center mb-4',
                'bg-surface-sunken border border-border',
                iconWrap,
              )}
            >
              <Icon size={iconSize} className="text-text-tertiary" strokeWidth={1.5} />
            </div>
            ) : null
          )}
        </motion.div>
      )}

      {/* Text */}
      <motion.div variants={fadeUp} className="space-y-1.5 mb-5">
        <h3 className={cn('font-semibold text-text-primary', titleSize)}>{title}</h3>
        {description && (
          <p className={cn('text-text-muted max-w-[260px] mx-auto leading-relaxed', descSize)}>
            {description}
          </p>
        )}
      </motion.div>

      {/* Action */}
      {action && (
        <motion.div variants={fadeUp}>{action}</motion.div>
      )}
    </motion.div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

interface ErrorStateProps {
  title?:      string
  description?:string
  onRetry?:    () => void
  isOffline?:  boolean
  className?:  string
}

export function ErrorState({
  title, description, onRetry, isOffline, className,
}: ErrorStateProps) {
  const Icon = isOffline ? WifiOff : AlertCircle

  return (
    <EmptyState
      Icon={Icon}
      title={title ?? (isOffline ? 'No connection' : 'Something went wrong')}
      description={
        description ??
        (isOffline
          ? 'Check your internet connection and try again.'
          : 'We ran into an unexpected error. Please try again.')
      }
      action={
        onRetry && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            leftIcon={<RefreshCcw size={14} />}
          >
            Try again
          </Button>
        )
      }
      className={className}
    />
  )
}
