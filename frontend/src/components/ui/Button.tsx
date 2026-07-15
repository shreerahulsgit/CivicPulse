/**
 * src/components/ui/Button.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Production-grade button with CVA variants, Framer Motion tap feedback,
 * loading spinner, icon slots, and full accessibility.
 *
 * Variants:  primary | secondary | outline | ghost | danger | success | link
 * Sizes:     xs | sm | md | lg | xl | icon
 */

import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleNotch } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

// ── CVA definition ────────────────────────────────────────────────────────────

const buttonVariants = cva(
  // Base
  [
    'relative inline-flex items-center justify-center gap-2',
    'font-semibold select-none cursor-pointer',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
    'overflow-hidden',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-primary text-white',
          'hover:bg-primary-light',
          'active:bg-primary-muted',
          'focus-visible:ring-primary',
          'shadow-sm hover:shadow-md',
        ].join(' '),

        secondary: [
          'bg-surface-sunken text-text-primary border border-border',
          'hover:bg-border hover:border-border-strong',
          'active:bg-border-strong',
          'focus-visible:ring-primary',
        ].join(' '),

        outline: [
          'bg-transparent text-primary border-2 border-primary',
          'hover:bg-primary hover:text-white',
          'active:bg-primary-light active:text-white',
          'focus-visible:ring-primary',
        ].join(' '),

        ghost: [
          'bg-transparent text-text-secondary border border-transparent',
          'hover:bg-surface-sunken hover:text-text-primary',
          'active:bg-border',
          'focus-visible:ring-primary',
        ].join(' '),

        danger: [
          'bg-danger text-white',
          'hover:bg-red-600',
          'active:bg-red-700',
          'focus-visible:ring-danger',
          'shadow-sm hover:shadow-md',
        ].join(' '),

        success: [
          'bg-success text-white',
          'hover:bg-green-600',
          'active:bg-green-700',
          'focus-visible:ring-success',
          'shadow-sm hover:shadow-md',
        ].join(' '),

        warning: [
          'bg-warning text-white',
          'hover:bg-amber-500',
          'active:bg-amber-600',
          'focus-visible:ring-warning',
          'shadow-sm',
        ].join(' '),

        link: [
          'bg-transparent text-primary underline-offset-4',
          'hover:underline hover:text-primary-light',
          'active:text-primary-muted',
          'focus-visible:ring-primary',
          'p-0 h-auto shadow-none',
        ].join(' '),
      },

      size: {
        xs:   'h-8  px-3   text-xs  rounded-[8px]  gap-1.5',
        sm:   'h-9  px-4   text-sm  rounded-[10px] gap-1.5',
        md:   'h-11 px-5   text-sm  rounded-[12px] gap-2',
        lg:   'h-13 px-6   text-base rounded-[13px] gap-2',
        xl:   'h-15 px-8   text-lg  rounded-[14px] gap-2.5',
        icon: 'h-11 w-11   rounded-[12px] shrink-0',
        'icon-sm': 'h-9 w-9 rounded-[10px] shrink-0',
        'icon-xs': 'h-8 w-8 rounded-[8px]  shrink-0',
      },

      fullWidth: {
        true:  'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant:   'primary',
      size:      'md',
      fullWidth: false,
    },
  }
)

// ── Types ─────────────────────────────────────────────────────────────────────

type ButtonBaseProps = VariantProps<typeof buttonVariants> & {
  isLoading?:    boolean
  loadingText?:  string
  leftIcon?:     React.ReactNode
  rightIcon?:    React.ReactNode
  children?:     React.ReactNode
  className?:    string
  disabled?:     boolean
  onClick?:      React.MouseEventHandler<HTMLButtonElement>
  type?:         'button' | 'submit' | 'reset'
  'aria-label'?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonBaseProps>(
  (
    {
      variant, size, fullWidth,
      isLoading, loadingText,
      leftIcon, rightIcon,
      children, className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        whileTap={isDisabled ? undefined : { scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {/* Ripple layer — subtle, brand-aligned */}
        <span className="absolute inset-0 overflow-hidden rounded-inherit pointer-events-none">
          <span className="absolute inset-0 bg-white/0 hover:bg-white/5 transition-colors duration-200" />
        </span>

        {/* Left icon / loading spinner */}
        {isLoading ? (
          <CircleNotch size={16} className="animate-spin shrink-0" aria-hidden weight="bold" />

        ) : leftIcon ? (
          <span className="shrink-0 flex items-center">{leftIcon}</span>
        ) : null}

        {/* Label */}
        {children && (
          <span className="relative">
            {isLoading && loadingText ? loadingText : children}
          </span>
        )}

        {/* Right icon */}
        {!isLoading && rightIcon && (
          <span className="shrink-0 flex items-center">{rightIcon}</span>
        )}
      </motion.button>
    )
  },
)
Button.displayName = 'Button'

// ── Icon Button shorthand ─────────────────────────────────────────────────────

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonBaseProps & { 'aria-label': string }
>(({ size = 'icon', children, ...props }, ref) => (
  <Button ref={ref} size={size} {...props}>
    {children}
  </Button>
))
IconButton.displayName = 'IconButton'
