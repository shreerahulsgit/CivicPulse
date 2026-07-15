/**
 * pages/citizen/ForumPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Zone Community Forum — neutral clean design (white/grey/black).
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PaperPlaneTilt,
  PushPin,
  Trash,
  Users,
  WifiHigh,
  WifiSlash,
  CaretDown,
  CaretUp,
  ChatCircleText,
  WarningCircle,
  ArrowsClockwise,
  MapPin,
  MapTrifold,
  CircleNotch,
  CheckCircle,
  ArrowLeft,
} from '@phosphor-icons/react'
import { useZoneForum }  from '@/hooks/useZoneForum'
import { useAuthStore }  from '@/store/authStore'
import { forumApi }      from '@/api/forum'
import type { ZoneOption } from '@/api/forum'
import { Skeleton }      from '@/components/ui/Skeleton'
import type { ForumMessage } from '@/api/forum'
import { cn } from '@/lib/utils'
import { useNavigate as useNav } from 'react-router-dom'

// ── Role helpers ──────────────────────────────────────────────────────────────

function roleBadge(role: string) {
  if (role === 'zonal_officer') return { label: 'Zonal Officer', bg: '#DBEAFE', color: '#1D4ED8' }
  if (role === 'ward_officer')  return { label: 'Ward Officer',  bg: '#DCFCE7', color: '#166534' }
  if (role === 'admin')         return { label: 'Admin',         bg: '#F3F4F6', color: '#111827' }
  return null
}

function isOfficerRole(role: string) {
  return ['ward_officer', 'zonal_officer', 'admin'].includes(role)
}

function timeLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (diffMin < 1)    return 'just now'
  if (diffMin < 60)   return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  return d.toLocaleDateString()
}

function avatarLetters(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ── Pinned Bar ────────────────────────────────────────────────────────────────

function PinnedBar({ pinned }: { pinned: ForumMessage[] }) {
  const [expanded, setExpanded] = useState(false)
  if (!pinned.length) return null

  return (
    <div className="mx-3 mt-2 mb-1 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <PushPin size={11} weight="fill" color="#D97706" className="shrink-0" />
        <span className="text-[11px] font-bold text-[#92400E] uppercase tracking-wider flex-1">
          {pinned.length} Pinned {pinned.length === 1 ? 'Message' : 'Messages'}
        </span>
        {expanded
          ? <CaretUp size={13} weight="bold" color="#D97706" />
          : <CaretDown size={13} weight="bold" color="#D97706" />
        }
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-[#FDE68A]"
          >
            {pinned.map(m => (
              <div key={m.id} className="px-3 py-2 border-b border-[#FDE68A]/50 last:border-0">
                <p className="text-[11px] font-semibold text-[#92400E]">{m.user_name}</p>
                <p className="text-[12px] text-[#374151] leading-snug line-clamp-2">{m.content}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg, isMine, canModerate, onDelete, onPin,
}: {
  msg: ForumMessage
  isMine: boolean
  canModerate: boolean
  onDelete: (id: string) => void
  onPin:    (id: string) => void
}) {
  const navigate = useNav()
  const [showActions, setShowActions] = useState(false)
  const badge = roleBadge(msg.user_role)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-2 px-3 mb-3', isMine ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      {!isMine && (
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-bold mt-1',
          isOfficerRole(msg.user_role)
            ? 'bg-[#111827] text-white'
            : 'bg-[#F3F4F6] text-[#374151]',
        )}>
          {msg.avatar_url
            ? <img src={msg.avatar_url} className="w-8 h-8 rounded-xl object-cover" alt="" />
            : avatarLetters(msg.user_name)
          }
        </div>
      )}

      <div className={cn('max-w-[78%] flex flex-col', isMine ? 'items-end' : 'items-start')}>
        {/* Name + badge */}
        {!isMine && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-semibold text-[#374151]">{msg.user_name}</span>
            {badge && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: badge.bg, color: badge.color }}
              >
                {badge.label}
              </span>
            )}
            {msg.is_pinned && <PushPin size={9} weight="fill" color="#D97706" />}
          </div>
        )}

        {/* Bubble */}
        <button
          onDoubleClick={() => (isMine || canModerate) && setShowActions(s => !s)}
          className={cn(
            'text-[13px] leading-relaxed px-3.5 py-2.5 rounded-2xl text-left',
            isMine
              ? 'bg-[#111827] text-white rounded-tr-sm'
              : 'bg-white text-[#111827] rounded-tl-sm border border-[#E5E7EB]',
          )}
          style={isMine ? {} : { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          {msg.content}
        </button>

        {/* Complaint ref */}
        {msg.complaint_ref && (
          <button
            onClick={() => navigate(`/complaints/${msg.complaint_ref}`)}
            className="mt-1 flex items-center gap-1 text-[10px] text-[#374151] bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg px-2 py-0.5 font-medium"
          >
            View linked complaint →
          </button>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-[#9CA3AF] mt-1 px-0.5">{timeLabel(msg.created_at)}</span>

        {/* Actions */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex gap-2 mt-1"
            >
              {canModerate && (
                <button
                  onClick={() => { onPin(msg.id); setShowActions(false) }}
                  className="flex items-center gap-1 text-[10px] text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] rounded-lg px-2 py-1 font-medium"
                >
                  <PushPin size={9} weight="fill" />
                  {msg.is_pinned ? 'Unpin' : 'Pin'}
                </button>
              )}
              {(isMine || canModerate) && (
                <button
                  onClick={() => { onDelete(msg.id); setShowActions(false) }}
                  className="flex items-center gap-1 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 font-medium"
                >
                  <Trash size={9} weight="bold" />
                  Delete
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Zone Picker ───────────────────────────────────────────────────────────────

function ZonePicker({ onSelect }: { onSelect: (zone: { zone_id: number; zone_name: string }) => void }) {
  const [zones,     setZones]     = useState<ZoneOption[]>([])
  const [gpsStatus, setGpsStatus] = useState<'idle'|'detecting'|'done'|'error'>('idle')
  const [selected,  setSelected]  = useState<number | null>(null)
  const [gpsResult, setGpsResult] = useState<{ zone_id: number; zone_name: string } | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    forumApi.listZones().then(setZones).catch(() => {})
  }, [])

  const detectGPS = async () => {
    if (!navigator.geolocation) { setGpsStatus('error'); return }
    setGpsStatus('detecting')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const zone = await forumApi.resolveZoneFromGPS(pos.coords.latitude, pos.coords.longitude)
          setGpsResult(zone); setSelected(zone.zone_id); setGpsStatus('done')
        } catch { setGpsStatus('error') }
      },
      () => setGpsStatus('error'),
      { timeout: 10000 }
    )
  }

  const handleJoin = () => {
    if (gpsResult && selected === gpsResult.zone_id) {
      onSelect(gpsResult)
    } else if (selected) {
      const zone = zones.find(z => z.zone_id === selected)
      if (zone) onSelect({ zone_id: zone.zone_id, zone_name: zone.zone_name })
    }
  }

  return (
    <div className="min-h-dvh bg-[#F9FAFB] flex flex-col">
      {/* Header */}
      <div className="bg-[#111827] px-4 pt-14 pb-8 flex flex-col items-center" style={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <button onClick={() => navigate(-1)} className="absolute top-5 left-4 text-white/60">
          <ArrowLeft size={22} weight="bold" />
        </button>
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
          <ChatCircleText size={26} weight="duotone" color="white" />
        </div>
        <h1 className="text-white text-xl font-bold mb-1">Join Your Zone's Forum</h1>
        <p className="text-white/50 text-sm text-center leading-relaxed">
          Chat with residents, ward officers, and your zonal officer about local issues.
        </p>
      </div>

      <div className="flex-1 flex flex-col px-4 pt-6 pb-6 max-w-md mx-auto w-full">
        {/* GPS Option */}
        <button
          onClick={detectGPS}
          disabled={gpsStatus === 'detecting'}
          className={cn(
            'w-full flex items-center gap-4 p-4 rounded-2xl border mb-4 text-left transition-all',
            gpsStatus === 'done'
              ? 'bg-[#DCFCE7] border-[#86EFAC]'
              : 'bg-white border-[#E5E7EB] hover:border-[#D1D5DB] active:scale-[0.98]',
          )}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            gpsStatus === 'done' ? 'bg-[#16A34A]' : 'bg-[#F3F4F6]',
          )}>
            {gpsStatus === 'detecting'
              ? <CircleNotch size={18} weight="bold" color="#111827" className="animate-spin" />
              : gpsStatus === 'done'
              ? <CheckCircle size={18} weight="fill" color="white" />
              : <MapPin size={18} weight="duotone" color="#374151" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#111827]">
              {gpsStatus === 'detecting' ? 'Detecting location…'
                : gpsStatus === 'done'  ? `Detected: ${gpsResult?.zone_name}`
                : gpsStatus === 'error' ? 'GPS failed — try manual'
                : 'Use My Location (GPS)'}
            </p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Automatically detect your zone</p>
          </div>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[#E5E7EB]" />
          <span className="text-[11px] text-[#9CA3AF] font-medium">or choose manually</span>
          <div className="flex-1 h-px bg-[#E5E7EB]" />
        </div>

        {/* Zone list */}
        <div className="space-y-2 flex-1 overflow-y-auto">
          {zones.length === 0 && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          )}
          {zones.map(zone => (
            <button
              key={zone.zone_id}
              onClick={() => { setSelected(zone.zone_id); setGpsResult(null) }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all bg-white',
                selected === zone.zone_id && !gpsResult
                  ? 'border-[#111827] shadow-sm'
                  : 'border-[#E5E7EB] hover:border-[#D1D5DB]',
              )}
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
                <MapTrifold size={14} weight="duotone" color="#374151" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#111827]">{zone.zone_name}</p>
                <p className="text-[10px] text-[#9CA3AF]">Zone {zone.zone_number}</p>
              </div>
              {selected === zone.zone_id && !gpsResult && (
                <CheckCircle size={16} weight="fill" color="#111827" />
              )}
            </button>
          ))}
        </div>

        {/* Join button */}
        <motion.button
          onClick={handleJoin}
          disabled={!selected}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'w-full mt-5 py-3.5 rounded-2xl text-[14px] font-bold transition-all',
            selected ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#9CA3AF]',
          )}
        >
          Join Forum →
        </motion.button>

        <p className="text-center text-[10px] text-[#9CA3AF] mt-3">
          You can switch zones anytime from your profile.
        </p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ForumPage() {
  const { user } = useAuthStore()
  const {
    messages, pinned, isConnected, isLoading,
    zoneName, zoneId, needsZonePick, setZone,
    sendMessage, deleteMsg, pinMsg, loadMore, hasMore,
  } = useZoneForum()

  const [draft,   setDraft]   = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const canModerate = isOfficerRole(user?.role ?? '')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = useCallback(async () => {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setDraft('')
    try { await sendMessage(content) }
    finally { setSending(false); inputRef.current?.focus() }
  }, [draft, sending, sendMessage])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (!isLoading && needsZonePick) return <ZonePicker onSelect={setZone} />

  if (isLoading && !zoneId) {
    return (
      <div className="min-h-dvh bg-[#F9FAFB] flex flex-col items-center justify-center gap-3">
        <CircleNotch size={28} weight="bold" color="#111827" className="animate-spin" />
        <p className="text-[#6B7280] text-sm">Connecting to forum…</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#F9FAFB] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB]" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-xl bg-[#111827] flex items-center justify-center shrink-0">
            <ChatCircleText size={16} weight="duotone" color="white" />
          </div>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold text-[#111827]">{zoneName} Forum</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isConnected
                ? <WifiHigh size={10} weight="bold" color="#16A34A" />
                : <WifiSlash size={10} weight="bold" color="#D97706" />
              }
              <span className={`text-[10px] font-semibold ${isConnected ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>
                {isConnected ? 'Live' : 'Reconnecting…'}
              </span>
              <span className="text-[10px] text-[#9CA3AF] ml-1">
                · Public Zone Forum
              </span>
            </div>
          </div>
          <Users size={16} weight="duotone" color="#9CA3AF" />
        </div>
        <PinnedBar pinned={pinned} />
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-3">
        {hasMore && !isLoading && messages.length > 0 && (
          <button
            onClick={loadMore}
            className="w-full text-[11px] text-[#374151] font-semibold py-2 text-center flex items-center justify-center gap-1"
          >
            <ArrowsClockwise size={11} weight="bold" />
            Load older messages
          </button>
        )}

        {isLoading && (
          <div className="space-y-4 px-3 pt-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
                <Skeleton className="h-12 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mb-4">
              <ChatCircleText size={28} weight="duotone" color="#9CA3AF" />
            </div>
            <p className="text-[#111827] font-semibold mb-1">Start the conversation!</p>
            <p className="text-[#9CA3AF] text-sm">Be the first to post in {zoneName}'s forum.</p>
          </div>
        )}

        {!isLoading && messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMine={msg.user_id === user?.id}
            canModerate={canModerate}
            onDelete={deleteMsg}
            onPin={pinMsg}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="sticky bottom-16 z-20 bg-white border-t border-[#E5E7EB] px-3 py-2.5" style={{ boxShadow: '0 -1px 4px rgba(0,0,0,0.04)' }}>
        {!isConnected && (
          <div className="flex items-center gap-1.5 mb-2 text-[10px] text-[#92400E] bg-[#FEF3C7] rounded-lg px-3 py-1.5 border border-[#FDE68A] font-medium">
            <WarningCircle size={11} weight="fill" color="#D97706" />
            Reconnecting… Messages will send when back online.
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Message your zone…"
            rows={1}
            maxLength={1000}
            className="flex-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl px-3.5 py-2.5 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] outline-none focus:border-[#D1D5DB] resize-none min-h-[40px] max-h-[120px] leading-relaxed"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all',
              draft.trim() && !sending
                ? 'bg-[#111827] text-white'
                : 'bg-[#F3F4F6] text-[#D1D5DB]',
            )}
          >
            {sending
              ? <CircleNotch size={16} weight="bold" className="animate-spin" />
              : <PaperPlaneTilt size={16} weight="bold" />
            }
          </button>
        </div>
        {draft.length > 800 && (
          <p className="text-[10px] text-[#D97706] mt-1 text-right font-medium">{1000 - draft.length} chars left</p>
        )}
      </div>
    </div>
  )
}
