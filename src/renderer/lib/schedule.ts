import type { Profile } from '../types/service';
import { isWithinDnd } from './dnd';

// 時間割から「いま有効なプロファイル」を求める。該当なしは null。
// 複数該当する場合は一覧の先頭を優先する。
// 深夜をまたぐ時間帯は開始日の曜日で判定する（例: 金 22:00〜02:00 は土の未明も含む）。
export function profileForSchedule(
  profiles: Profile[],
  now: Date
): string | null {
  const day = now.getDay();
  const cur = now.getHours() * 60 + now.getMinutes();
  for (const p of profiles) {
    for (const slot of p.schedule ?? []) {
      if (!isWithinDnd(slot.start, slot.end, now)) continue;
      const [sh, sm] = slot.start.split(':').map(Number);
      const startDay = cur >= sh * 60 + sm ? day : (day + 6) % 7;
      if (slot.days.includes(startDay)) return p.id;
    }
  }
  return null;
}
