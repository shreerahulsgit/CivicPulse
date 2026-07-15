/**
 * pages/zonal/WardOfficersPage.tsx — Manage Ward Officers in the zone
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, UserCheck, UserX, Mail, Lock, User, Phone,
  X, AlertCircle, MapPin, ChevronDown,
} from 'lucide-react'
import { zonalApi, type WardOfficerCreate } from '@/api/zonal'
import { stagger, fadeUp } from '@/lib/motion'
import { Button, Input } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

// ── Officer Card ──────────────────────────────────────────────────────────────

function OfficerCard({
  officer,
  onDeactivate,
  deactivating,
}: {
  officer: { id: string; full_name: string; email: string; phone: string | null; is_active: boolean; ward_id: number | null; ward_number: string | null; ward_name: string | null; created_at: string }
  onDeactivate: (id: string) => void
  deactivating: boolean
}) {
  return (
    <motion.div
      variants={fadeUp}
      layout
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border)',
        opacity: officer.is_active ? 1 : 0.55,
      }}
    >
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-base text-white"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
      >
        {officer.full_name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-text-primary truncate leading-tight">
          {officer.full_name}
        </p>
        <p className="text-[12px] text-text-muted truncate mt-0.5">{officer.email}</p>
        {officer.ward_number && (
          <div className="flex items-center gap-1 mt-1">
            <MapPin size={11} className="text-primary shrink-0" />
            <span className="text-[11px] text-primary font-semibold">
              Ward {officer.ward_number}{officer.ward_name ? ` · ${officer.ward_name}` : ''}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            officer.is_active
              ? 'bg-success/10 text-success'
              : 'bg-danger/10 text-danger'
          }`}
        >
          {officer.is_active ? 'Active' : 'Inactive'}
        </span>
        {officer.is_active && (
          <button
            onClick={() => onDeactivate(officer.id)}
            disabled={deactivating}
            className="text-[11px] text-danger hover:underline disabled:opacity-50 transition-colors"
          >
            Deactivate
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: WardOfficerCreate = {
  full_name: '',
  email: '',
  password: '',
  phone: '',
  ward_id: 0,
}

export default function WardOfficersPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<WardOfficerCreate>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [wardOpen, setWardOpen] = useState(false)

  // Officers list
  const { data: officers, isLoading } = useQuery({
    queryKey: ['zonal', 'ward-officers'],
    queryFn: zonalApi.getWardOfficers,
    staleTime: 30_000,
  })

  // Zone wards dropdown
  const { data: zoneWards = [] } = useQuery({
    queryKey: ['zonal', 'wards'],
    queryFn: zonalApi.getZoneWards,
    staleTime: 60_000,
  })

  const selectedWard = zoneWards.find((w) => w.id === form.ward_id)

  const createMutation = useMutation({
    mutationFn: zonalApi.createWardOfficer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zonal', 'ward-officers'] })
      qc.invalidateQueries({ queryKey: ['zonal', 'wards'] })
      toast.success('Officer created!', 'Ward officer account is ready.')
      setShowForm(false)
      setForm(EMPTY_FORM)
      setFormError(null)
      setWardOpen(false)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setFormError(err?.response?.data?.detail ?? 'Failed to create officer.')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: zonalApi.deactivateWardOfficer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zonal', 'ward-officers'] })
      qc.invalidateQueries({ queryKey: ['zonal', 'wards'] })
      toast.success('Officer deactivated.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      setFormError('Name, email, and password are required.')
      return
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }
    if (!form.ward_id) {
      setFormError('Please select a ward.')
      return
    }
    createMutation.mutate({ ...form, phone: form.phone || undefined })
  }

  const active   = officers?.filter(o => o.is_active) ?? []
  const inactive = officers?.filter(o => !o.is_active) ?? []

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="show"
      className="px-4 pt-6 pb-28 max-w-lg mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] text-text-muted uppercase tracking-widest font-semibold mb-0.5">
            Your Zone
          </p>
          <h1 className="text-2xl font-bold text-text-primary">Ward Officers</h1>
        </div>
        <Button
          size="sm"
          onClick={() => { setShowForm(v => !v); setFormError(null) }}
          className="flex items-center gap-1.5"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancel' : 'Add Officer'}
        </Button>
      </motion.div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-5"
          >
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl p-4 space-y-3"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border)' }}
            >
              <p className="text-[13px] font-bold text-text-primary">New Ward Officer</p>

              {/* Error banner */}
              <AnimatePresence>
                {formError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20"
                  >
                    <AlertCircle size={14} className="text-danger shrink-0" />
                    <p className="text-xs text-danger">{formError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Ward dropdown — only wards in this zone */}
              <div>
                <label className="text-[11px] font-medium text-text-muted mb-1.5 block">
                  Ward <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setWardOpen(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-white text-[13px] text-left focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {selectedWard ? (
                      <span className="text-text-primary font-medium">
                        Ward {selectedWard.ward_number}
                        {selectedWard.ward_name ? ` — ${selectedWard.ward_name}` : ''}
                      </span>
                    ) : (
                      <span className="text-text-muted">Select a ward...</span>
                    )}
                    <ChevronDown size={15} className={`text-text-muted transition-transform ${wardOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {wardOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-[#E5E7EB] overflow-hidden shadow-xl"
                        style={{ background: '#ffffff', maxHeight: '220px', overflowY: 'auto' }}
                      >
                        {zoneWards.length === 0 ? (
                          <p className="text-[12px] text-text-muted px-3 py-3">No wards in your zone.</p>
                        ) : (
                          zoneWards.map(w => (
                            <button
                              key={w.id}
                              type="button"
                              disabled={w.has_officer}
                              onClick={() => {
                                setForm(f => ({ ...f, ward_id: w.id }))
                                setWardOpen(false)
                              }}
                              className={`w-full text-left px-3 py-2.5 text-[12px] flex items-center justify-between gap-2 transition-colors ${
                                w.has_officer
                                  ? 'opacity-40 cursor-not-allowed bg-surface-sunken'
                                  : form.ward_id === w.id
                                  ? 'bg-primary/10 text-primary'
                                  : 'hover:bg-surface-sunken text-text-primary'
                              }`}
                            >
                              <span>
                                <span className="font-bold">Ward {w.ward_number}</span>
                                {w.ward_name && <span className="text-text-muted"> — {w.ward_name}</span>}
                              </span>
                              {w.has_officer && (
                                <span className="text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full shrink-0">
                                  Assigned
                                </span>
                              )}
                            </button>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <Input
                id="wo-name"
                label="Full Name"
                placeholder="e.g. Rajesh Kumar"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                leadingIcon={<User size={15} />}
              />
              <Input
                id="wo-email"
                type="email"
                label="Email"
                placeholder="officer@civicpulse.in"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                leadingIcon={<Mail size={15} />}
              />
              <Input
                id="wo-password"
                type="password"
                label="Password"
                placeholder="Min 8 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                leadingIcon={<Lock size={15} />}
              />
              <Input
                id="wo-phone"
                label="Phone (optional)"
                placeholder="+91 98765 43210"
                value={form.phone ?? ''}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                leadingIcon={<Phone size={15} />}
              />

              <Button
                type="submit"
                fullWidth
                isLoading={createMutation.isPending}
                loadingText="Creating..."
                className="mt-2"
              >
                Create Officer
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[76px] rounded-2xl animate-pulse" style={{ background: 'var(--surface-sunken)' }} />
          ))}
        </div>
      ) : (
        <>
          {/* Active */}
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-3">
            <UserCheck size={14} className="text-success" />
            <span className="text-[12px] font-bold text-text-primary uppercase tracking-wider">
              Active ({active.length})
            </span>
          </motion.div>

          {active.length === 0 ? (
            <motion.div variants={fadeUp} className="py-8 text-center rounded-2xl mb-4" style={{ background: 'var(--surface-sunken)' }}>
              <MapPin size={28} className="text-text-muted mx-auto mb-2 opacity-50" />
              <p className="text-sm text-text-muted">No active officers. Add one above.</p>
            </motion.div>
          ) : (
            <motion.div variants={stagger.container} className="space-y-2 mb-5">
              {active.map(o => (
                <OfficerCard
                  key={o.id}
                  officer={o}
                  onDeactivate={id => deactivateMutation.mutate(id)}
                  deactivating={deactivateMutation.isPending}
                />
              ))}
            </motion.div>
          )}

          {/* Inactive */}
          {inactive.length > 0 && (
            <>
              <motion.div variants={fadeUp} className="flex items-center gap-2 mb-3 mt-2">
                <UserX size={14} className="text-text-muted" />
                <span className="text-[12px] font-bold text-text-muted uppercase tracking-wider">
                  Inactive ({inactive.length})
                </span>
              </motion.div>
              <motion.div variants={stagger.container} className="space-y-2">
                {inactive.map(o => (
                  <OfficerCard
                    key={o.id}
                    officer={o}
                    onDeactivate={id => deactivateMutation.mutate(id)}
                    deactivating={deactivateMutation.isPending}
                  />
                ))}
              </motion.div>
            </>
          )}
        </>
      )}
    </motion.div>
  )
}
