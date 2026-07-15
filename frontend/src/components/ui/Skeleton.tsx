/**
 * src/components/ui/Skeleton.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shimmer skeleton loaders for every common content shape.
 *
 * Exports:
 *   Skeleton        — raw shimmer block (base primitive)
 *   SkeletonText    — multi-line text block
 *   SkeletonCard    — full complaint card skeleton
 *   SkeletonStat    — dashboard stat card skeleton
 *   SkeletonAvatar  — avatar + name row
 *   SkeletonList    — vertically stacked list of card skeletons
 */

import { cn } from '@/lib/utils'

// ── Base ──────────────────────────────────────────────────────────────────────

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?:  string | number
  height?: string | number
  circle?: boolean
  rounded?: boolean
}

export function Skeleton({
  className, width, height, circle, rounded, style, ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton',
        circle  && 'rounded-full',
        rounded && 'rounded-xl',
        !circle && !rounded && 'rounded-lg',
        className,
      )}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...props}
    />
  )
}

// ── Text block ────────────────────────────────────────────────────────────────

interface SkeletonTextProps {
  lines?:     number
  lastShort?: boolean
  className?: string
}

export function SkeletonText({ lines = 3, lastShort = true, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={13}
          className={cn(
            'block',
            lastShort && i === lines - 1 && 'w-3/5',
          )}
        />
      ))}
    </div>
  )
}

// ── Complaint card skeleton ───────────────────────────────────────────────────

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-white border border-border rounded-[var(--radius-card)] p-4 space-y-3',
        className,
      )}
      aria-hidden
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <Skeleton width={80} height={20} rounded />
        <Skeleton width={64} height={20} rounded />
      </div>

      {/* Title */}
      <Skeleton height={18} className="w-4/5" />

      {/* Description */}
      <SkeletonText lines={2} />

      {/* Footer row */}
      <div className="flex items-center gap-2 pt-1">
        <Skeleton width={20} height={20} circle />
        <Skeleton width={100} height={12} />
        <Skeleton width={60} height={12} className="ml-auto" />
      </div>
    </div>
  )
}

// ── Stat card skeleton ────────────────────────────────────────────────────────

export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-white border border-border rounded-[var(--radius-card)] p-4 space-y-3',
        className,
      )}
      aria-hidden
    >
      <Skeleton width={36} height={36} rounded />
      <Skeleton width={64} height={32} className="rounded-lg" />
      <Skeleton width={80} height={12} />
    </div>
  )
}

// ── Avatar + name skeleton ────────────────────────────────────────────────────

export function SkeletonAvatar({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)} aria-hidden>
      <Skeleton width={40} height={40} circle />
      <div className="space-y-1.5 flex-1">
        <Skeleton height={14} className="w-1/3" />
        <Skeleton height={12} className="w-1/2" />
      </div>
    </div>
  )
}

// ── List of card skeletons ────────────────────────────────────────────────────

interface SkeletonListProps {
  count?:     number
  className?: string
}

export function SkeletonList({ count = 3, className }: SkeletonListProps) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Loading...">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
