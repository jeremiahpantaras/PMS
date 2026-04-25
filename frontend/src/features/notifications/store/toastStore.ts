import { useState, useEffect } from 'react';
import type { NotificationCategory } from '../types/notifications.types';

export interface ToastItem {
  id:         string;
  title:      string;
  message:    string;
  category:   NotificationCategory;
  created_at: string;
}

const MAX_TOASTS      = 3;
const AUTO_DISMISS_MS = 6_000;

// ── Module-level store (no Context/Zustand needed) ────────────────────────────

let toasts: ToastItem[] = [];
const subscribers = new Set<(t: ToastItem[]) => void>();

function notifySubscribers() {
  subscribers.forEach(fn => fn([...toasts]));
}

export function pushToast(toast: Omit<ToastItem, 'id'>): void {
  const id   = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const item: ToastItem = { ...toast, id };
  toasts = [item, ...toasts].slice(0, MAX_TOASTS);
  notifySubscribers();
  setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
}

export function dismissToast(id: string): void {
  toasts = toasts.filter(t => t.id !== id);
  notifySubscribers();
}

// ── React hook ────────────────────────────────────────────────────────────────

export function useToastStore(): ToastItem[] {
  const [state, setState] = useState<ToastItem[]>([...toasts]);

  useEffect(() => {
    setState([...toasts]);
    subscribers.add(setState);
    return () => { subscribers.delete(setState); };
  }, []);

  return state;
}
