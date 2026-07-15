/**
 * components/map/LocationPicker.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Enhanced interactive location picker:
 *  – CartoDB Positron clean basemap
 *  – Custom animated SVG pin marker
 *  – Pulse ring on selected location
 *  – GPS detect with Phosphor icons
 *  – Address bar at bottom
 *  – GCC boundary overlay
 *  – Leaflet zoom controls (custom styled via CSS)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, GeoJSON, useMapEvents, useMap } from 'react-leaflet'
import type { GeoJsonObject } from 'geojson'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  NavigationArrow,
  CircleNotch,
  Shield,
  MapPin,
  CheckCircle,
} from '@phosphor-icons/react'

// Fix Leaflet default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon   from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// @ts-expect-error - Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
})

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number
  lng: number
}

export interface GeoInfo {
  ward_id?:    number
  ward_number?: string
  ward_name?:  string
  zone_id?:    number
  zone_number?: string
  zone_name?:  string
}

interface LocationPickerProps {
  value:    LatLng | null
  onChange: (loc: LatLng, address?: string, geoInfo?: GeoInfo) => void
  height?:  string
}

// ── Custom pin icon ───────────────────────────────────────────────────────────

const SELECTED_PIN = L.divIcon({
  html: `
    <div style="position:relative;width:36px;height:44px;display:flex;justify-content:center">
      <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
        <filter id="drop" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.22"/>
        </filter>
        <ellipse cx="18" cy="41" rx="5" ry="2" fill="rgba(0,0,0,0.12)"/>
        <path d="M18 4C11.373 4 6 9.373 6 16c0 8 12 24 12 24s12-16 12-24c0-6.627-5.373-12-12-12z"
          fill="#111827" stroke="white" stroke-width="2" filter="url(#drop)"/>
        <circle cx="18" cy="16" r="5" fill="white" opacity="0.95"/>
      </svg>
    </div>`,
  className: '',
  iconSize:   [36, 44],
  iconAnchor: [18, 44],
  popupAnchor:[0, -44],
})

// ── Reverse geocoder ──────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    const a = data.address || {}

    // Build a full, rich address string
    const parts = [
      // House number + road/street name
      [a.house_number, a.road || a.pedestrian || a.footway].filter(Boolean).join(' '),
      // Neighbourhood / area
      a.neighbourhood || a.quarter || a.suburb || a.hamlet,
      // District / locality
      a.city_district || a.district || a.county,
      // City / town / village
      a.city || a.town || a.village || a.municipality,
      // State
      a.state,
      // Pincode
      a.postcode,
    ].filter(Boolean)

    return parts.length > 0
      ? parts.join(', ')
      : data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

// ── Ward / Zone resolver (calls backend /geo/resolve) ──────────────────────────

async function resolveWardZone(lat: number, lng: number): Promise<GeoInfo | null> {
  try {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const res = await fetch(`${apiBase}/geo/resolve?lat=${lat}&lng=${lng}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

function FlyTo({ center }: { center: LatLng }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([center.lat, center.lng], 17, { duration: 0.8 })
  }, [center.lat, center.lng, map])
  return null
}

function GccBoundary() {
  const [geoJson, setGeoJson] = useState<GeoJsonObject | null>(null)
  useEffect(() => {
    fetch('/gcc_boundary.geojson').then(r => r.json()).then(setGeoJson).catch(() => {})
  }, [])
  if (!geoJson) return null
  return (
    <GeoJSON
      data={geoJson}
      style={{
        color:       '#374151',
        weight:       2,
        opacity:      0.65,
        fillColor:   '#111827',
        fillOpacity:  0.04,
        dashArray:   '7, 5',
      }}
    />
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const CHENNAI_CENTER: LatLng = { lat: 13.0827, lng: 80.2707 }

export default function LocationPicker({
  value,
  onChange,
  height = '300px',
}: LocationPickerProps) {
  const [geoLoading, setGeoLoading] = useState(false)
  const [address, setAddress]       = useState<string>('')
  const [geoInfo, setGeoInfo]       = useState<GeoInfo | null>(null)
  const [flyTarget, setFlyTarget]   = useState<LatLng | null>(null)
  const [geocoding, setGeocoding]   = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePick = useCallback(async (lat: number, lng: number) => {
    const loc = { lat, lng }
    setFlyTarget(loc)
    setGeoInfo(null)
    onChange(loc)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    setGeocoding(true)
    debounceRef.current = setTimeout(async () => {
      // Run both in parallel for speed
      const [addr, geo] = await Promise.all([
        reverseGeocode(lat, lng),
        resolveWardZone(lat, lng),
      ])
      setAddress(addr)
      setGeoInfo(geo)
      onChange(loc, addr, geo ?? undefined)
      setGeocoding(false)
    }, 400)
  }, [onChange])

  const detectGPS = () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setFlyTarget(loc)
        setGeoInfo(null)
        setGeocoding(true)
        const [addr, geo] = await Promise.all([
          reverseGeocode(loc.lat, loc.lng),
          resolveWardZone(loc.lat, loc.lng),
        ])
        setAddress(addr)
        setGeoInfo(geo)
        onChange(loc, addr, geo ?? undefined)
        setGeoLoading(false)
        setGeocoding(false)
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const center = value || CHENNAI_CENTER

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-[#E5E7EB]"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={value ? 17 : 12}
        style={{ height, width: '100%' }}
        zoomControl
      >
        {/* CartoDB Voyager — full color, clean and modern */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution=""
          maxZoom={20}
          subdomains="abcd"
        />
        <GccBoundary />
        <ClickHandler onClick={handlePick} />
        {flyTarget && <FlyTo center={flyTarget} />}
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={SELECTED_PIN}
            draggable
            eventHandlers={{
              dragend: e => {
                const m = e.target as L.Marker
                const { lat, lng } = m.getLatLng()
                handlePick(lat, lng)
              },
            }}
          />
        )}
      </MapContainer>

      {/* ── GCC badge — top left ─────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-xl shadow-sm border border-[#E5E7EB]">
        <Shield size={11} weight="duotone" color="#374151" />
        <span className="text-[10px] font-semibold text-[#374151]">GCC Service Area</span>
      </div>

      {/* ── GPS button — top right ───────────────────────────────────────── */}
      <button
        type="button"
        onClick={detectGPS}
        disabled={geoLoading}
        className="absolute top-3 right-12 z-[1000] bg-white shadow-sm border border-[#E5E7EB] rounded-xl p-2 hover:bg-[#F3F4F6] transition-all active:scale-95 disabled:opacity-50"
        title="Detect my location"
        style={{ right: '50px' }}
      >
        {geoLoading
          ? <CircleNotch size={18} weight="bold" className="animate-spin text-[#111827]" />
          : <NavigationArrow size={18} weight="duotone" color="#111827" />
        }
      </button>

      {/* ── Instruction pill — shown when no pin ────────────────────────── */}
      {!value && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center z-[1000] pointer-events-none">
          <div className="bg-[#111827]/90 text-white text-[12px] font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
            <MapPin size={13} weight="fill" color="white" />
            Tap map to drop a pin
          </div>
        </div>
      )}

      {/* ── Address bar — bottom ─────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[1000] bg-white border-t border-[#E5E7EB] px-3.5 py-2.5 flex items-center gap-2.5"
        style={{ minHeight: '44px' }}
      >
        {geocoding ? (
          <>
            <CircleNotch size={14} weight="bold" className="animate-spin text-[#9CA3AF] shrink-0" />
            <span className="text-xs text-[#9CA3AF] font-medium">Getting address…</span>
          </>
        ) : address ? (
          <div className="flex flex-col flex-1 min-w-0 gap-0.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={13} weight="duotone" color="#16A34A" className="shrink-0" />
              <p className="text-[11px] text-[#374151] truncate font-medium flex-1">{address}</p>
            </div>
            {geoInfo && (
              <div className="flex items-center gap-2 ml-5">
                {geoInfo.ward_name && (
                  <span className="text-[10px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] px-1.5 py-0.5 rounded-md">
                    Ward {geoInfo.ward_number} — {geoInfo.ward_name}
                  </span>
                )}
                {geoInfo.zone_number && (
                  <span className="text-[10px] font-semibold bg-[#F0FDF4] text-[#15803D] px-1.5 py-0.5 rounded-md">
                    Zone {geoInfo.zone_number}{geoInfo.zone_name ? ` — ${geoInfo.zone_name}` : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <MapPin size={14} weight="duotone" color="#9CA3AF" className="shrink-0" />
            <p className="text-xs text-[#9CA3AF] font-medium">
              {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'No location selected'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
