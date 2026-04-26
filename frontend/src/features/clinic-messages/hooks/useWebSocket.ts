import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSIncomingEvent, MessageItem } from '../types/messages.types';

const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://127.0.0.1:8000';

const MAX_RETRIES   = 5;
const BASE_DELAY_MS = 3000;

const getToken = (): string | null => {
  const direct = localStorage.getItem('access_token');
  if (direct) return direct;
  try {
    const s = localStorage.getItem('auth-storage');
    if (s) {
      const p = JSON.parse(s);
      return p?.state?.tokens?.access || p?.tokens?.access || null;
    }
  } catch { /* ignore */ }
  return null;
};

interface UseWebSocketOptions {
  conversationId: number | null;
  onMessage:      (msg: MessageItem) => void;
  onTyping?:      (userId: number, name: string, isTyping: boolean) => void;
}

export const useWebSocket = ({
  conversationId,
  onMessage,
  onTyping,
}: UseWebSocketOptions) => {
  const wsRef        = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef   = useRef(true);
  const retriesRef   = useRef(0);
  const onMessageRef = useRef(onMessage);
  const onTypingRef  = useRef(onTyping);
  const [isConnected, setIsConnected] = useState(false);

  // Keep refs fresh without re-triggering connect
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onTypingRef.current  = onTyping;  }, [onTyping]);

  const cleanup = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen    = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror   = null;
      wsRef.current.onclose   = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || !conversationId) return;

    // Don't open a second connection if one is already open/connecting
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
       wsRef.current.readyState === WebSocket.CONNECTING)
    ) return;

    const token = getToken();
    if (!token) {
      // Token not ready yet — retry after short delay
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 1000);
      return;
    }

    // Stop retrying after MAX_RETRIES
    if (retriesRef.current >= MAX_RETRIES) {
      console.warn('[Chat WS] Max retries reached. Giving up.');
      return;
    }

    // Pass token as a WebSocket subprotocol so it never appears in the URL
    // (and therefore never in server access logs, browser history, or Referrer
    // headers). The browser sends:  Sec-WebSocket-Protocol: bearer, <token>
    // The server reads the token from that header and echoes back 'bearer'.
    const url = `${WS_BASE}/ws/messages/${conversationId}/`;
    const ws  = new WebSocket(url, ['bearer', token]);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      retriesRef.current = 0; // Reset on successful connection
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data: WSIncomingEvent = JSON.parse(event.data);
        if (data.type === 'chat_message') {
          onMessageRef.current(data.message);
        } else if (data.type === 'typing' && onTypingRef.current) {
          onTypingRef.current(data.user_id, data.name, data.is_typing);
        }
      } catch {
        console.error('[Chat WS] parse error');
      }
    };

    ws.onerror = () => {
      // Let onclose handle reconnect
      ws.close();
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      wsRef.current = null;
      setIsConnected(false);

      retriesRef.current += 1;

      // Exponential backoff: 3s, 6s, 12s, 24s, 48s
      const delay = Math.min(BASE_DELAY_MS * 2 ** (retriesRef.current - 1), 48000);

      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };
  }, [conversationId]);

  useEffect(() => {
    mountedRef.current = true;
    retriesRef.current = 0;

    if (conversationId) {
      // Small delay to ensure token is ready
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 300);
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [conversationId, connect, cleanup]);

  const sendMessage = useCallback((body: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'send_message', body }));
    }
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'typing', is_typing: isTyping }));
    }
  }, []);

  const sendMarkRead = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'mark_read' }));
    }
  }, []);

  return { isConnected, sendMessage, sendTyping, sendMarkRead };
};