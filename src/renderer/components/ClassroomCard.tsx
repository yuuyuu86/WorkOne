import { useCallback, useEffect, useState } from 'react';
import {
  FiBookOpen,
  FiRefreshCw,
  FiExternalLink,
  FiChevronDown,
  FiChevronRight,
} from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';

type Item = { title: string; href: string; due: string; course: string };
type State =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'unavailable' }
  | { kind: 'error' }
  | { kind: 'ok'; items: Item[] };

type Bucket = 'today' | 'thisWeek' | 'nextWeek' | 'later' | 'none';

const BUCKET_ORDER: Bucket[] = ['today', 'thisWeek', 'nextWeek', 'later', 'none'];
const BUCKET_LABEL: Record<Bucket, string> = {
  today: '今日',
  thisWeek: '今週',
  nextWeek: '次週',
  later: 'それ以降',
  none: '期限なし',
};
// 既定で開いておくグループ（残りは折りたたみ）
const DEFAULT_OPEN: Bucket[] = ['today', 'thisWeek'];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// 「6月30日(火曜日)」「今日」「明日」などを Date に変換（年は推定）
function parseDueDate(due: string): Date | null {
  if (!due) return null;
  const today = startOfDay(new Date());
  if (due.includes('今日')) return today;
  if (due.includes('明日')) return addDays(today, 1);
  const m = due.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = today.getFullYear();
  let d = new Date(year, month - 1, day);
  // 過去すぎる（120日以上前）の場合は翌年扱い（年またぎ対策）
  if (d.getTime() < today.getTime() - 120 * 86400000) {
    d = new Date(year + 1, month - 1, day);
  }
  return d;
}

function categorize(date: Date | null): Bucket {
  if (!date) return 'none';
  const today = startOfDay(new Date());
  const dd = startOfDay(date);
  if (dd.getTime() <= today.getTime()) return 'today'; // 今日・期限切れ
  const dow = (today.getDay() + 6) % 7; // 月曜=0 … 日曜=6
  const thisWeekEnd = addDays(today, 6 - dow); // 今週の日曜
  const nextWeekEnd = addDays(thisWeekEnd, 7);
  if (dd.getTime() <= thisWeekEnd.getTime()) return 'thisWeek';
  if (dd.getTime() <= nextWeekEnd.getTime()) return 'nextWeek';
  return 'later';
}

export function ClassroomCard() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<Bucket>>(
    () => new Set(BUCKET_ORDER.filter((b) => !DEFAULT_OPEN.includes(b)))
  );

  const services = useAppStore((s) => s.services);
  const navigateService = useAppStore((s) => s.navigateService);
  const setClassroomItems = useAppStore((s) => s.setClassroomItems);
  const addNotification = useAppStore((s) => s.addNotification);
  const classroomService = services.find((s) => {
    try {
      return new URL(s.url).hostname.endsWith('classroom.google.com');
    } catch {
      return false;
    }
  });
  const classroomServiceId = classroomService?.id;

  // Classroom サービスが登録されていれば WorkOne 内のタブで開く。無ければ外部ブラウザ。
  const openAssignment = (href: string) => {
    if (classroomServiceId) navigateService(classroomServiceId, href);
    else window.workOne.openExternal(href);
  };

  const toggle = (b: Bucket) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await window.workOne.scrapeClassroom();
      if (r.loginRequired) setState({ kind: 'login' });
      else if (r.unavailable) setState({ kind: 'unavailable' });
      else {
        setState({ kind: 'ok', items: r.items });
        setClassroomItems(r.items);
        // 期限が今日・明日に迫っている課題を一度だけ通知する（id で重複防止）。
        const today = startOfDay(new Date());
        for (const it of r.items) {
          const date = parseDueDate(it.due);
          if (!date) continue;
          const diffDays = Math.round(
            (startOfDay(date).getTime() - today.getTime()) / 86400000
          );
          if (diffDays !== 0 && diffDays !== 1) continue;
          const dayKey = today.toISOString().slice(0, 10);
          addNotification({
            id: `classroom-due:${dayKey}:${it.href}`,
            serviceId: classroomServiceId ?? 'classroom',
            serviceName: classroomService?.name ?? 'Google Classroom',
            icon: classroomService?.icon ?? 'classroom',
            title: diffDays === 0 ? '本日締切の課題があります' : '明日締切の課題があります',
            body: it.title,
            receivedAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      setState({ kind: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [addNotification, classroomService, classroomServiceId, setClassroomItems]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  // グループ分け＋各グループ内は期限順
  const groups: Record<Bucket, (Item & { date: Date | null })[]> = {
    today: [],
    thisWeek: [],
    nextWeek: [],
    later: [],
    none: [],
  };
  if (state.kind === 'ok') {
    for (const it of state.items) {
      const date = parseDueDate(it.due);
      groups[categorize(date)].push({ ...it, date });
    }
    for (const b of BUCKET_ORDER) {
      groups[b].sort((a, z) => {
        if (!a.date && !z.date) return 0;
        if (!a.date) return 1;
        if (!z.date) return -1;
        return a.date.getTime() - z.date.getTime();
      });
    }
  }

  return (
    <div className="section">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h3 className="section-title" style={{ margin: 0 }}>
          Classroom の課題
        </h3>
        <button
          className="btn btn-sm btn-ghost"
          onClick={load}
          disabled={refreshing}
          title="再取得"
        >
          <FiRefreshCw
            size={13}
            style={
              refreshing
                ? { animation: 'loading-spin 1s linear infinite' }
                : undefined
            }
          />
          {refreshing ? '取得中…' : '再取得'}
        </button>
      </div>

      {state.kind === 'loading' ? (
        <div className="card">
          <div className="list-row">
            <span className="muted">読み込み中…</span>
          </div>
        </div>
      ) : state.kind === 'login' ? (
        <div className="card">
          <div className="list-row">
            <span className="muted">
              Classroom にログインが必要です。サイドバーから Classroom
              を開いてログインしてください。
            </span>
          </div>
        </div>
      ) : state.kind === 'unavailable' ? (
        <div className="card">
          <div className="list-row">
            <span className="muted">
              この Google アカウントでは Classroom
              を取得できませんでした（学校の制限の可能性）。
            </span>
          </div>
        </div>
      ) : state.kind === 'error' ? (
        <div className="card">
          <div className="list-row">
            <span className="muted">
              取得できませんでした。再取得を試してください。
            </span>
          </div>
        </div>
      ) : state.items.length === 0 ? (
        <div className="card">
          <div className="list-row">
            <span className="muted">未提出の課題は見つかりませんでした。</span>
          </div>
        </div>
      ) : (
        <div className="classroom-groups">
          {BUCKET_ORDER.map((b) => {
            const items = groups[b];
            if (items.length === 0) return null;
            const isCollapsed = collapsed.has(b);
            return (
              <div className="card" key={b} style={{ marginBottom: 10 }}>
                <button
                  className="classroom-group-head"
                  onClick={() => toggle(b)}
                >
                  {isCollapsed ? (
                    <FiChevronRight size={14} />
                  ) : (
                    <FiChevronDown size={14} />
                  )}
                  <span className="grow">{BUCKET_LABEL[b]}</span>
                  <span
                    className="unread-badge"
                    style={
                      b === 'today'
                        ? undefined
                        : { background: 'var(--text-tertiary)' }
                    }
                  >
                    {items.length}
                  </span>
                </button>
                {!isCollapsed &&
                  items.map((a) => (
                    <div
                      className="list-row"
                      key={a.href}
                      style={{ cursor: 'pointer' }}
                      onClick={() => openAssignment(a.href)}
                    >
                      <FiBookOpen
                        size={16}
                        style={{ color: 'var(--accent)', flexShrink: 0 }}
                      />
                      <div className="grow">
                        <div className="row-title">{a.title}</div>
                        <div className="row-sub">
                          {a.course}
                          {a.due ? `　${a.due}` : ''}
                        </div>
                      </div>
                      {!classroomServiceId && (
                        <FiExternalLink
                          size={13}
                          style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
                        />
                      )}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
