/**
 * src/components/ui/Avatar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Avatar — initials fallback, image, online dot, size variants
 *
 * Exports:
 *   Avatar        — single avatar
 *   AvatarGroup   — stacked avatar list
 */

import { useState } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ── CVA ───────────────────────────────────────────────────────────────────────

const avatarVariants = cva(
  'relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden select-none',
  {
    variants: {
      size: {
        xs:  'w-6  h-6  text-[9px]',
        sm:  'w-8  h-8  text-[11px]',
        md:  'w-10 h-10 text-sm',
        lg:  'w-12 h-12 text-base',
        xl:  'w-16 h-16 text-lg',
        '2xl':'w-20 h-20 text-xl',
      },
    },
    defaultVariants: { size: 'md' },
  }
)

// ── Color palette for initials (stable per name) ──────────────────────────────

const AVATAR_COLORS = [
  ['#F9FAFB', '#111827'],  // teal
  ['#DCFCE7', '#16A34A'],  // green
  ['#DBEAFE', '#2563EB'],  // blue
  ['#FEF3C7', '#D97706'],  // amber
  ['#FEE2E2', '#DC2626'],  // red
  ['#F0FDF4', '#15803D'],  // emerald
  ['#EFF6FF', '#1D4ED8'],  // blue dark
  ['#FDF4FF', '#A21CAF'],  // purple
]

function getAvatarColor(name: string): [string, string] {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] as [string, string]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Avatar ────────────────────────────────────────────────────────────────────

interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name:       string
  src?:       string | null
  online?:    boolean
  className?: string
  ring?:      boolean
}

export function Avatar({ name, src, online, size, className, ring }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const [bg, text] = getAvatarColor(name)
  const initials = getInitials(name)

  const dotSize = {
    xs: 'w-1.5 h-1.5 border',
    sm: 'w-2 h-2 border',
    md: 'w-2.5 h-2.5 border-2',
    lg: 'w-3 h-3 border-2',
    xl: 'w-3.5 h-3.5 border-2',
    '2xl': 'w-4 h-4 border-2',
  }[size ?? 'md']

  return (
    <span className={cn(
      avatarVariants({ size }),
      ring && 'ring-2 ring-white ring-offset-1',
      className,
    )}>
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="w-full h-full flex items-center justify-center font-bold"
          style={{ background: bg, color: text }}
        >
          {initials}
        </span>
      )}

      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-white bg-success',
            dotSize,
            !online && 'bg-text-tertiary',
          )}
        />
      )}
    </span>
  )
}

// ── Avatar Group ──────────────────────────────────────────────────────────────

interface AvatarGroupProps {
  users:      { name: string; src?: string | null }[]
  max?:       number
  size?:      'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export function AvatarGroup({ users, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const visible = users.slice(0, max)
  const overflow = users.length - max

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((u, i) => (
        <span
          key={i}
          className="ring-2 ring-white rounded-full"
          style={{ marginLeft: i > 0 ? '-8px' : '0' }}
        >
          <Avatar name={u.name} src={u.src} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            avatarVariants({ size }),
            '-ml-2 ring-2 ring-white bg-surface-sunken text-text-muted font-semibold',
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
