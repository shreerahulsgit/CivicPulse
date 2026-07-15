/**
 * src/components/ui/Spinner.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Spinner variants — inline, page-level, overlay
 */

import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?:      'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?:     'primary' | 'white' | 'success' | 'danger' | 'muted'
  className?: string
}

const SIZES = {
  xs: 'w-3.5 h-3.5 border-[1.5px]',
  sm: 'w-4   h-4   border-2',
  md: 'w-5   h-5   border-2',
  lg: 'w-8   h-8   border-[3px]',
  xl: 'w-12  h-12  border-4',
}

const COLORS = {
  primary: 'border-primary/20 border-t-primary',
  white:   'border-white/30  border-t-white',
  success: 'border-success/20 border-t-success',
  danger:  'border-danger/20 border-t-danger',
  muted:   'border-border border-t-text-muted',
}

export function Spinner({ size = 'md', color = 'primary', className }: SpinnerProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full animate-spin',
        SIZES[size],
        COLORS[color],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  )
}

export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[40dvh] gap-4"
      role="status"
      aria-label={label}
    >
      <Spinner size="xl" />
      {label && (
        <p className="text-sm text-text-muted animate-pulse">{label}</p>
      )}
    </div>
  )
}

export function OverlaySpinner({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="xl" />
        {label && <p className="text-sm text-text-secondary font-medium">{label}</p>}
      </div>
    </div>
  )
}
