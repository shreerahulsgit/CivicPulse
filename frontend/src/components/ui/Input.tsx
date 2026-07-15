/**
 * src/components/ui/Input.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Polished Input + Textarea + Select
 *
 * Features:
 *   - Animated label (float-on-focus)
 *   - Leading / trailing icon slots
 *   - Error + hint text
 *   - Password toggle
 *   - Character counter (textarea)
 *   - Framer Motion shake on error
 */

import {
  forwardRef, useState, useId,
  type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Base wrapper ──────────────────────────────────────────────────────────────

interface FieldWrapperProps {
  label?:    string
  required?: boolean
  error?:    string
  hint?:     string
  success?:  string
  id:        string
  children:  React.ReactNode
  className?: string
}

function FieldWrapper({ label, required, error, hint, success, id, children, className }: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium transition-colors duration-150',
            error ? 'text-danger' : 'text-text-primary',
          )}
        >
          {label}
          {required && <span className="text-danger ml-0.5" aria-hidden>*</span>}
        </label>
      )}

      {children}

      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0,  height: 'auto' }}
            exit={{   opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5 text-xs text-danger"
            role="alert"
            id={`${id}-error`}
          >
            <AlertCircle size={12} className="shrink-0" />
            {error}
          </motion.p>
        ) : success ? (
          <motion.p
            key="success"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0,  height: 'auto' }}
            exit={{   opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5 text-xs text-success"
          >
            <CheckCircle2 size={12} className="shrink-0" />
            {success}
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-text-muted"
            id={`${id}-hint`}
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

// ── Shared input classes ──────────────────────────────────────────────────────

const inputBase = [
  'w-full bg-surface text-text-primary placeholder:text-text-tertiary',
  'border border-border rounded-[var(--radius-input)]',
  'transition-all duration-150',
  'outline-none',
  'focus:border-primary focus:ring-2 focus:ring-primary/12 focus:bg-surface',
  'hover:border-border-strong',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-sunken',
  'read-only:bg-surface-sunken read-only:border-border-subtle',
].join(' ')

const inputError = 'border-danger focus:border-danger focus:ring-danger/15 bg-danger-faded'
const inputSuccess = 'border-success focus:border-success focus:ring-success/15'

// ── Input ─────────────────────────────────────────────────────────────────────

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:       string
  error?:       string
  hint?:        string
  success?:     string
  leadingIcon?: React.ReactNode
  trailingIcon?:React.ReactNode
  wrapperClass?:string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label, error, hint, success,
      leadingIcon, trailingIcon,
      type = 'text', id, className, wrapperClass,
      required, ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false)
    const generatedId = useId()
    const inputId = id ?? generatedId
    const isPassword = type === 'password'
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

    return (
      <FieldWrapper
        label={label} required={required}
        error={error} hint={hint} success={success}
        id={inputId} className={wrapperClass}
      >
        <div className="relative flex items-center">
          {/* Leading icon */}
          {leadingIcon && (
            <span className="absolute left-3.5 flex items-center text-text-tertiary pointer-events-none">
              {leadingIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={inputType}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            className={cn(
              inputBase,
              'h-12 text-[15px]',
              leadingIcon   ? 'pl-10' : 'pl-4',
              trailingIcon || isPassword ? 'pr-10' : 'pr-4',
              error   && inputError,
              success && !error && inputSuccess,
              className,
            )}
            {...props}
          />

          {/* Password toggle */}
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3.5 flex items-center text-text-tertiary hover:text-text-secondary transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword
                ? <EyeOff size={17} />
                : <Eye size={17} />}
            </button>
          )}

          {/* Trailing icon (not shown for password) */}
          {!isPassword && trailingIcon && (
            <span className="absolute right-3.5 flex items-center text-text-tertiary pointer-events-none">
              {trailingIcon}
            </span>
          )}
        </div>
      </FieldWrapper>
    )
  },
)
Input.displayName = 'Input'

// ── Textarea ──────────────────────────────────────────────────────────────────

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:       string
  error?:       string
  hint?:        string
  success?:     string
  maxLength?:   number
  showCount?:   boolean
  wrapperClass?:string
  rows?:        number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label, error, hint, success,
      maxLength, showCount = false,
      id, className, wrapperClass,
      required, rows = 4,
      value, onChange, ...props
    },
    ref,
  ) => {
    const [count, setCount] = useState(
      typeof value === 'string' ? value.length : 0
    )
    const generatedId = useId()
    const inputId = id ?? generatedId

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCount(e.target.value.length)
      onChange?.(e)
    }

    return (
      <FieldWrapper
        label={label} required={required}
        error={error} hint={hint} success={success}
        id={inputId} className={wrapperClass}
      >
        <div className="relative">
          <textarea
            ref={ref}
            id={inputId}
            rows={rows}
            maxLength={maxLength}
            value={value}
            onChange={handleChange}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            className={cn(
              inputBase,
              'py-3 px-4 text-[15px] resize-none leading-relaxed',
              showCount && 'pb-7',
              error   && inputError,
              success && !error && inputSuccess,
              className,
            )}
            {...props}
          />

          {/* Character counter */}
          {showCount && (
            <span
              className={cn(
                'absolute bottom-2.5 right-3 text-[11px] tabular-nums',
                maxLength && count >= maxLength * 0.9
                  ? 'text-warning'
                  : 'text-text-tertiary',
              )}
            >
              {count}{maxLength ? `/${maxLength}` : ''}
            </span>
          )}
        </div>
      </FieldWrapper>
    )
  },
)
Textarea.displayName = 'Textarea'

// ── Select ────────────────────────────────────────────────────────────────────

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?:       string
  error?:       string
  hint?:        string
  placeholder?: string
  options:      { value: string | number; label: string; disabled?: boolean }[]
  wrapperClass?:string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label, error, hint, placeholder,
      options, id, className, wrapperClass,
      required, ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const inputId = id ?? generatedId

    return (
      <FieldWrapper
        label={label} required={required}
        error={error} hint={hint}
        id={inputId} className={wrapperClass}
      >
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={Boolean(error)}
            className={cn(
              inputBase,
              'h-12 pl-4 pr-10 text-[15px] appearance-none cursor-pointer',
              error && inputError,
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled hidden>{placeholder}</option>
            )}
            {options.map(opt => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Chevron */}
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
      </FieldWrapper>
    )
  },
)
Select.displayName = 'Select'
