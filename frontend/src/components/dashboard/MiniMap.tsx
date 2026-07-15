/**
 * src/components/dashboard/MiniMap.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive Leaflet map with:
 *  – CartoDB Voyager (colored, modern basemap)
 *  – Zoom in/out controls
 *  – Draggable/pannable
 *  – Custom SVG pin markers per status
 *  – Floating stats overlay
 *  – Expand to fullscreen modal
 *  – GCC boundary overlay
 */

import { useEffect, useRef, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  ArrowsOut,
  X,
  Shield,
} from '@phosphor-icons/react'
import { fadeUp } from '@/lib/motion'
import type { Complaint } from '@/types/complaint'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<string, { color: string; label: string }> = {
  submitted:            { color: '#374151', label: 'Submitted' },
  under_review:         { color: '#D97706', label: 'Under Review' },
  in_progress:          { color: '#2563EB', label: 'In Progress' },
  pending_verification: { color: '#EA580C', label: 'Pending' },
  resolved:             { color: '#16A34A', label: 'Resolved' },
  rejected:             { color: '#DC2626', label: 'Rejected' },
}

const GCC_CENTER: [number, number] = [13.0827, 80.2707]
const GCC_ZOOM   = 11

// ── Custom SVG drop-pin icon ──────────────────────────────────────────────────

function makePinIcon(L: typeof import('leaflet'), color: string) {
  const svg = `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.20"/></filter>
    <ellipse cx="14" cy="34" rx="4" ry="1.5" fill="rgba(0,0,0,0.15)"/>
    <path d="M14 2C8.477 2 4 6.477 4 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.523-4.477-10-10-10z"
      fill="${color}" stroke="white" stroke-width="2.2" filter="url(#s)"/>
    <circle cx="14" cy="12" r="4.5" fill="white" opacity="0.95"/>
  </svg>`
  return L.divIcon({
    html:       svg,
    className:  '',
    iconSize:   [28, 36],
    iconAnchor: [14, 36],
    popupAnchor:[0, -38],
  })
}

// ── Popup HTML ────────────────────────────────────────────────────────────────

function makePopup(c: Complaint): string {
  const s = STATUS[c.status] ?? STATUS.submitted
  return `<div style="padding:12px 14px;min-width:170px;font-family:system-ui,sans-serif">
    <p style="font-size:13px;font-weight:700;color:#111827;margin:0 0 3px;line-height:1.3">${c.title}</p>
    <p style="font-size:11px;color:#6B7280;margin:0 0 8px">${c.category?.name ?? ''}</p>
    <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;
      padding:3px 9px;border-radius:999px;
      background:${s.color}18;color:${s.color};border:1px solid ${s.color}33">
      <span style="width:6px;height:6px;border-radius:50%;background:${s.color};display:inline-block"></span>
      ${s.label}
    </span>
  </div>`
}

// ── Map initializer (shared between inline + modal) ───────────────────────────

interface MapOptions { interactive: boolean; zoom: number }

function initMap(
  L: typeof import('leaflet'),
  el: HTMLDivElement,
  mapped: Complaint[],
  opts: MapOptions
) {
  // Fix Vite icon paths
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl

  const map = L.map(el, {
    zoomControl:       opts.interactive,
    scrollWheelZoom:   opts.interactive,
    doubleClickZoom:   opts.interactive,
    touchZoom:         opts.interactive,
    dragging:          opts.interactive,
    attributionControl:false,
  })

  // CartoDB Voyager — full color, clean and modern
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    { maxZoom: 20, subdomains: 'abcd' }
  ).addTo(map)

  // GCC boundary
  fetch('/gcc_boundary.geojson')
    .then(r => r.json())
    .then(gj => {
      L.geoJSON(gj, {
        style: {
          color:       '#111827',
          weight:       2,
          opacity:      0.6,
          fillColor:   '#111827',
          fillOpacity:  0.04,
          dashArray:   '6, 5',
        },
      }).bindPopup(
        `<div style="padding:10px 12px;font-family:system-ui,sans-serif">
          <p style="font-size:12px;font-weight:700;color:#111827;margin:0">GCC Service Area</p>
          <p style="font-size:11px;color:#6B7280;margin:3px 0 0">Greater Chennai Corporation</p>
        </div>`,
        { maxWidth: 200 }
      ).addTo(map)
    })
    .catch(() => {})

  // Markers
  if (mapped.length > 0) {
    const bounds: [number, number][] = []
    mapped.slice(0, 40).forEach(c => {
      const lat = c.location.latitude
      const lng = c.location.longitude
      bounds.push([lat, lng])
      const color = STATUS[c.status]?.color ?? '#374151'
      L.marker([lat, lng], { icon: makePinIcon(L, color) })
        .bindPopup(makePopup(c), { maxWidth: 240, minWidth: 180 })
        .addTo(map)
    })
    if (bounds.length === 1) {
      map.setView(bounds[0], 15)
    } else {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [32, 32], maxZoom: 15 })
    }
  } else {
    map.setView(GCC_CENTER, opts.zoom)
  }

  return map
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MiniMapProps { complaints: Complaint[] }

// ── Component ─────────────────────────────────────────────────────────────────

export function MiniMap({ complaints }: MiniMapProps) {
  const miniRef    = useRef<HTMLDivElement>(null)
  const miniMap    = useRef<import('leaflet').Map | null>(null)
  const modalRef   = useRef<HTMLDivElement>(null)
  const modalMap   = useRef<import('leaflet').Map | null>(null)
  const [expanded, setExpanded] = useState(false)

  const mapped = useMemo(
    () => complaints.filter(c => c.location?.latitude && c.location?.longitude),
    [complaints]
  )

  const counts = useMemo(() => ({
    active:   complaints.filter(c => ['in_progress','under_review'].includes(c.status)).length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
    pending:  complaints.filter(c => c.status === 'pending_verification').length,
  }), [complaints])

  const activeLegend = useMemo(() =>
    Object.entries(STATUS).filter(([s]) => complaints.some(c => c.status === s)),
    [complaints]
  )

  // ── Init mini map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!miniRef.current || miniMap.current) return
    let mounted = true

    import('leaflet').then(L => {
      if (!mounted || !miniRef.current || miniMap.current) return
      miniMap.current = initMap(L, miniRef.current, mapped, {
        interactive: true,   // ✅ fully interactive
        zoom:        GCC_ZOOM,
      })
    })

    return () => {
      mounted = false
      miniMap.current?.remove()
      miniMap.current = null
    }
  }, [])

  // ── Init modal map when expanded ──────────────────────────────────────────
  useEffect(() => {
    if (!expanded || !modalRef.current || modalMap.current) return
    let mounted = true

    import('leaflet').then(L => {
      if (!mounted || !modalRef.current || modalMap.current) return
      modalMap.current = initMap(L, modalRef.current, mapped, {
        interactive: true,
        zoom:        GCC_ZOOM,
      })
      // Invalidate size after animation
      setTimeout(() => modalMap.current?.invalidateSize(), 200)
    })

    return () => {
      mounted = false
      modalMap.current?.remove()
      modalMap.current = null
    }
  }, [expanded])

  // ── Recenter mini map when data changes ────────────────────────────────────
  useEffect(() => {
    if (!miniMap.current || mapped.length === 0) return
    const lats = mapped.map(c => c.location.latitude)
    const lngs = mapped.map(c => c.location.longitude)
    const center: [number, number] = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ]
    miniMap.current.panTo(center, { animate: true, duration: 0.8 })
  }, [mapped.length])

  return (
    <>
      <motion.section variants={fadeUp}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 mb-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} weight="duotone" color="#111827" />
            <h2 className="text-[15px] font-bold text-[#111827] tracking-tight">
              Complaints Map
            </h2>
            {mapped.length > 0 && (
              <span className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
                {mapped.length} pins
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#F3F4F6] border border-[#E5E7EB]">
              <Shield size={10} weight="duotone" color="#374151" />
              <span className="text-[10px] font-semibold text-[#374151]">GCC Zone</span>
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 text-[13px] font-semibold text-[#111827] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-2.5 py-1 rounded-lg transition-colors"
            >
              <ArrowsOut size={13} weight="bold" />
              Expand
            </button>
          </div>
        </div>

        {/* Map container — 260px, interactive */}
        <div
          className="mx-4 rounded-2xl overflow-hidden border border-[#E5E7EB] relative"
          style={{ height: '260px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
        >
          <div ref={miniRef} className="w-full h-full" />

          {/* Floating stats overlay */}
          {complaints.length > 0 && (
            <div className="absolute top-2.5 left-2.5 z-[999] flex flex-col gap-1.5 pointer-events-none">
              {counts.active > 0 && (
                <div className="flex items-center gap-1.5 bg-white/95 rounded-lg px-2.5 py-1.5 shadow-sm border border-[#E5E7EB]">
                  <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />
                  <span className="text-[11px] font-semibold text-[#111827]">{counts.active} active</span>
                </div>
              )}
              {counts.resolved > 0 && (
                <div className="flex items-center gap-1.5 bg-white/95 rounded-lg px-2.5 py-1.5 shadow-sm border border-[#E5E7EB]">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
                  <span className="text-[11px] font-semibold text-[#111827]">{counts.resolved} resolved</span>
                </div>
              )}
            </div>
          )}

          {/* No complaints overlay */}
          {mapped.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[999]">
              <div className="bg-white rounded-2xl px-4 py-3 shadow-md border border-[#E5E7EB] flex flex-col items-center gap-1.5">
                <MapPin size={20} weight="duotone" color="#9CA3AF" />
                <p className="text-[12px] font-semibold text-[#374151]">No complaints mapped yet</p>
                <p className="text-[11px] text-[#9CA3AF]">GCC service area shown</p>
              </div>
            </div>
          )}

          {/* Total badge */}
          {mapped.length > 0 && (
            <div
              className="absolute bottom-2.5 right-2.5 z-[999] bg-[#111827] text-white rounded-xl px-3 py-1.5 shadow-lg pointer-events-none"
            >
              <span className="text-[12px] font-bold">{mapped.length}</span>
              <span className="text-[10px] text-white/60 ml-1">pinned</span>
            </div>
          )}
        </div>

        {/* Legend */}
        {activeLegend.length > 0 && (
          <div className="flex items-center gap-2.5 px-4 mt-2.5 flex-wrap">
            <div className="flex items-center gap-1">
              <div
                className="w-5 h-1.5 rounded-full"
                style={{
                  background: 'repeating-linear-gradient(90deg,#374151 0,#374151 4px,transparent 4px,transparent 8px)',
                }}
              />
              <span className="text-[10px] text-[#9CA3AF] font-medium">GCC boundary</span>
            </div>
            {activeLegend.map(([status, { color, label }]) => (
              <div key={status} className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full border-[1.5px] border-white"
                  style={{ background: color, boxShadow: `0 0 0 1px ${color}` }}
                />
                <span className="text-[10px] text-[#9CA3AF] font-medium">
                  {label} ({complaints.filter(c => c.status === status).length})
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* ── Fullscreen Map Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="fixed inset-0 z-[9999] flex flex-col bg-white"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-white z-10 shrink-0">
              <div className="flex items-center gap-2">
                <MapPin size={18} weight="duotone" color="#111827" />
                <h2 className="text-[16px] font-bold text-[#111827]">Complaints Map</h2>
                {mapped.length > 0 && (
                  <span className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
                    {mapped.length} pins
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setExpanded(false)
                  modalMap.current?.remove()
                  modalMap.current = null
                }}
                className="w-9 h-9 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] flex items-center justify-center transition-colors"
              >
                <X size={18} weight="bold" color="#111827" />
              </button>
            </div>

            {/* Modal map — fills remaining space */}
            <div ref={modalRef} className="flex-1 w-full" />

            {/* Modal legend */}
            {activeLegend.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 border-t border-[#E5E7EB] bg-white flex-wrap shrink-0">
                {activeLegend.map(([status, { color, label }]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full border-[1.5px] border-white"
                      style={{ background: color, boxShadow: `0 0 0 1px ${color}` }}
                    />
                    <span className="text-[12px] text-[#374151] font-medium">
                      {label} ({complaints.filter(c => c.status === status).length})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
