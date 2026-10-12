import type { AppNotification } from '../../types/service';

export type InboxFilter = 'open' | 'unread' | 'important' | 'snoozed' | 'done';
export type InboxSort = 'priority' | 'newest';

/** 受信箱に残っている（完了・スヌーズしていない）通知 */
export const isOpen = (n: AppNotification) => !n.done && !n.snoozedUntil;

/** AI 要約の末尾の句点などを落として見出し向きにする */
export const cleanSentence = (t: string) => t.trim().replace(/[。.]+$/, '');

/** スコアの高い順（同点は新しい順） */
export const byScore = (a: AppNotification, b: AppNotification) =>
  (b.score ?? 0) - (a.score ?? 0) || b.receivedAt.localeCompare(a.receivedAt);

/** スヌーズの選択肢（いまからの時刻を返す） */
export const SNOOZE_OPTIONS: { label: string; at: () => Date }[] = [
  { label: '1時間後', at: () => new Date(Date.now() + 3600000) },
  {
    label: '今夜 19:00',
    at: () => {
      const d = new Date();
      d.setHours(19, 0, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      return d;
    },
  },
  {
    label: '明日 8:00',
    at: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
      return d;
    },
  },
  {
    label: '来週 月曜 8:00',
    at: () => {
      const d = new Date();
      d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
      d.setHours(8, 0, 0, 0);
      return d;
    },
  },
];
