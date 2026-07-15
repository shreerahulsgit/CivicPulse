/**
 * src/components/ui/Divider.tsx
 * Simple horizontal / vertical divider
 */
import { cn } from '@/lib/utils'

interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  inset?:       boolean
  label?:       string
  className?:   string
}

export function Divider({
  orientation = 'horizontal', inset, label, className,
}: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <span className={cn('inline-block w-px self-stretch bg-border', className)} />
    )
  }

  if (label) {
    return (
      <div className={cn('flex items-center gap-3 my-2', inset && 'ml-4', className)}>
        <span className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted font-medium">{label}</span>
        <span className="flex-1 h-px bg-border" />
      </div>
    )
  }

  return (
    <hr
      className={cn(
        'border-none h-px bg-border',
        inset && 'ml-4',
        className,
      )}
    />
  )
}
