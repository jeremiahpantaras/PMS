import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi } from '../services/notifications.api';
import type { Notification } from '../types/notifications.types';

const POLL_INTERVAL_MS  = 60_000;
const WS_BASE           = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000';
const WS_RECONNECT_MS   = 5_000;   // retry delay after disconnect
const WS_MAX_RETRIES    = 5;       // give up after 5 failed attempts

interface UseNotificationsReturn {
  notifications:    Notification[];
  unreadCount:      number;
  isLoading:        boolean;
  isLoadingMore:    boolean;
  hasMore:          boolean;
  fetchNotifications: () => Promise<void>;
  loadMore:         () => Promise<void>;
  markRead:         (id: number) => Promise<void>;
  markAllRead:      () => Promise<void>;
}

export function useNotifications(isOpen: boolean, onIncoming?: (n: Notification) => void): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [isLoading,     setIsLoading]     = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(false);

  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef          = useRef<WebSocket | null>(null);
  const retryCountRef  = useRef(0);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef   = useRef(true);
  const onIncomingRef  = useRef(onIncoming);

  // Keep ref fresh without re-triggering connectWebSocket
  useEffect(() => { onIncomingRef.current = onIncoming; }, [onIncoming]);

  // ── Fetch unread count ─────────────────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { unread_count } = await notificationsApi.getUnreadCount();
      setUnreadCount(unread_count);
    } catch { /* silent */ }
  }, []);

  // ── Fetch first page ───────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await notificationsApi.getAll({ page: 1 });
      setNotifications(response.results);
      setUnreadCount(response.results.filter(n => !n.is_read).length);
      setHasMore(!!response.next);
      setPage(1);
    } catch (err) {
      console.error('fetchNotifications error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Load more ──────────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await notificationsApi.getAll({ page: nextPage });
      setNotifications(prev => [...prev, ...response.results]);
      setHasMore(!!response.next);
      setPage(nextPage);
    } catch (err) {
      console.error('loadMore error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page]);

  // ── Mark one read ──────────────────────────────────────────────────────────
  const markRead = useCallback(async (id: number) => {
    try {
      const updated = await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => (n.id === id ? updated : n)));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('markRead error:', err);
    }
  }, []);

  // ── Mark all read ──────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('markAllRead error:', err);
    }
  }, []);

  // ── WebSocket — real-time push ─────────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    // Guard: don't connect if component unmounted or max retries exceeded
    if (!isMountedRef.current) return;
    if (retryCountRef.current >= WS_MAX_RETRIES) {
      console.warn('[WS:notifications] max retries reached, giving up');
      return;
    }

    // Guard: don't connect without a token
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.debug('[WS:notifications] no token, skipping connection');
      return;
    }

    // Guard: close existing connection before opening a new one
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }

    // Pass token as a WebSocket subprotocol so it never appears in the URL
    // (and therefore never in server access logs, browser history, or Referrer
    // headers). The browser sends:  Sec-WebSocket-Protocol: bearer, <token>
    // The server reads the token from that header and echoes back 'bearer'.
    const url = `${WS_BASE}/ws/notifications/`;
    const ws  = new WebSocket(url, ['bearer', token]);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      retryCountRef.current = 0; // reset retries on successful connection
      console.debug('[WS:notifications] connected');
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'notification.new') {
          const incoming: Notification = data.notification;
          setNotifications(prev => {
            const exists = prev.some(n => n.id === incoming.id);
            return exists ? prev : [incoming, ...prev];
          });
          if (!incoming.is_read) {
            setUnreadCount(prev => prev + 1);
          }
          // Dispatch to toast layer (no re-render side effect)
          onIncomingRef.current?.(incoming);
        }

        if (data.type === 'pong') return;

      } catch (err) {
        console.error('[WS:notifications] parse error', err);
      }
    };

    ws.onerror = () => {
      // Suppress the noisy browser error — onclose will handle retry
    };

    ws.onclose = (e) => {
      if (!isMountedRef.current) return;

      // Code 4001 = we rejected it (no auth) — don't retry
      if (e.code === 4001) {
        console.debug('[WS:notifications] closed: unauthorized, not retrying');
        return;
      }

      // Normal close (navigating away) — don't retry
      if (e.code === 1000) {
        console.debug('[WS:notifications] closed normally');
        return;
      }

      // Abnormal close — schedule retry
      retryCountRef.current += 1;
      const delay = WS_RECONNECT_MS * retryCountRef.current;
      console.debug(
        `[WS:notifications] closed (${e.code}), retry ${retryCountRef.current}/${WS_MAX_RETRIES} in ${delay}ms`
      );

      retryTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) connectWebSocket();
      }, delay);
    };

    // Keepalive ping every 30s
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);

    // Store cleanup on the ws instance
    (ws as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> })._pingInterval = pingInterval;

  }, []);

  // ── Mount / unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    // Small delay so the app finishes loading and token is in localStorage
    const initTimer = setTimeout(() => {
      connectWebSocket();
    }, 500);

    return () => {
      isMountedRef.current = false;
      clearTimeout(initTimer);

      // Clear retry timer
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

      // Clear ping interval
      const ws = wsRef.current as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> } | null;
      if (ws?._pingInterval) clearInterval(ws._pingInterval);

      // Close WebSocket cleanly (code 1000 = normal)
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close(1000);
      }
    };
  }, [connectWebSocket]);

  // ── Fetch when panel opens ─────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  // ── Fallback polling (badge only) ─────────────────────────────────────────
  useEffect(() => {
    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isLoadingMore,
    hasMore,
    fetchNotifications,
    loadMore,
    markRead,
    markAllRead,
  };
}