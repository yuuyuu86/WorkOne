import type { TaskRepeat } from '../types/service';

const pad = (x: number) => String(x).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const REPEAT_LABEL: Record<TaskRepeat, string> = {
  daily: '毎日',
  weekdays: '平日',
  weekly: '毎週',
  monthly: '毎月',
};

/**
 * 繰り返しタスクの次回の期限。期限が無ければ今日を起点にする。
 * 期限が過去でも、今日以降になるまで進める（溜まった分を一気に作らない）。
 */
export function nextDue(due: string | undefined, repeat: TaskRepeat, now = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = due ? new Date(`${due.slice(0, 10)}T00:00`) : new Date(today);
  const step = () => {
    if (repeat === 'daily') d.setDate(d.getDate() + 1);
    else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
    else if (repeat === 'monthly') d.setMonth(d.getMonth() + 1);
    else {
      do d.setDate(d.getDate() + 1);
      while (d.getDay() === 0 || d.getDay() === 6);
    }
  };
  step();
  while (d < today) step();
  return ymd(d);
}
