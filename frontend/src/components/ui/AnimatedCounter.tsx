/**
 * src/components/ui/AnimatedCounter.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated number counter using Framer Motion's useMotionValue + useTransform.
 * Counts from 0 → target on mount, with a configurable spring / duration.
 *
 * Usage:
 *   <AnimatedCounter value={142} duration={1.2} />
 */

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AnimatedCounterProps {
  value:      number
  duration?:  number     // seconds (default 1.0)
  prefix?:    string
  suffix?:    string
  className?: string
  decimals?:  number
}

export function AnimatedCounter({
  value, duration = 1.0, prefix, suffix, className, decimals = 0,
}: AnimatedCounterProps) {
  const count   = useMotionValue(0)
  const rounded = useTransform(count, v =>
    decimals > 0
      ? v.toFixed(decimals)
      : String(Math.round(v))
  )
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    const controls = animate(count, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    })
    const unsub = rounded.on('change', v => setDisplay(v))
    return () => {
      controls.stop()
      unsub()
    }
  }, [value, duration])

  return (
    <motion.span
      className={cn('tabular-nums', className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {prefix}{display}{suffix}
    </motion.span>
  )
}
