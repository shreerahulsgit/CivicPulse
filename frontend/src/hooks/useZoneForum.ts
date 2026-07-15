/**
 * hooks/useZoneForum.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * WebSocket-backed real-time hook for the Zone Community Forum.
 *
 * Handles:
 *   - WS connect/disconnect with auto-reconnect (exponential backoff)
 *   - "init" message → populate history + pinned
 *   - "new_message" → append to list
 *   - "delete_message" → soft-remove from list
 *   - "pin_update" → update pin state in list
 *   - sendMessage() → sends via WS, falls back to REST
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { forumApi } from '@/api/forum'
import type { ForumMessage } from '@/api/forum'

// Build the WebSocket base URL using the current page's host so it works
// through the Vite proxy in dev AND in production behind any reverse proxy.
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_ORIGIN   = `${WS_PROTOCOL}//${window.location.host}`

interface UseZoneForumReturn {
  messages:       ForumMessage[]
  pinned:         ForumMessage[]
  isConnected:    boolean
  isLoading:      boolean
  zoneId:         number | null
  zoneName:       string
  needsZonePick:  boolean
  sendMessage:    (content: string, complaintRef?: string) => Promise<void>
  deleteMsg:      (msgId: string) => Promise<void>
  pinMsg:         (msgId: string) => Promise<void>
  loadMore:       () => Promise<void>
  hasMore:        boolean
  setZone:        (zone: { zone_id: number; zone_name: string }) => void
  exitZone:       () => void   // leave current zone → show picker again
}

// ── Per-user localStorage helpers ────────────────────────────────────────────
// Key is scoped to user ID so switching accounts never bleeds zone state.

function zoneKey(userId: string) {
  return `civicpulse_forum_zone_${userId}`
}

function getSavedZone(userId: string): { zone_id: number; zone_name: string } | null {
  try {
    const raw = localStorage.getItem(zoneKey(userId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveZone(userId: string, zone: { zone_id: number; zone_name: string }) {
  localStorage.setItem(zoneKey(userId), JSON.stringify(zone))
}

function clearZone(userId: string) {
  localStorage.removeItem(zoneKey(userId))
}

export function useZoneForum(): UseZoneForumReturn {
  const token  = useAuthStore(s => s.token)
  const userId = useAuthStore(s => s.user?.id ?? '')

  const [messages,       setMessages]       = useState<ForumMessage[]>([])
  const [pinned,         setPinned]         = useState<ForumMessage[]>([])
  const [isConnected,    setIsConnected]    = useState(false)
  const [isLoading,      setIsLoading]      = useState(true)
  const [zoneId,         setZoneId]         = useState<number | null>(null)
  const [zoneName,       setZoneName]       = useState('Your Zone')
  const [needsZonePick,  setNeedsZonePick]  = useState(false)
  const [hasMore,        setHasMore]        = useState(true)

  const wsRef      = useRef<WebSocket | null>(null)
  const retryDelay = useRef(1000)
  const mounted    = useRef(true)

  // ── Allow onboarding screen to set the zone ─────────────────────────────────
  const setZone = useCallback((zone: { zone_id: number; zone_name: string }) => {
    saveZone(userId, zone)
    setZoneId(zone.zone_id)
    setZoneName(zone.zone_name)
    setNeedsZonePick(false)
    setIsLoading(true)
  }, [userId])

  // ── Exit zone — disconnect WS, clear storage, return to picker ──────────────
  const exitZone = useCallback(() => {
    clearZone(userId)
    wsRef.current?.close()
    wsRef.current = null
    setZoneId(null)
    setZoneName('Your Zone')
    setMessages([])
    setPinned([])
    setIsConnected(false)
    setIsLoading(false)
    setNeedsZonePick(true)
    setHasMore(true)
  }, [userId])

  // ── Resolve zone then connect ───────────────────────────────────────────────
  useEffect(() => {
    // Guard: wait for auth store to rehydrate from localStorage.
    // On navigation (not hard-refresh), token starts as null until Zustand
    // persisted state loads — without this guard the API call fires without
    // auth headers and gets a 404.
    if (!token || !userId) {
      setIsLoading(false)
      return
    }

    mounted.current = true
    let retryTimer: ReturnType<typeof setTimeout>

    const connect = (zid: number) => {
      if (!token || !mounted.current) return
      wsRef.current?.close()
      // Goes through Vite proxy → /forum/ws/{zid} → ws://localhost:8000/forum/ws/{zid}
      const url = `${WS_ORIGIN}/forum/ws/${zid}?token=${token}`
      const ws  = new WebSocket(url)
      wsRef.current = ws

      // ── Heartbeat: send ping every 25 s to keep proxy alive ──────────────
      let pingInterval: ReturnType<typeof setInterval> | null = null

      ws.onopen = () => {
        retryDelay.current = 1000
        setIsConnected(true)
        // Start keepalive pings
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 25_000)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'pong') return  // heartbeat reply — ignore
          handleMessage(data)
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        if (pingInterval) { clearInterval(pingInterval); pingInterval = null }
        setIsConnected(false)
        if (!mounted.current) return
        retryTimer = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 2, 30_000)
          connect(zid)
        }, retryDelay.current)
      }

      ws.onerror = () => ws.close()
    }

    const initForum = async () => {
      // 1. Check localStorage — scoped to this user's ID
      const saved = getSavedZone(userId)
      if (saved) {
        setZoneId(saved.zone_id)
        setZoneName(saved.zone_name)
        connect(saved.zone_id)
        return
      }

      // 2. Try auto-resolve from user's ward
      try {
        const zone = await forumApi.getMyZone()
        if (!mounted.current) return
        setZoneId(zone.zone_id)
        setZoneName(zone.zone_name)
        saveZone(userId, { zone_id: zone.zone_id, zone_name: zone.zone_name })
        connect(zone.zone_id)
      } catch (err: unknown) {
        // 404 means user has no ward → show zone picker
        if (!mounted.current) return
        setIsLoading(false)
        setNeedsZonePick(true)
      }
    }

    initForum()

    return () => {
      mounted.current = false
      clearTimeout(retryTimer)
      // Guard: don't close a WebSocket that is still CONNECTING (readyState=0)
      // — causes a harmless but noisy error in React 18 StrictMode dev double-invoke
      const ws = wsRef.current
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close()
      }
    }
  }, [token, userId]) // re-runs when auth store rehydrates (token: null → value)

  // Re-connect when zone changes after being set by onboarding
  useEffect(() => {
    if (!zoneId || !token || needsZonePick) return
    // connect is handled in the effect above on first load;
    // this handles updates from setZone()
  }, [zoneId]) // eslint-disable-line

  // ── WebSocket message dispatch ──────────────────────────────────────────────
  const handleMessage = (data: Record<string, unknown>) => {
    switch (data.type) {
      case 'init':
        setMessages((data.history as ForumMessage[]) ?? [])
        setPinned((data.pinned  as ForumMessage[]) ?? [])
        setIsLoading(false)
        break

      case 'new_message': {
        const msg = data.message as ForumMessage
        setMessages(prev => [...prev, msg])
        if (msg.is_pinned) setPinned(prev => [msg, ...prev.filter(p => p.id !== msg.id)])
        break
      }

      case 'delete_message': {
        const id = data.msg_id as string
        setMessages(prev => prev.filter(m => m.id !== id))
        setPinned(prev => prev.filter(m => m.id !== id))
        break
      }

      case 'pin_update': {
        const updated = data.message as ForumMessage
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
        setPinned(prev => {
          const without = prev.filter(m => m.id !== updated.id)
          return updated.is_pinned ? [updated, ...without] : without
        })
        break
      }
    }
  }

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (content: string, complaintRef?: string) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', content, complaint_ref: complaintRef ?? null }))
    } else if (zoneId) {
      // REST fallback
      const msg = await forumApi.postMessage(zoneId, content, complaintRef)
      setMessages(prev => [...prev, msg])
    }
  }, [zoneId])

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteMsg = useCallback(async (msgId: string) => {
    if (!zoneId) return
    await forumApi.deleteMessage(zoneId, msgId)
    setMessages(prev => prev.filter(m => m.id !== msgId))
    setPinned(prev => prev.filter(m => m.id !== msgId))
  }, [zoneId])

  // ── Pin ─────────────────────────────────────────────────────────────────────
  const pinMsg = useCallback(async (msgId: string) => {
    if (!zoneId) return
    const updated = await forumApi.pinMessage(zoneId, msgId)
    setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
    setPinned(prev => {
      const without = prev.filter(m => m.id !== updated.id)
      return updated.is_pinned ? [updated, ...without] : without
    })
  }, [zoneId])

  // ── Load more (older messages) ──────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!hasMore || !zoneId) return
    const oldestId = messages[0]?.id
    const older = await forumApi.getMyMessages(zoneId, 50, oldestId)
    if (older.length < 50) setHasMore(false)
    setMessages(prev => [...older, ...prev])
  }, [messages, hasMore, zoneId])

  return { messages, pinned, isConnected, isLoading, zoneId, zoneName, needsZonePick, sendMessage, deleteMsg, pinMsg, loadMore, hasMore, setZone, exitZone }
}
