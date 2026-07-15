/**
 * pages/admin/OfficersPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin Officers — create officers + manage their ward/dept assignments.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Search, AlertCircle, RefreshCcw, Briefcase,
  Plus, X, User, Mail, Phone, Lock, MapPin, ChevronRight, Trash2,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { TopBar }              from '@/components/layout/TopBar'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { EmptyState }          from '@/components/ui/EmptyState'
import { Button, Input }       from '@/components/ui'
import { useToast }            from '@/components/ui/Toast'
import { useOfficerWorkloads } from '@/hooks/useAdmin'
import { adminApi }            from '@/api/admin'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'

// ── Types ─────────────────────────────────────────────────────────────────────

const ZONES = [
  { id: 1,  name: 'Thiruvottiyur' },
  { id: 2,  name: 'Manali' },
  { id: 3,  name: 'Madhavaram' },
  { id: 4,  name: 'Tondiarpet' },
  { id: 5,  name: 'Royapuram' },
  { id: 6,  name: 'Thiru-Vi-Ka Nagar' },
  { id: 7,  name: 'Ambattur' },
  { id: 8,  name: 'Anna Nagar' },
  { id: 9,  name: 'Teynampet' },
  { id: 10, name: 'Kodambakkam' },
  { id: 11, name: 'Valasaravakkam' },
  { id: 12, name: 'Alandur' },
  { id: 13, name: 'Adyar' },
  { id: 14, name: 'Perungudi' },
  { id: 15, name: 'Sholinganallur' },
]

interface OfficerForm {
  full_name: string
  email: string
  phone: string
  password: string
  role: string
  zone_id: string   // for zonal_officer
  ward_id: string   // for ward_officer
}
const emptyForm: OfficerForm = {
  full_name: '', email: '', phone: '', password: '',
  role: 'ward_officer', zone_id: '', ward_id: '',
}

function validateForm(f: OfficerForm) {
  const e: Partial<Record<keyof OfficerForm, string>> = {}
  if (!f.full_name.trim()) e.full_name = 'Name is required'
  if (!f.email.trim()) e.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Invalid email'
  if (!f.password) e.password = 'Password is required'
  else if (f.password.length < 8) e.password = 'Min 8 characters'
  if (f.role === 'zonal_officer' && !f.zone_id) e.zone_id = 'Select a zone'
  if (f.role === 'ward_officer' && !f.ward_id) e.ward_id = 'Select a ward'
  return e
}

// ── Assignment Sheet ──────────────────────────────────────────────────────────

function AssignmentSheet({ officer, onClose }: { officer: any; onClose: () => void }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [deptId, setDeptId] = useState('')
  const [wardSearch, setWardSearch] = useState('')
  const [wardId, setWardId] = useState('')

  const { data: departments = [] } = useQuery({
    queryKey: ['admin', 'departments'],
    queryFn: adminApi.listDepartments,
  })

  const { data: wards = [] } = useQuery({
    queryKey: ['admin', 'wards'],
    queryFn: adminApi.listWards,
  })

  const { data: assignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['admin', 'officer-assignments', officer.officer_id],
    queryFn: () => adminApi.listOfficerAssignments(officer.officer_id),
  })

  const addMutation = useMutation({
    mutationFn: () => adminApi.addOfficerAssignment(officer.officer_id, {
      department_id: Number(deptId),
      ward_id: Number(wardId),
    }),
    onSuccess: () => {
      toast.success('Assignment added!')
      setDeptId(''); setWardId(''); setWardSearch('')
      refetchAssignments()
      qc.invalidateQueries({ queryKey: ['admin', 'officer-assignments', officer.officer_id] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to add assignment')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      adminApi.deleteOfficerAssignment(officer.officer_id, assignmentId),
    onSuccess: () => {
      toast.success('Assignment removed')
      refetchAssignments()
    },
  })

  const filteredWards = (wards as any[]).filter((w: any) =>
    !wardSearch ||
    w.ward_number.includes(wardSearch) ||
    w.name.toLowerCase().includes(wardSearch.toLowerCase()) ||
    w.zone_name.toLowerCase().includes(wardSearch.toLowerCase())
  ).slice(0, 20)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-8 z-10 max-h-[90dvh] flex flex-col"
        style={{ boxShadow: '0 -8px 40px rgba(15,23,42,0.12)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#111827]">Ward Assignments</h2>
            <p className="text-[12px] text-[#6B7280]">{officer.officer_name}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4">
          {/* Add assignment form */}
          <div className="bg-[#F9FAFB] rounded-2xl p-4 border border-[#E5E7EB] space-y-3">
            <p className="text-[12px] font-bold text-[#111827] uppercase tracking-wider">Add Assignment</p>

            {/* Department select */}
            <div>
              <label className="text-[11px] font-medium text-[#6B7280] mb-1 block">Department</label>
              <select
                value={deptId}
                onChange={e => setDeptId(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]/30"
              >
                <option value="">Select department...</option>
                {(departments as any[]).map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Ward search + select */}
            <div>
              <label className="text-[11px] font-medium text-[#6B7280] mb-1 block">Ward</label>
              <input
                placeholder="Search ward number or name..."
                value={wardSearch}
                onChange={e => { setWardSearch(e.target.value); setWardId('') }}
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]/30 mb-2"
              />
              {wardSearch && (
                <div className="border border-[#E5E7EB] rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                  {filteredWards.length === 0 ? (
                    <p className="text-[12px] text-[#9CA3AF] px-3 py-2">No wards found</p>
                  ) : filteredWards.map((w: any) => (
                    <button
                      key={w.id}
                      onClick={() => { setWardId(String(w.id)); setWardSearch(`Ward ${w.ward_number} — ${w.zone_name}`) }}
                      className={`w-full text-left px-3 py-2 text-[12px] hover:bg-[#F3F4F6] transition-colors ${wardId === String(w.id) ? 'bg-[#EEF2FF] text-[#111827]' : 'text-[#111827]'}`}
                    >
                      <span className="font-bold">Ward {w.ward_number}</span> — {w.name} <span className="text-[#9CA3AF]">({w.zone_name})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              fullWidth
              size="sm"
              disabled={!deptId || !wardId}
              isLoading={addMutation.isPending}
              onClick={() => addMutation.mutate()}
              leftIcon={<Plus size={14} />}
            >
              Add Assignment
            </Button>
          </div>

          {/* Existing assignments */}
          <div>
            <p className="text-[12px] font-bold text-[#111827] uppercase tracking-wider mb-2">
              Current Assignments ({(assignments as any[]).length})
            </p>
            {(assignments as any[]).length === 0 ? (
              <p className="text-[13px] text-[#9CA3AF] text-center py-4">No assignments yet</p>
            ) : (
              <div className="space-y-2">
                {(assignments as any[]).map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 bg-white border border-[#E5E7EB] rounded-xl px-3 py-2.5">
                    <MapPin size={14} className="text-[#111827] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[#111827] truncate">Ward {a.ward_number} — {a.department_name}</p>
                      <p className="text-[10px] text-[#9CA3AF]">{a.ward_name}</p>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(a.id)}
                      className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0"
                    >
                      <Trash2 size={12} className="text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminOfficersPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedOfficer, setSelectedOfficer] = useState<any>(null)
  const [form, setForm] = useState<OfficerForm>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof OfficerForm, string>>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [wardSearch, setWardSearch] = useState('')

  const { data: officers, isLoading, isError, refetch } = useOfficerWorkloads()

  const { data: allOfficers } = useQuery({
    queryKey: ['admin', 'officers-list'],
    queryFn: adminApi.listOfficers,
  })

  // Ward list for the picker (only needed when role=ward_officer)
  const { data: allWards = [] } = useQuery({
    queryKey: ['admin', 'wards'],
    queryFn: adminApi.listWards,
  })

  const filteredModalWards = (allWards as any[]).filter((w: any) =>
    !wardSearch ||
    String(w.ward_number).includes(wardSearch) ||
    (w.name || '').toLowerCase().includes(wardSearch.toLowerCase())
  ).slice(0, 20)

  const createMutation = useMutation({
    mutationFn: adminApi.createOfficer,
    onSuccess: () => {
      toast.success('Officer created!', 'They can now log in.')
      setShowModal(false)
      setForm(emptyForm)
      setErrors({})
      setApiError(null)
      setWardSearch('')
      refetch()
      queryClient.invalidateQueries({ queryKey: ['admin', 'officers-list'] })
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setApiError(typeof detail === 'string' ? detail : 'Failed to create officer.')
    },
  })

  const handleSubmit = () => {
    const errs = validateForm(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setApiError(null)
    createMutation.mutate({
      full_name: form.full_name,
      email:     form.email,
      phone:     form.phone || undefined,
      password:  form.password,
      role:      form.role,
      zone_id:   form.role === 'zonal_officer' && form.zone_id ? Number(form.zone_id) : null,
      ward_id:   form.role === 'ward_officer' && form.ward_id ? Number(form.ward_id) : null,
    })
  }

  const set = (field: keyof OfficerForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setApiError(null)
  }

  // Merge workloads with full officer list
  const workloadMap = new Map((officers ?? []).map(o => [o.email, o]))
  const officerList = (allOfficers ?? []).map((o: any) => ({
    officer_id:           o.id,
    officer_name:         o.full_name,
    email:                o.email,
    assigned_total:       workloadMap.get(o.email)?.assigned_total ?? 0,
    in_progress:          workloadMap.get(o.email)?.in_progress ?? 0,
    resolved_today:       workloadMap.get(o.email)?.resolved_today ?? 0,
    avg_resolution_hours: workloadMap.get(o.email)?.avg_resolution_hours ?? null,
    pending:              workloadMap.get(o.email)?.pending ?? 0,
  }))

  const displayList = officerList.length > 0 ? officerList : (officers ?? [])
  const filtered = displayList.filter((o: any) =>
    o.officer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex flex-col min-h-dvh bg-[#F9FAFB]"
    >
      {/* Mobile top bar */}
      <TopBar
        title="Officers"
        showBack
        rightElement={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCcw size={15} />
            </Button>
            <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
              <Plus size={15} />
              Add
            </Button>
          </div>
        }
      />

      {/* Desktop header bar — hidden on mobile */}
      <div className="hidden md:flex items-center justify-between px-6 py-4 bg-white border-b border-[#E5E7EB]">
        <h1 className="text-lg font-bold text-[#111827]">Officers</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCcw size={15} />
          </Button>
          <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
            <Plus size={15} />
            Add Officer
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 py-3 bg-white border-b border-[#E5E7EB] sticky top-14 md:top-0 z-10">
        <Input
          placeholder="Search officers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leadingIcon={<Search size={16} />}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : isError ? (
          <EmptyState
            Icon={AlertCircle}
            title="Couldn't load officers"
            action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            Icon={Users}
            title="No officers found"
            description={searchTerm ? 'No officers match your search.' : 'Add your first officer using the button above.'}
          />
        ) : (
          <motion.div variants={stagger.container} initial="hidden" animate="show" className="p-4 space-y-3">
            {filtered.map((officer: any) => (
              <motion.div
                key={officer.officer_id}
                variants={fadeUp}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-4"
                style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#EEF2FF] text-[#111827] flex items-center justify-center font-bold text-sm shrink-0">
                    {officer.officer_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-bold text-[#111827] truncate leading-tight">{officer.officer_name}</h3>
                    <p className="text-[12px] text-[#6B7280] truncate mt-0.5">{officer.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-[#F9FAFB] rounded-xl p-3 border border-[#F3F4F6] mb-3">
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-0.5">Assigned</p>
                    <p className="text-[16px] font-extrabold text-[#111827]">{officer.assigned_total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-0.5">Active</p>
                    <p className="text-[16px] font-extrabold text-[#3B82F6]">{officer.in_progress}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-0.5">Resolved</p>
                    <p className="text-[16px] font-extrabold text-[#16A34A]">{officer.resolved_today}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Briefcase size={13} className="text-[#9CA3AF]" />
                    <p className="text-[11px] text-[#6B7280]">
                      Avg: {officer.avg_resolution_hours ? `${officer.avg_resolution_hours.toFixed(1)} hrs` : 'N/A'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedOfficer(officer)}
                    className="flex items-center gap-1 text-[12px] font-bold text-[#111827] hover:text-[#1F2937] transition-colors"
                  >
                    <MapPin size={13} />
                    Manage Wards
                    <ChevronRight size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Assignment Sheet */}
      <AnimatePresence>
        {selectedOfficer && (
          <AssignmentSheet officer={selectedOfficer} onClose={() => setSelectedOfficer(null)} />
        )}
      </AnimatePresence>

      {/* Add Officer Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 z-10"
              style={{ boxShadow: '0 -8px 40px rgba(15,23,42,0.12)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#111827]">Add Officer</h2>
                  <p className="text-sm text-[#6B7280] mt-0.5">Create a new officer account</p>
                </div>
                <button onClick={() => setShowModal(false)} className="w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>

              <AnimatePresence>
                {apiError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 mb-4"
                  >
                    <AlertCircle size={14} className="text-red-500 shrink-0" />
                    <p className="text-sm text-red-600 font-medium">{apiError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                <Input name="full_name" label="Full Name" placeholder="Officer name" value={form.full_name}
                  onChange={set('full_name')} error={errors.full_name} leadingIcon={<User size={16} />} />
                <Input type="email" name="email" label="Email" placeholder="officer@email.com" value={form.email}
                  onChange={set('email')} error={errors.email} leadingIcon={<Mail size={16} />} />
                <Input type="tel" name="phone" label="Phone (optional)" placeholder="+91 98765 43210" value={form.phone}
                  onChange={set('phone')} error={errors.phone} leadingIcon={<Phone size={16} />} />
                <Input type="password" name="password" label="Password" placeholder="Min 8 characters" value={form.password}
                  onChange={set('password')} error={errors.password} leadingIcon={<Lock size={16} />} />

                {/* Role selector */}
                <div>
                  <label className="text-[11px] font-medium text-[#6B7280] mb-1.5 block">Role</label>
                  <select
                    value={form.role}
                    onChange={e => {
                      setForm(f => ({ ...f, role: e.target.value, zone_id: '', ward_id: '', dept_id: '' }))
                      setWardSearch('')
                    }}
                    className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]/30"
                  >
                    <option value="ward_officer">Ward Officer</option>
                    <option value="zonal_officer">Zonal Officer</option>
                    <option value="dept_head">Department Head</option>
                  </select>
                </div>

                {/* Zone selector — only for Zonal Officer */}
                {form.role === 'zonal_officer' && (
                  <div>
                    <label className="text-[11px] font-medium text-[#6B7280] mb-1.5 block">
                      Zone <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.zone_id}
                      onChange={e => setForm(f => ({ ...f, zone_id: e.target.value }))}
                      className={`w-full border rounded-xl px-3 py-2.5 text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]/30 ${
                        errors.zone_id ? 'border-red-400' : 'border-[#E5E7EB]'
                      }`}
                    >
                      <option value="">Select zone...</option>
                      {ZONES.map(z => (
                        <option key={z.id} value={z.id}>
                          Zone {z.id} — {z.name}
                        </option>
                      ))}
                    </select>
                    {errors.zone_id && (
                      <p className="text-[11px] text-red-500 mt-1">{errors.zone_id}</p>
                    )}
                  </div>
                )}

                {/* Ward + Department — only for Ward Officer */}
                {form.role === 'ward_officer' && (
                  <>
                    {/* Ward picker */}
                    <div>
                      <label className="text-[11px] font-medium text-[#6B7280] mb-1.5 block">
                        Ward <span className="text-red-500">*</span>
                      </label>
                      <input
                        placeholder="Search ward number or name..."
                        value={wardSearch}
                        onChange={e => { setWardSearch(e.target.value); setForm(f => ({ ...f, ward_id: '' })) }}
                        className={`w-full border rounded-xl px-3 py-2.5 text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]/30 mb-1 ${
                          errors.ward_id ? 'border-red-400' : 'border-[#E5E7EB]'
                        }`}
                      />
                      {wardSearch && (
                        <div className="border border-[#E5E7EB] rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                          {filteredModalWards.length === 0 ? (
                            <p className="text-[12px] text-[#9CA3AF] px-3 py-2">No wards found</p>
                          ) : filteredModalWards.map((w: any) => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => {
                                setForm(f => ({ ...f, ward_id: String(w.id) }))
                                setWardSearch(`Ward ${w.ward_number} — ${w.name}`)
                              }}
                              className={`w-full text-left px-3 py-2 text-[12px] hover:bg-[#F3F4F6] transition-colors ${
                                form.ward_id === String(w.id) ? 'bg-[#EEF2FF] text-[#111827]' : 'text-[#111827]'
                              }`}
                            >
                              <span className="font-bold">Ward {w.ward_number}</span> — {w.name}
                              <span className="text-[#9CA3AF] ml-1">({w.zone_name})</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {errors.ward_id && <p className="text-[11px] text-red-500 mt-1">{errors.ward_id}</p>}
                    </div>
                  </>
                )}
              </div>

              <Button fullWidth size="lg" className="mt-6 h-[52px] rounded-2xl font-bold text-base"
                isLoading={createMutation.isPending} loadingText="Creating..." onClick={handleSubmit}>
                Create Officer Account
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
