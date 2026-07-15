/**
 * src/components/ui/Toast.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight toast notification system
 *
 * Usage:
 *   import { useToast } from '@/components/ui/Toast'
 *   const { toast } = useToast()
 *   toast.success('Complaint submitted!')
 *   toast.error('Failed to upload')
 *
 * Mount <ToastContainer /> once in App.tsx (or layout root).
 */

import {
  createContext, useContext, useState, useCallback, useRef,
  type ReactNode,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id:        string
  type:      ToastType
  title:     string
  message?:  string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  add:    (toast: Omit<Toast, 'id'>) => void
  remove: (id: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const add = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = String(++counter.current)
    setToasts(prev => [...prev, { ...toast, id }])
    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
  }, [])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, add, remove }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>')

  const { add } = ctx

  return {
    toast: {
      success: (title: string, message?: string) =>
        add({ type: 'success', title, message }),
      error: (title: string, message?: string) =>
        add({ type: 'error', title, message }),
      warning: (title: string, message?: string) =>
        add({ type: 'warning', title, message }),
      info: (title: string, message?: string) =>
        add({ type: 'info', title, message }),
      custom: (toast: Omit<Toast, 'id'>) => add(toast),
    },
  }
}

// ── Toast config ──────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, {
  Icon:       typeof CheckCircle2
  iconColor:  string
  bg:         string
  border:     string
}> = {
  success: {
    Icon:      CheckCircle2,
    iconColor: 'text-success',
    bg:        'bg-white',
    border:    'border-success/20',
  },
  error: {
    Icon:      XCircle,
    iconColor: 'text-danger',
    bg:        'bg-white',
    border:    'border-danger/20',
  },
  warning: {
    Icon:      AlertTriangle,
    iconColor: 'text-warning',
    bg:        'bg-white',
    border:    'border-warning/20',
  },
  info: {
    Icon:      Info,
    iconColor: 'text-info',
    bg:        'bg-white',
    border:    'border-info/20',
  },
}

// ── Single toast ──────────────────────────────────────────────────────────────

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const config = TOAST_CONFIG[toast.type]
  const { Icon } = config

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,   scale: 1 }}
      exit={{   opacity: 0, y: -8,  scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      className={cn(
        'flex items-start gap-3 px-4 py-3.5 rounded-2xl',
        'border shadow-[var(--shadow-float)]',
        'max-w-[340px] w-full pointer-events-auto',
        config.bg, config.border,
      )}
      role="alert"
      aria-live="assertive"
    >
      <Icon size={18} className={cn('shrink-0 mt-0.5', config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 p-0.5 rounded-lg text-text-tertiary hover:text-text-secondary transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </motion.div>
  )
}

// ── Container ─────────────────────────────────────────────────────────────────

function ToastContainer() {
  const ctx = useContext(ToastContext)
  if (!ctx) return null
  const { toasts, remove } = ctx

  return (
    <div
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 z-[9999]',
        'flex flex-col items-center gap-2',
        'pointer-events-none px-4',
        'w-full max-w-sm',
      )}
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={() => remove(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}
