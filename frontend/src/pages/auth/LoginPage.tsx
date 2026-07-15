/**
 * pages/auth/LoginPage.tsx
 * Mobile-first, neutral monochrome — black/grey/white. Clean like Notion/Linear.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  City,
  GoogleLogo,
  Envelope,
  Lock,
  User,
  Phone,
  Eye,
  EyeSlash,
  Shield,
  UserGear,
  WarningCircle,
  CaretDown,
  CaretUp,
  ArrowRight,
} from '@phosphor-icons/react'
import { useGoogleLogin, useAdminLogin, useHandleGoogleRedirect } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useToast } from '@/components/ui/Toast'
import { pageTransition, fadeUp } from '@/lib/motion'
import { Button, Input } from '@/components/ui'
import { ROUTES } from '@/router/routes'

type CitizenMode     = 'google' | 'email'
type CitizenFormMode = 'signin' | 'register'
type StaffTab        = 'officer' | 'admin'

export default function LoginPage() {
  const googleLogin    = useGoogleLogin()
  const adminLogin     = useAdminLogin()
  const handleRedirect = useHandleGoogleRedirect()
  const { toast }      = useToast()
  const { login }      = useAuthStore()
  const navigate       = useNavigate()

  const [citizenMode, setCitizenMode]         = useState<CitizenMode>('google')
  const [citizenFormMode, setCitizenFormMode] = useState<CitizenFormMode>('signin')
  const [citizenForm, setCitizenForm]         = useState({ full_name: '', email: '', phone: '', password: '' })
  const [citizenError, setCitizenError]       = useState<string | null>(null)
  const [citizenLoading, setCitizenLoading]   = useState(false)
  const [showCitizenPw, setShowCitizenPw]     = useState(false)
  const [showStaff, setShowStaff]             = useState(false)
  const [staffTab, setStaffTab]               = useState<StaffTab>('officer')
  const [staffForm, setStaffForm]             = useState({ email: '', password: '' })
  const [staffError, setStaffError]           = useState<string | null>(null)
  const [googleError, setGoogleError]         = useState<string | null>(null)

  useEffect(() => {
    handleRedirect.mutateAsync().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('expired') === '1') {
      toast.warning('Session expired', 'Please sign in again to continue.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoogle = async () => {
    setGoogleError(null)
    try {
      await googleLogin.mutateAsync()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message
      if (msg?.includes('popup-closed') || msg?.includes('cancelled') || msg === 'REDIRECT_INITIATED') return
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setGoogleError(detail ?? msg ?? 'Google Sign-In failed.')
    }
  }

  const handleCitizenEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setCitizenError(null)
    if (!citizenForm.email.trim() || !citizenForm.password) { setCitizenError('Email and password are required.'); return }
    if (citizenFormMode === 'register' && !citizenForm.full_name.trim()) { setCitizenError('Full name is required.'); return }
    if (citizenForm.password.length < 8) { setCitizenError('Password must be at least 8 characters.'); return }
    setCitizenLoading(true)
    try {
      let tokenData
      if (citizenFormMode === 'register') {
        tokenData = await authApi.citizenRegister({
          full_name: citizenForm.full_name.trim(),
          email:     citizenForm.email.trim().toLowerCase(),
          phone:     citizenForm.phone || undefined,
          password:  citizenForm.password,
        })
        toast.success('Account created!', 'Welcome to CivicPulse.')
      } else {
        tokenData = await authApi.citizenLogin(citizenForm.email.trim().toLowerCase(), citizenForm.password)
      }
      login(tokenData.access_token, tokenData.user as any)
      navigate(ROUTES.CITIZEN_DASHBOARD, { replace: true })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setCitizenError(detail ?? 'Something went wrong.')
    } finally {
      setCitizenLoading(false)
    }
  }

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setStaffError(null)
    if (!staffForm.email.trim() || !staffForm.password) { setStaffError('Email and password are required.'); return }
    try {
      await adminLogin.mutateAsync({ username: staffForm.email.trim().toLowerCase(), password: staffForm.password })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setStaffError(msg ?? 'Invalid credentials.')
    }
  }

  const isGoogleLoading = googleLogin.isPending
  const isStaffLoading  = adminLogin.isPending

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="min-h-dvh flex flex-col bg-white"
    >
      {/* ── Dark hero header ─────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center justify-end pb-10 pt-16 px-6"
        style={{
          background: '#111827',
          borderBottomLeftRadius: '28px',
          borderBottomRightRadius: '28px',
        }}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.05 }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}
        >
          <City size={32} weight="duotone" color="#111827" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="text-center"
        >
          <h1
            className="font-display font-extrabold text-white tracking-tight mb-1"
            style={{ fontSize: '1.875rem', letterSpacing: '-0.03em' }}
          >
            CivicPulse
          </h1>
          <p className="text-white/50 text-sm font-medium">
            Greater Chennai Corporation
          </p>
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2 mt-4"
        >
          {['Report', 'Track', 'Resolve'].map((w, i) => (
            <span key={w} className="flex items-center gap-2">
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.70)' }}
              >
                {w}
              </span>
              {i < 2 && <ArrowRight size={10} color="rgba(255,255,255,0.25)" weight="bold" />}
            </span>
          ))}
        </motion.div>
      </div>

      {/* ── Form area ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="flex-1 px-5 pt-6 pb-10 max-w-sm mx-auto w-full"
      >
        {/* Mode tabs */}
        <div className="flex rounded-xl p-1 gap-1 mb-5" style={{ background: '#F3F4F6' }}>
          {([['google', 'Google', GoogleLogo], ['email', 'Email', Envelope]] as const).map(([mode, label, Icon]) => (
            <button
              key={mode}
              type="button"
              onClick={() => { setCitizenMode(mode as CitizenMode); setCitizenError(null) }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
              style={
                citizenMode === mode
                  ? { background: 'white', color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.10)' }
                  : { color: '#6B7280' }
              }
            >
              <Icon size={15} weight="bold" />
              {label}
            </button>
          ))}
        </div>

        {/* Google tab */}
        {citizenMode === 'google' && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-4">
            <button
              onClick={handleGoogle}
              disabled={isGoogleLoading}
              className="w-full h-[52px] rounded-xl font-semibold text-[15px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: 'white',
                border: '1.5px solid #E5E7EB',
                color: '#111827',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {isGoogleLoading
                ? <div className="w-5 h-5 border-2 border-[#E5E7EB] border-t-[#111827] rounded-full animate-spin" />
                : <GoogleLogo size={20} weight="bold" color="#4285F4" />
              }
              {isGoogleLoading ? 'Signing in…' : 'Continue with Google'}
            </button>

            <AnimatePresence>
              {googleError && <ErrorBanner message={googleError} />}
            </AnimatePresence>

            <p className="text-center text-xs text-[#9CA3AF] leading-relaxed px-4">
              New here? Your account is created automatically on first sign‑in.
            </p>
          </motion.div>
        )}

        {/* Email tab */}
        {citizenMode === 'email' && (
          <AnimatePresence mode="wait">
            <motion.form
              key={citizenFormMode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleCitizenEmail}
              noValidate
              className="space-y-3"
            >
              <AnimatePresence>
                {citizenError && <ErrorBanner message={citizenError} />}
              </AnimatePresence>

              {citizenFormMode === 'register' && (
                <Input label="Full Name" placeholder="Your name" value={citizenForm.full_name}
                  onChange={e => setCitizenForm(f => ({ ...f, full_name: e.target.value }))}
                  leadingIcon={<User size={16} weight="bold" />}
                />
              )}
              <Input type="email" label="Email" placeholder="you@example.com" value={citizenForm.email}
                onChange={e => { setCitizenForm(f => ({ ...f, email: e.target.value })); setCitizenError(null) }}
                leadingIcon={<Envelope size={16} weight="bold" />}
              />
              {citizenFormMode === 'register' && (
                <Input type="tel" label="Phone (optional)" placeholder="+91 98765 43210" value={citizenForm.phone}
                  onChange={e => setCitizenForm(f => ({ ...f, phone: e.target.value }))}
                  leadingIcon={<Phone size={16} weight="bold" />}
                />
              )}
              <div className="relative">
                <Input
                  type={showCitizenPw ? 'text' : 'password'}
                  label="Password"
                  placeholder={citizenFormMode === 'register' ? 'Min 8 characters' : 'Your password'}
                  value={citizenForm.password}
                  onChange={e => { setCitizenForm(f => ({ ...f, password: e.target.value })); setCitizenError(null) }}
                  leadingIcon={<Lock size={16} weight="bold" />}
                />
                <button type="button" onClick={() => setShowCitizenPw(v => !v)}
                  className="absolute right-3 top-[34px] text-[#9CA3AF]">
                  {showCitizenPw ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} weight="bold" />}
                </button>
              </div>

              <Button type="submit" fullWidth size="lg" isLoading={citizenLoading}
                loadingText={citizenFormMode === 'register' ? 'Creating…' : 'Signing in…'}
                className="h-[48px] rounded-xl font-semibold mt-1">
                {citizenFormMode === 'register' ? 'Create Account' : 'Sign In'}
              </Button>

              <p className="text-center text-xs text-[#6B7280]">
                {citizenFormMode === 'signin' ? (
                  <>Don't have an account?{' '}
                    <button type="button"
                      onClick={() => { setCitizenFormMode('register'); setCitizenError(null) }}
                      className="text-[#111827] font-semibold underline underline-offset-2">Create one</button></>
                ) : (
                  <>Already have an account?{' '}
                    <button type="button"
                      onClick={() => { setCitizenFormMode('signin'); setCitizenError(null) }}
                      className="text-[#111827] font-semibold underline underline-offset-2">Sign in</button></>
                )}
              </p>
            </motion.form>
          </AnimatePresence>
        )}

        {/* Staff divider */}
        <div className="flex items-center gap-3 my-7">
          <span className="flex-1 h-px bg-[#E5E7EB]" />
          <span className="text-[11px] text-[#9CA3AF] font-semibold tracking-wider uppercase">Staff Access</span>
          <span className="flex-1 h-px bg-[#E5E7EB]" />
        </div>

        {/* Staff toggle button */}
        <button
          id="staff-login-toggle"
          onClick={() => { setShowStaff(v => !v); setStaffError(null) }}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] transition-colors hover:bg-[#F3F4F6] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#111827] flex items-center justify-center">
              <UserGear size={16} color="white" weight="duotone" />
            </div>
            <span className="text-sm font-semibold text-[#111827]">Officer / Admin Login</span>
          </div>
          {showStaff
            ? <CaretUp size={15} weight="bold" className="text-[#9CA3AF]" />
            : <CaretDown size={15} weight="bold" className="text-[#9CA3AF]" />
          }
        </button>

        {/* Staff form */}
        <AnimatePresence>
          {showStaff && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-3">
                {/* Role tabs */}
                <div className="flex rounded-xl p-1 gap-1" style={{ background: '#F3F4F6' }}>
                  {([['officer', 'Officer', UserGear], ['admin', 'Admin', Shield]] as const).map(([tab, label, Icon]) => (
                    <button
                      key={tab}
                      id={`${tab}-tab`}
                      type="button"
                      onClick={() => { setStaffTab(tab as StaffTab); setStaffError(null) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={
                        staffTab === tab
                          ? { background: 'white', color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                          : { color: '#6B7280' }
                      }
                    >
                      <Icon size={13} weight="duotone" />
                      {label}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {staffError && <ErrorBanner message={staffError} />}
                </AnimatePresence>

                <form onSubmit={handleStaffLogin} noValidate className="space-y-3">
                  <Input
                    type="email" name="staff-email" id="staff-email"
                    label={staffTab === 'officer' ? 'Officer Email' : 'Admin Email'}
                    placeholder={staffTab === 'officer' ? 'officer@civicpulse.in' : 'admin@civicpulse.in'}
                    autoComplete="username"
                    value={staffForm.email}
                    onChange={e => { setStaffForm(f => ({ ...f, email: e.target.value })); setStaffError(null) }}
                    leadingIcon={<Envelope size={16} weight="bold" />}
                  />
                  <Input
                    type="password" name="staff-password" id="staff-password"
                    label="Password" placeholder="Enter your password"
                    autoComplete="current-password"
                    value={staffForm.password}
                    onChange={e => { setStaffForm(f => ({ ...f, password: e.target.value })); setStaffError(null) }}
                    leadingIcon={<Lock size={16} weight="bold" />}
                  />
                  <Button type="submit" fullWidth size="lg" variant="outline"
                    isLoading={isStaffLoading} loadingText="Signing in…"
                    className="h-[48px] rounded-xl font-semibold">
                    {staffTab === 'officer' ? 'Sign In as Officer' : 'Sign In as Admin'}
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-[#9CA3AF] mt-8 leading-relaxed">
          By signing in you agree to our{' '}
          <button className="text-[#374151] underline underline-offset-2">Terms</button>{' '}and{' '}
          <button className="text-[#374151] underline underline-offset-2">Privacy Policy</button>.
        </p>
      </motion.div>
    </motion.div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-50 border border-red-200"
    >
      <WarningCircle size={16} color="#DC2626" weight="fill" className="shrink-0 mt-0.5" />
      <p className="text-sm text-red-700 font-medium leading-snug">{message}</p>
    </motion.div>
  )
}
