/**
 * pages/citizen/ReportComplaintPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-step complaint submission — premium neutral design.
 *
 * Steps: Category → Details → Location → Photos
 */

import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Article,
  X,
  CheckCircle,
  WarningCircle,
  CaretRight,
  CaretLeft,
  PaperPlaneTilt,
  CircleNotch,
  ImageSquare,
  Warning,
  Drop,
  Lightning,
  Trash,
  ShieldCheck,
  SpeakerHigh,
  Tag,
  Camera,
  type Icon,
  type IconWeight,
} from '@phosphor-icons/react'

import { TopBar }                         from '@/components/layout/TopBar'
import { Input, Textarea } from '@/components/ui'
import { useCreateComplaint, useCategories } from '@/hooks/useComplaints'
import { useToast }                       from '@/components/ui/Toast'
import { ROUTES }                         from '@/router/routes'
import LocationPicker, { type LatLng, type GeoInfo } from '@/components/map/LocationPicker'
import { complaintsApi }                  from '@/api/complaints'

// ── Category icon map (Phosphor icons, no emojis) ─────────────────────────────

type PhosphorIcon = Icon

const CATEGORY_ICON: Record<string, { Icon: PhosphorIcon; bg: string; fg: string }> = {
  'Pothole':       { Icon: Warning,      bg: '#FEE2E2', fg: '#DC2626' },
  'Water Supply':  { Icon: Drop,         bg: '#DBEAFE', fg: '#2563EB' },
  'Electricity':   { Icon: Lightning,    bg: '#FEF3C7', fg: '#D97706' },
  'Sanitation':    { Icon: Trash,        bg: '#DCFCE7', fg: '#16A34A' },
  'Public Safety': { Icon: ShieldCheck,  bg: '#F1F5F9', fg: '#475569' },
  'Noise':         { Icon: SpeakerHigh,  bg: '#FCE7F3', fg: '#BE185D' },
  'Other':         { Icon: Tag,          bg: '#F3F4F6', fg: '#374151' },
}

function getCategoryMeta(name: string) {
  return CATEGORY_ICON[name] || { Icon: Tag, bg: '#F3F4F6', fg: '#374151' }
}

// ── Step bar ──────────────────────────────────────────────────────────────────

const STEPS = ['Category', 'Details', 'Location', 'Photos']

function StepBar({ current }: { current: number }) {
  return (
    <div className="px-4 pt-3 pb-4">
      {/* Progress track */}
      <div className="flex gap-1.5 mb-2.5">
        {STEPS.map((_, i) => (
          <motion.div
            key={i}
            className="h-1 rounded-full flex-1"
            animate={{
              background: i < current ? '#16A34A' : i === current ? '#111827' : '#E5E7EB',
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#111827]">
          Step {current + 1} of {STEPS.length} — {STEPS[current]}
        </span>
        <span className="text-[11px] text-[#9CA3AF] font-medium">
          {current < STEPS.length - 1 ? `${STEPS.length - 1 - current} left` : 'Last step'}
        </span>
      </div>
    </div>
  )
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormData {
  category_id:    number | null
  category_name:  string
  title:          string
  description:    string
  location:       LatLng | null
  address:        string
  ward_number:    string
  ward_name:      string
  zone_number:    string
  zone_name:      string
  image_urls:     string[]
  image_previews: string[]
}

const INITIAL: FormData = {
  category_id:    null,
  category_name:  '',
  title:          '',
  description:    '',
  location:       null,
  address:        '',
  ward_number:    '',
  ward_name:      '',
  zone_number:    '',
  zone_name:      '',
  image_urls:     [],
  image_previews: [],
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[22px] font-bold text-[#111827] leading-tight">{title}</h2>
      <p className="text-[13px] text-[#6B7280] mt-1">{sub}</p>
    </div>
  )
}

// ── Error row ──────────────────────────────────────────────────────────────────

function ErrorRow({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-1.5 text-red-600 text-[12px] font-medium mt-1.5">
      <WarningCircle size={13} weight="fill" />
      {msg}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportComplaintPage() {
  const navigate        = useNavigate()
  const { toast }       = useToast()
  const createMutation  = useCreateComplaint()
  const { data: categories, isLoading: categoriesLoading } = useCategories()

  const [step,      setStep]      = useState(0)
  const [form,      setForm]      = useState<FormData>(INITIAL)
  const [errors,    setErrors]    = useState<Partial<Record<keyof FormData, string>>>({})
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateStep(s: number): boolean {
    const e: Partial<Record<keyof FormData, string>> = {}
    if (s === 0 && !form.category_id)               e.category_id  = 'Select a category'
    if (s === 1) {
      if (!form.title.trim())                        e.title        = 'Title is required'
      if (form.title.trim().length < 10)             e.title        = 'At least 10 characters'
      if (!form.description.trim())                  e.description  = 'Description is required'
      if (form.description.trim().length < 20)       e.description  = 'Describe in more detail (min 20 chars)'
    }
    if (s === 2 && !form.location)                   e.location     = 'Drop a pin on the map or use GPS'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => { if (validateStep(step)) setStep(s => Math.min(s + 1, STEPS.length - 1)) }
  const back = () => { setErrors({}); setStep(s => Math.max(s - 1, 0)) }

  // ── Image upload ────────────────────────────────────────────────────────────

  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (form.image_urls.length + files.length > 5) {
      toast.error('Too many images', 'Maximum 5 images allowed.')
      return
    }
    setUploading(true)
    const fileArray = Array.from(files)
    const previews  = fileArray.map(f => URL.createObjectURL(f))
    try {
      const result = await complaintsApi.uploadImages(fileArray)
      const urls   = result.uploaded.map(u => u.secure_url)
      setForm(f => ({
        ...f,
        image_urls:     [...f.image_urls, ...urls],
        image_previews: [...f.image_previews, ...previews],
      }))
      toast.success('Uploaded!', `${result.count} photo(s) added.`)
    } catch {
      toast.error('Upload failed', 'Could not upload. Try again.')
    } finally {
      setUploading(false)
    }
  }, [form.image_urls.length, toast])

  const removeImage = (i: number) =>
    setForm(f => ({
      ...f,
      image_urls:     f.image_urls.filter((_, idx) => idx !== i),
      image_previews: f.image_previews.filter((_, idx) => idx !== i),
    }))

  // ── Location ────────────────────────────────────────────────────────────────

  const handleLocationChange = useCallback((loc: LatLng, address?: string, geoInfo?: GeoInfo) => {
    setForm(f => ({
      ...f,
      location:    loc,
      address:     address || f.address,
      ward_number: geoInfo?.ward_number || f.ward_number,
      ward_name:   geoInfo?.ward_name   || f.ward_name,
      zone_number: geoInfo?.zone_number || f.zone_number,
      zone_name:   geoInfo?.zone_name   || f.zone_name,
    }))
  }, [])

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.category_id || !form.location) return
    try {
      await createMutation.mutateAsync({
        title:       form.title,
        description: form.description,
        category_id: form.category_id,
        location: {
          latitude:  form.location.lat,
          longitude: form.location.lng,
          address:   form.address || undefined,
        },
        image_urls: form.image_urls.length > 0 ? form.image_urls : undefined,
      })
      toast.success('Submitted!', "We'll keep you updated.")
      navigate(ROUTES.CITIZEN_DASHBOARD)
    } catch {
      toast.error('Submission failed', 'Please try again.')
    }
  }

  const isLastStep   = step === STEPS.length - 1
  const isSubmitting = createMutation.isPending

  return (
    <div className="min-h-dvh bg-[#F9FAFB] flex flex-col">
      <TopBar
        title="Report Issue"
        showBack
        onBack={() => step > 0 ? back() : navigate(-1)}
      />

      <StepBar current={step} />

      {/* Steps */}
      <div className="flex-1 overflow-y-auto pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="px-4"
          >

            {/* ── Step 0: Category ──────────────────────────────────────── */}
            {step === 0 && (
              <div>
                <SectionHead
                  title="What's the issue?"
                  sub="Select the category that best describes the problem."
                />

                {categoriesLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <CircleNotch size={32} weight="bold" color="#111827" className="animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {categories?.map(cat => {
                      const { Icon, bg, fg } = getCategoryMeta(cat.name)
                      const selected = form.category_id === cat.id
                      return (
                        <motion.button
                          key={cat.id}
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={() => {
                            set('category_id', cat.id)
                            set('category_name', cat.name)
                          }}
                          className="relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-200 bg-white"
                          style={{
                            borderColor: selected ? '#111827' : '#E5E7EB',
                            boxShadow: selected ? '0 2px 12px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.04)',
                          }}
                        >
                          {/* Icon circle */}
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ background: bg }}
                          >
                            <Icon size={22} weight={'duotone' as IconWeight} color={fg} />
                          </div>
                          <span className="text-[13px] font-semibold text-[#111827] text-center leading-tight">
                            {cat.name}
                          </span>
                          {selected && (
                            <motion.div
                              layoutId="catCheck"
                              className="absolute top-2 right-2"
                            >
                              <CheckCircle size={18} weight="fill" color="#111827" />
                            </motion.div>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                )}

                {errors.category_id && <ErrorRow msg={errors.category_id} />}
              </div>
            )}

            {/* ── Step 1: Details ──────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5">
                <SectionHead
                  title="Describe the issue"
                  sub="Give a clear title and detailed description."
                />

                {/* Title */}
                <div>
                  <label className="flex items-center gap-1.5 text-[13px] font-semibold text-[#374151] mb-2">
                    <Article size={14} weight="bold" color="#374151" />
                    Issue Title
                  </label>
                  <Input
                    placeholder="e.g., Large pothole on Anna Salai near bus stop"
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                    error={errors.title}
                  />
                  <p className="text-[11px] text-[#9CA3AF] mt-1 text-right">{form.title.length}/200</p>
                </div>

                {/* Description */}
                <div>
                  <label className="flex items-center gap-1.5 text-[13px] font-semibold text-[#374151] mb-2">
                    <Article size={14} weight="bold" color="#374151" />
                    Description
                  </label>
                  <Textarea
                    placeholder="When did it start? How severe is it? Any danger to public?"
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    rows={5}
                    error={errors.description}
                  />
                  <p className="text-[11px] text-[#9CA3AF] mt-1 text-right">{form.description.length}/5000</p>
                </div>

                {/* Category reminder */}
                {form.category_name && (
                  <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-[#E5E7EB]">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: getCategoryMeta(form.category_name).bg }}
                    >
                      {(() => {
                        const { Icon, fg } = getCategoryMeta(form.category_name)
                        return <Icon size={14} weight="duotone" color={fg} />
                      })()}
                    </div>
                    <span className="text-[12px] font-medium text-[#374151]">{form.category_name}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Location ─────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                <SectionHead
                  title="Pin the location"
                  sub="Tap the map to drop a pin, or use GPS. Drag to adjust."
                />

                <LocationPicker
                  value={form.location}
                  onChange={handleLocationChange}
                  height="340px"
                />
                {form.location && (
                  <div
                    className="bg-white rounded-xl px-3.5 py-3 border border-[#E5E7EB] flex items-start gap-2.5"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <CheckCircle size={16} weight="fill" color="#16A34A" className="shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-[#16A34A] mb-0.5">Location pinned</p>
                      {form.address && (
                        <p className="text-[12px] text-[#374151] leading-snug break-words">{form.address}</p>
                      )}
                      {/* Ward & Zone badges */}
                      {(form.ward_name || form.zone_number) && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {form.ward_name && (
                            <span className="inline-flex items-center text-[10px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] px-2 py-0.5 rounded-md">
                              Ward {form.ward_number}{form.ward_name ? ` — ${form.ward_name}` : ''}
                            </span>
                          )}
                          {form.zone_number && (
                            <span className="inline-flex items-center text-[10px] font-semibold bg-[#F0FDF4] text-[#15803D] px-2 py-0.5 rounded-md">
                              Zone {form.zone_number}{form.zone_name ? ` — ${form.zone_name}` : ''}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-[10px] text-[#9CA3AF] mt-1 font-mono">
                        {form.location.lat.toFixed(6)}, {form.location.lng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                )}


                {errors.location && <ErrorRow msg={errors.location} />}

              </div>
            )}

            {/* ── Step 3: Photos ───────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-5">
                <SectionHead
                  title="Add photos"
                  sub="Upload up to 5 photos. Officers use them to assess faster."
                />

                {/* Big upload zone (shown when no photos yet) */}
                {form.image_previews.length === 0 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-[#D1D5DB] bg-white hover:border-[#111827] hover:bg-[#F9FAFB] transition-all active:scale-[0.99]"
                  >
                    {uploading
                      ? <CircleNotch size={32} weight="bold" color="#111827" className="animate-spin" />
                      : <Camera size={36} weight="duotone" color="#9CA3AF" />
                    }
                    <div className="text-center">
                      <p className="text-[13px] font-semibold text-[#374151]">
                        {uploading ? 'Uploading…' : 'Tap to add photos'}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5">JPG · PNG · WEBP · Max 10 MB each</p>
                    </div>
                  </button>
                )}

                {/* Photo grid */}
                {form.image_previews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5">
                    {form.image_previews.map((preview, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-[#E5E7EB]">
                        <img src={preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1 hover:bg-black/80 transition-colors"
                        >
                          <X size={12} color="white" weight="bold" />
                        </button>
                      </div>
                    ))}

                    {/* Add more */}
                    {form.image_previews.length < 5 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="aspect-square rounded-xl border-2 border-dashed border-[#D1D5DB] flex flex-col items-center justify-center gap-1 hover:border-[#111827] hover:bg-[#F3F4F6] transition-all"
                      >
                        {uploading
                          ? <CircleNotch size={20} weight="bold" color="#111827" className="animate-spin" />
                          : <ImageSquare size={22} weight="duotone" color="#9CA3AF" />
                        }
                        <span className="text-[9px] font-semibold text-[#9CA3AF]">Add more</span>
                      </button>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={e => handleImageUpload(e.target.files)}
                />

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-[#9CA3AF] mb-1.5">
                    <span>{form.image_urls.length} of 5 uploaded</span>
                    <span>{5 - form.image_urls.length} remaining</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
                    <motion.div
                      className="h-full bg-[#111827] rounded-full"
                      animate={{ width: `${(form.image_urls.length / 5) * 100}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </div>

                {/* Skip note */}
                <p className="text-center text-[12px] text-[#9CA3AF]">
                  Photos are optional — you can still submit without them.
                </p>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Bottom action bar ──────────────────────────────────────────── */}
      <div
        className="fixed bottom-[var(--bottom-nav-h)] md:bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E7EB] px-4 py-3"
        style={{ boxShadow: '0 -1px 8px rgba(0,0,0,0.06)' }}
      >
        <div className="flex gap-3 max-w-lg mx-auto">
          {step > 0 && (
            <button
              onClick={back}
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-[#E5E7EB] text-[13px] font-semibold text-[#374151] hover:bg-[#F9FAFB] transition-colors shrink-0"
            >
              <CaretLeft size={16} weight="bold" />
              Back
            </button>
          )}

          {isLastStep ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#111827] text-white text-[14px] font-bold hover:bg-[#1F2937] disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <CircleNotch size={17} weight="bold" className="animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <PaperPlaneTilt size={17} weight="bold" />
                  Submit Complaint
                </>
              )}
            </button>
          ) : (
            <button
              onClick={next}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#111827] text-white text-[14px] font-bold hover:bg-[#1F2937] transition-all active:scale-[0.98]"
            >
              Continue
              <CaretRight size={16} weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
