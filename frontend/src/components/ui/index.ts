/**
 * src/components/ui/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Barrel export — import any UI component from '@/components/ui'
 *
 * Usage:
 *   import { Button, Card, Input, StatusBadge, Avatar } from '@/components/ui'
 */

// Button
export { Button, IconButton }                from './Button'

// Card
export {
  Card, CardHeader, CardBody, CardFooter,
  CardTitle, CardDescription,
  InteractiveCard, StatCard,
}                                             from './Card'

// Input
export { Input, Textarea, Select }           from './Input'

// Badge
export {
  Badge, StatusBadge, Chip,
  DotBadge, CountBadge,
}                                             from './Badge'

// Avatar
export { Avatar, AvatarGroup }               from './Avatar'

// Skeleton
export {
  Skeleton, SkeletonText, SkeletonCard,
  SkeletonStat, SkeletonAvatar, SkeletonList,
}                                             from './Skeleton'

// Spinner
export { Spinner, PageSpinner, OverlaySpinner } from './Spinner'

// Empty / Error states
export { EmptyState, ErrorState }            from './EmptyState'

// Toast
export { ToastProvider, useToast }           from './Toast'

// Divider
export { Divider }                           from './Divider'
