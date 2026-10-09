import { useEffect, useRef, useState } from 'react';
import { FiCalendar, FiClock, FiX } from 'react-icons/fi';

type Props = {
  due?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  onChange: (due: string | undefined, time: string | undefined) => void;
  /** 時刻の指定を出すか（リマインダー用） */
  withTime?: boolean;
  compact?: boolean;
};

const pad = (x: number) => String(x).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const nextMonday = () => {
  const d = new Date();
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  return ymd(d);
};

/** 期限の表示用ラベル（今日／明日／曜日つき日付） */
export function dueLabel(due?: string, time?: string): string {
  if (!due) return '';
  const today = ymd(new Date());
  const d = new Date(`${due.slice(0, 10)}T00:00`);
  const diff = Math.round((d.getTime() - new Date(`${today}T00:00`).getTime()) / 86400000);
  const day =
    diff === 0
      ? '今日'
      : diff === 1
        ? '明日'
        : diff === -1
          ? '昨日'
          : d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
  return time ? `${day} ${time}` : day;
}

/**
 * 期限を選ぶチップ＋ポップオーバー。ブラウザ標準の日付欄（年/月/日）をそのまま
 * 見せず、よく使う候補をワンクリックで選べるようにする。
 */
export function DuePicker({ due, time, onChange, withTime = true, compact }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const overdue = !!due && due.slice(0, 10) < ymd(new Date());
  const pick = (d: string) => onChange(d, time);

  return (
    <div className="due-picker" ref={ref}>
      <button
        type="button"
        className={`due-chip ${due ? 'set' : ''} ${overdue ? 'overdue' : ''} ${compact ? 'compact' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="期限を設定"
      >
        <FiCalendar size={13} />
        {due ? dueLabel(due, time) : compact ? '' : '期限'}
      </button>
      {open && (
        <div className="due-pop">
          <button type="button" onClick={() => pick(addDays(0))}>
            今日
            <span className="muted">{dueLabel(addDays(0))}</span>
          </button>
          <button type="button" onClick={() => pick(addDays(1))}>
            明日
            <span className="muted">{new Date(`${addDays(1)}T00:00`).toLocaleDateString('ja-JP', { weekday: 'short' })}</span>
          </button>
          <button type="button" onClick={() => pick(nextMonday())}>
            来週
            <span className="muted">{dueLabel(nextMonday())}</span>
          </button>
          <div className="due-pop-sep" />
          <label className="due-pop-field">
            <FiCalendar size={13} />
            <input
              type="date"
              value={due?.slice(0, 10) ?? ''}
              onChange={(e) => onChange(e.target.value || undefined, time)}
            />
          </label>
          {withTime && (
            <label className="due-pop-field">
              <FiClock size={13} />
              <input
                type="time"
                value={time ?? ''}
                disabled={!due}
                onChange={(e) => onChange(due, e.target.value || undefined)}
              />
              <span className="muted">に通知</span>
            </label>
          )}
          {due && (
            <>
              <div className="due-pop-sep" />
              <button
                type="button"
                className="danger-text"
                onClick={() => {
                  onChange(undefined, undefined);
                  setOpen(false);
                }}
              >
                <FiX size={13} /> 期限を外す
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
