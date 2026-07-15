/**
 * pages/admin/UsersPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin Users — full CRUD on all user accounts.
 * Create / Read / Update (role, status, password) / Delete (soft or hard).
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Search, Plus, X, User, Mail, Phone, Lock,
  RefreshCcw, AlertCircle, CheckCircle, Trash2,
  Edit3, Eye, EyeOff,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { TopBar }       from '@/components/layout/TopBar'
import { Button, Input } from '@/components/ui'
import { useToast }     from '@/components/ui/Toast'
import { adminApi, type UserListItem } from '@/api/admin'
import { pageTransition, stagger, fadeUp } from '@/lib/motion'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'citizen',       label: 'Citizen',         color: '#3B82F6' },
  { value: 'ward_officer',  label: 'Ward Officer',    color: '#8B5CF6' },
  { value: 'zonal_officer', label: 'Zonal Officer',   color: '#F59E0B' },
  { value: 'dept_head',     label: 'Dept. Head',      color: '#10B981' },
  { value: 'admin',         label: 'Admin',           color: '#EF4444' },
]

const ZONES = [
  { id: 1, name: 'Thiruvottiyur' }, { id: 2, name: 'Manali' },
  { id: 3, name: 'Madhavaram' },   { id: 4, name: 'Tondiarpet' },
  { id: 5, name: 'Royapuram' },    { id: 6, name: 'Thiru-Vi-Ka Nagar' },
  { id: 7, name: 'Ambattur' },     { id: 8, name: 'Anna Nagar' },
  { id: 9, name: 'Teynampet' },    { id: 10, name: 'Kodambakkam' },
  { id: 11, name: 'Valasaravakkam' }, { id: 12, name: 'Alandur' },
  { id: 13, name: 'Adyar' },       { id: 14, name: 'Perungudi' },
  { id: 15, name: 'Sholinganallur' },
]

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All Roles' },
  ...ROLES.map(r => ({ value: r.value, label: r.label })),
]

function roleBadge(role: string) {
  const r = ROLES.find(x => x.value === role)
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: (r?.color ?? '#9CA3AF') + '22', color: r?.color ?? '#9CA3AF' }}
    >
      {r?.label ?? role}
    </span>
  )
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

interface ModalProps {
  editUser?: UserListItem | null
  onClose: () => void
  onSuccess: () => void
}

function UserModal({ editUser, onClose, onSuccess }: ModalProps) {
  const { toast } = useToast()
  const isEdit = !!editUser

  const [form, setForm] = useState({
    full_name: editUser?.full_name ?? '',
    email:     editUser?.email     ?? '',
    phone:     editUser?.phone     ?? '',
    password:  '',
    role:      editUser?.role      ?? 'citizen',
    zone_id:   editUser?.zone_id   ? String(editUser.zone_id) : '',
    is_active: editUser?.is_active ?? true,
  })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.full_name.trim()) e.full_name = 'Required'
    if (!isEdit && !form.email.trim()) e.email = 'Required'
    if (!isEdit && !form.password) e.password = 'Required'
    if (form.password && form.password.length < 8) e.password = 'Min 8 characters'
    if (form.role === 'zonal_officer' && !form.zone_id) e.zone_id = 'Select zone'
    return e
  }

  const createMutation = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => { toast.success('User created!'); onSuccess() },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      setApiError(err?.response?.data?.detail ?? 'Failed to create user.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof adminApi.updateUser>[1] }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => { toast.success('User updated!'); onSuccess() },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      setApiError(err?.response?.data?.detail ?? 'Failed to update user.'),
  })

  const handleSubmit = () => {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setApiError(null)

    if (isEdit) {
      const data: Parameters<typeof adminApi.updateUser>[1] = {}
      if (form.full_name !== editUser?.full_name) data.full_name = form.full_name
      if (form.phone !== (editUser?.phone ?? '')) data.phone = form.phone || undefined
      if (form.role !== editUser?.role) data.role = form.role
      if (form.role === 'zonal_officer' && form.zone_id) data.zone_id = Number(form.zone_id)
      if (form.is_active !== editUser?.is_active) data.is_active = form.is_active
      if (form.password) data.password = form.password
      updateMutation.mutate({ id: editUser!.id, data })
    } else {
      createMutation.mutate({
        full_name: form.full_name,
        email:     form.email,
        phone:     form.phone || undefined,
        password:  form.password,
        role:      form.role,
        zone_id:   form.role === 'zonal_officer' && form.zone_id ? Number(form.zone_id) : null,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 z-10 max-h-[92dvh] overflow-y-auto"
        style={{ boxShadow: '0 -8px 40px rgba(15,23,42,0.15)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">
              {isEdit ? 'Edit User' : 'Create User'}
            </h2>
            <p className="text-sm text-[#6B7280]">
              {isEdit ? editUser?.email : 'New email-authenticated account'}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        {/* API Error */}
        <AnimatePresence>
          {apiError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 mb-4"
            >
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{apiError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {/* Name */}
          <Input
            label="Full Name"
            placeholder="e.g. Priya Nair"
            value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            error={errors.full_name}
            leadingIcon={<User size={15} />}
          />

          {/* Email — read-only on edit */}
          {!isEdit ? (
            <Input
              type="email"
              label="Email"
              placeholder="user@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              error={errors.email}
              leadingIcon={<Mail size={15} />}
            />
          ) : (
            <div>
              <p className="text-[11px] font-medium text-[#6B7280] mb-1">Email</p>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <Mail size={14} className="text-[#9CA3AF]" />
                <span className="text-[13px] text-[#6B7280]">{editUser?.email}</span>
              </div>
            </div>
          )}

          {/* Phone */}
          <Input
            type="tel"
            label="Phone (optional)"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            leadingIcon={<Phone size={15} />}
          />

          {/* Password */}
          <div className="relative">
            <Input
              type={showPw ? 'text' : 'password'}
              label={isEdit ? 'New Password (leave blank to keep)' : 'Password'}
              placeholder="Min 8 characters"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              error={errors.password}
              leadingIcon={<Lock size={15} />}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-[34px] text-[#9CA3AF]"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Role */}
          <div>
            <label className="text-[11px] font-medium text-[#6B7280] mb-1.5 block">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value, zone_id: '' }))}
              className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]/30 appearance-none"
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Zone — only for zonal_officer */}
          {form.role === 'zonal_officer' && (
            <div>
              <label className="text-[11px] font-medium text-[#6B7280] mb-1.5 block">
                Zone <span className="text-red-500">*</span>
              </label>
              <select
                value={form.zone_id}
                onChange={e => setForm(f => ({ ...f, zone_id: e.target.value }))}
                className={`w-full border rounded-xl px-3 py-2.5 text-[13px] text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]/30 ${errors.zone_id ? 'border-red-400' : 'border-[#E5E7EB]'}`}
              >
                <option value="">Select zone...</option>
                {ZONES.map(z => (
                  <option key={z.id} value={z.id}>Zone {z.id} — {z.name}</option>
                ))}
              </select>
              {errors.zone_id && <p className="text-[11px] text-red-500 mt-1">{errors.zone_id}</p>}
            </div>
          )}

          {/* Active status (edit only) */}
          {isEdit && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
              <span className="text-[13px] font-medium text-[#111827]">Active Account</span>
              <button
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.is_active ? 'bg-[#10B981]' : 'bg-[#E5E7EB]'}`}
              >
                <span className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          )}
        </div>

        <Button
          fullWidth
          size="lg"
          className="mt-6 h-[52px] rounded-2xl font-bold"
          isLoading={isPending}
          loadingText={isEdit ? 'Saving...' : 'Creating...'}
          onClick={handleSubmit}
        >
          {isEdit ? 'Save Changes' : 'Create User'}
        </Button>
      </motion.div>
    </motion.div>
  )
}

// ── Delete Confirm ─────────────────────────────────────────────────────────────

function DeleteConfirm({ user, onClose }: { user: UserListItem; onClose: () => void }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [hard, setHard] = useState(false)

  const mutation = useMutation({
    mutationFn: () => adminApi.deleteUser(user.id, hard),
    onSuccess: () => {
      toast.success(hard ? 'User permanently deleted.' : 'User deactivated.')
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      onClose()
    },
    onError: () => toast.error('Failed to delete user.'),
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-sm bg-white rounded-3xl p-6 z-10"
        style={{ boxShadow: '0 20px 60px rgba(15,23,42,0.2)' }}
      >
        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="text-[17px] font-bold text-[#111827] text-center mb-1">
          {hard ? 'Permanently Delete' : 'Deactivate User'}?
        </h3>
        <p className="text-[13px] text-[#6B7280] text-center mb-5">
          <strong>{user.full_name}</strong> ({user.email})
        </p>

        <div
          onClick={() => setHard(v => !v)}
          className="flex items-center gap-2 mb-5 cursor-pointer"
        >
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${hard ? 'bg-red-500 border-red-500' : 'border-[#D1D5DB]'}`}>
            {hard && <CheckCircle size={10} className="text-white" />}
          </div>
          <span className="text-[12px] text-[#6B7280]">Permanently delete (cannot undo)</span>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button
            fullWidth
            className="bg-red-500 hover:bg-red-600 text-white"
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {hard ? 'Delete' : 'Deactivate'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState('')
  const [showCreate, setShowCreate]   = useState(false)
  const [editUser, setEditUser]       = useState<UserListItem | null>(null)
  const [deleteUser, setDeleteUser]   = useState<UserListItem | null>(null)

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['admin', 'users', roleFilter],
    queryFn: () => adminApi.listUsers({ role_filter: roleFilter || undefined, limit: 200 }),
    staleTime: 20_000,
  })

  const filtered = users.filter(u =>
    !search ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const closeModal = () => { setShowCreate(false); setEditUser(null) }
  const onSuccess  = () => { closeModal(); qc.invalidateQueries({ queryKey: ['admin', 'users'] }) }

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
        title="Users"
        showBack
        rightElement={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCcw size={15} />
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus size={15} />
              Add
            </Button>
          </div>
        }
      />

      {/* Desktop header bar — hidden on mobile */}
      <div className="hidden md:flex items-center justify-between px-6 py-4 bg-white border-b border-[#E5E7EB]">
        <h1 className="text-lg font-bold text-[#111827]">Users</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCcw size={15} />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus size={15} />
            Add User
          </Button>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="px-4 py-3 bg-white border-b border-[#E5E7EB] sticky top-14 md:top-0 z-10 space-y-2">
        <Input
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          leadingIcon={<Search size={16} />}
        />
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {ROLE_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRoleFilter(opt.value)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                roleFilter === opt.value
                  ? 'bg-[#111827] text-white'
                  : 'bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-2 flex items-center gap-2">
        <span className="text-[12px] text-[#9CA3AF]">
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
          {roleFilter && ` · ${ROLES.find(r => r.value === roleFilter)?.label}`}
        </span>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto pb-24">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-[72px] rounded-2xl bg-[#F3F4F6] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Users size={40} className="text-[#D1D5DB]" />
            <p className="text-[#9CA3AF] text-sm">No users found</p>
          </div>
        ) : (
          <motion.div
            variants={stagger.container}
            initial="hidden"
            animate="show"
            className="p-4 space-y-2"
          >
            {filtered.map(user => (
              <motion.div
                key={user.id}
                variants={fadeUp}
                className="bg-white rounded-2xl border border-[#E5E7EB] px-4 py-3 flex items-center gap-3"
                style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)', opacity: user.is_active ? 1 : 0.55 }}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: ROLES.find(r => r.value === user.role)?.color ?? '#9CA3AF' }}
                >
                  {user.full_name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-bold text-[#111827] truncate">{user.full_name}</p>
                    {roleBadge(user.role)}
                    {!user.is_active && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B7280] truncate">{user.email}</p>
                  {user.zone_id && (
                    <p className="text-[10px] text-[#9CA3AF]">
                      Zone {user.zone_id} — {ZONES.find(z => z.id === user.zone_id)?.name}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditUser(user)}
                    className="w-8 h-8 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center hover:border-[#111827] hover:text-[#111827] transition-colors"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteUser(user)}
                    className="w-8 h-8 rounded-xl bg-[#FFF5F5] border border-red-100 flex items-center justify-center hover:border-red-400 hover:text-red-500 transition-colors text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {(showCreate || editUser) && (
          <UserModal editUser={editUser} onClose={closeModal} onSuccess={onSuccess} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {deleteUser && (
          <DeleteConfirm user={deleteUser} onClose={() => setDeleteUser(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
