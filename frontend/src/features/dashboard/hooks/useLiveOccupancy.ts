/**
 * useLiveOccupancy
 *
 * Seeds the occupancy state from a REST snapshot, then keeps it live via
 * the ws/occupancy/ WebSocket channel.  Throttles incoming events to avoid
 * excessive re-renders (max one update per 3 s per practitioner).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getLiveOccupancy } from '../api/dashboard.api';
import type { OccupancyEntry, OccupancyUpdate } from '../types/dashboard.types';

const WS_BASE        = import.meta.env.VITE_WS_URL ?? 'ws://127.0.0.1:8000';
const WS_MAX_RETRIES = 5;
const WS_RECONNECT_MS = 2_000;
const THROTTLE_MS     = 3_000;

export const useLiveOccupancy = () => {
  const [snapshot,   setSnapshot]   = useState<OccupancyEntry[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef          = useRef<WebSocket | null>(null);
  const isMountedRef   = useRef(true);
  const retryCountRef  = useRef(0);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tracks the last time we applied an update for each practitioner. */
  const lastUpdateRef  = useRef<Record<number, number>>({});

  // ── Seed from REST snapshot ────────────────────────────────────────────────
  const fetchSnapshot = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getLiveOccupancy();
      if (isMountedRef.current) setSnapshot(res.snapshot);
    } catch {
      // Non-fatal — WebSocket will keep data fresh
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  // ── Apply a throttled WebSocket update ───────────────────────────────────
  const applyUpdate = useCallback((update: OccupancyUpdate) => {
    const pid  = update.practitioner_id;
    const now  = Date.now();
    const last = lastUpdateRef.current[pid] ?? 0;

    if (now - last < THROTTLE_MS) return;   // throttle
    lastUpdateRef.current[pid] = now;

    setSnapshot(prev => {
      const idx = prev.findIndex(e => e.practitioner_id === pid);
      const entry: OccupancyEntry = {
        practitioner_id: pid,
        name:            update.name,
        status:          update.status,
        current_patient: update.current_patient,
        start_time:      update.start_time,
        service:         update.service,
        today_total:     idx >= 0 ? prev[idx].today_total : 0,
        today_completed: idx >= 0 ? prev[idx].today_completed : 0,
      };
      if (idx < 0) return [...prev, entry];
      const next = [...prev];
      next[idx] = entry;
      return next;
    });
  }, []);

  // ── WebSocket connection ──────────────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    if (!isMountedRef.current) return;
    if (retryCountRef.current >= WS_MAX_RETRIES) return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_BASE}/ws/occupancy/`, ['bearer', token]);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      retryCountRef.current = 0;
      if (isMountedRef.current) setWsConnected(true);
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(event.data as string) as OccupancyUpdate;
        if (data.type === 'OCCUPANCY_UPDATE') {
          applyUpdate(data);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => { /* handled by onclose */ };

    ws.onclose = (e) => {
      if (!isMountedRef.current) return;
      setWsConnected(false);

      if (e.code === 4001 || e.code === 4002 || e.code === 1000) return;

      retryCountRef.current += 1;
      const delay = WS_RECONNECT_MS * retryCountRef.current;
      retryTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) connectWebSocket();
      }, delay);
    };

    // Keepalive ping every 30 s
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);
    (ws as WebSocket & { _ping?: ReturnType<typeof setInterval> })._ping = ping;

  }, [applyUpdate]);

  // ── Mount / unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    fetchSnapshot();

    const initTimer = setTimeout(() => connectWebSocket(), 500);

    return () => {
      isMountedRef.current = false;
      clearTimeout(initTimer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

      const ws = wsRef.current as WebSocket & { _ping?: ReturnType<typeof setInterval> } | null;
      if (ws?._ping) clearInterval(ws._ping);
      if (ws && ws.readyState !== WebSocket.CLOSED) ws.close(1000);
    };
  }, [fetchSnapshot, connectWebSocket]);

  return { snapshot, isLoading, wsConnected, refetch: fetchSnapshot };
};
