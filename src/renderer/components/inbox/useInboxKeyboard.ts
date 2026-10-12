import { useEffect, useRef } from 'react';
import type { AppNotification } from '../../types/service';

type Handlers = {
  shown: AppNotification[];
  cursor: number;
  setCursor: (fn: (c: number) => number) => void;
  /** ダイアログ等が開いている間はキー操作を止める */
  paused: boolean;
  onOpen: (n: AppNotification) => void;
  onDone: (n: AppNotification) => void;
  onSnooze: (n: AppNotification) => void;
  onTask: (n: AppNotification) => void;
  onDelete: (n: AppNotification) => void;
};

/**
 * Inbox のキーボード操作。
 * j/k・↑↓ 移動、Enter 開く、e 完了、s スヌーズ、t タスク化、# 削除。
 */
export function useInboxKeyboard(h: Handlers) {
  // 毎回登録し直さないよう、最新のハンドラは ref で参照する
  const ref = useRef(h);
  ref.current = h;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const { shown, cursor, setCursor, paused, ...act } = ref.current;
      if (paused) return;
      const n = shown[cursor];
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          setCursor((c) => Math.min(shown.length - 1, c + 1));
          break;
        case 'k':
        case 'ArrowUp':
          setCursor((c) => Math.max(0, c - 1));
          break;
        case 'Enter':
          if (n) act.onOpen(n);
          break;
        case 'e':
          if (n) act.onDone(n);
          break;
        case 's':
          if (n) act.onSnooze(n);
          break;
        case 't':
          if (n) act.onTask(n);
          break;
        case '#':
          if (n) act.onDelete(n);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
