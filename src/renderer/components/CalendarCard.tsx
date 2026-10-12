import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCalendar, FiRefreshCw } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import { todayEvents, type Parsed } from '../lib/calendar';

type Row = {
  kind: 'event' | 'task';
  id: string;
  title: string;
  when: string;
  startMin: number;
};

const pad = (x: number) => String(x).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function CalendarCard() {
  // 認証情報には触れず、カレンダー webview が取得した「予定の表示名」だけを
  // ストア経由でキャッシュしている。それを今日分にパースして表示する。
  const calendarRaw = useAppStore((s) => s.calendarRaw);
  const [refreshing, setRefreshing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // キャッシュ済みの生ラベルを今日分にパース
  const items = useMemo<Parsed[]>(
    () =>
      todayEvents(calendarRaw),
    [calendarRaw]
  );

  // 今日が期限の時刻つきタスク（このプロファイル・未完了）も予定と一緒に時間順で並べる
  const tasks = useAppStore((s) => s.tasks);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const setView = useAppStore((s) => s.setView);
  const today = ymd(new Date());
  const taskRows = useMemo<Row[]>(
    () =>
      tasks
        .filter(
          (t) =>
            !t.done &&
            t.profileId === activeProfileId &&
            t.dueTime &&
            t.due?.slice(0, 10) === today
        )
        .map((t) => {
          const [h, m] = t.dueTime!.split(':').map(Number);
          return { kind: 'task', id: t.id, title: t.title, when: t.dueTime!, startMin: h * 60 + m };
        }),
    [tasks, activeProfileId, today]
  );

  // 終日イベントはまとめて上にコンパクト表示、時刻つき予定（とタスク）は下に時間順で表示
  const allDayItems = items.filter((e) => e.startMin < 0);
  const timedRows: Row[] = [
    ...items
      .filter((e) => e.startMin >= 0)
      .map((e, i) => ({ kind: 'event' as const, id: `e${i}`, ...e })),
    ...taskRows,
  ].sort((a, b) => a.startMin - b.startMin);

  const request = useCallback(() => {
    setRefreshing(true);
    window.dispatchEvent(new CustomEvent('md:calendar-request'));
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setRefreshing(false), 6000);
  }, []);

  useEffect(() => {
    const onResult = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setRefreshing(false);
    };
    window.addEventListener('md:calendar-result', onResult);
    const first = setTimeout(request, 3000);
    const timer = setInterval(request, 30 * 60 * 1000);
    return () => {
      window.removeEventListener('md:calendar-result', onResult);
      clearTimeout(first);
      clearInterval(timer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [request]);

  // まだ一度もカレンダーを開いておらず予定が取れていないときは、案内だけ出す
  if (items.length === 0 && taskRows.length === 0) {
    return (
      <div className="section">
        <div className="cal-head">
          <h3 className="section-title" style={{ margin: 0 }}>
            今日の予定
          </h3>
          <button
            className="btn btn-sm btn-ghost"
            onClick={request}
            disabled={refreshing}
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
        <div className="card muted" style={{ fontSize: 13 }}>
          今日の予定はありません。
          {calendarRaw.length === 0 &&
            '（サイドバーの Google Calendar を一度開くと取得します）'}
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="cal-head">
        <h3 className="section-title" style={{ margin: 0 }}>
          今日の予定
        </h3>
        <button
          className="btn btn-sm btn-ghost"
          onClick={request}
          disabled={refreshing}
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

      {allDayItems.length > 0 && (
        <div className="card cal-allday-row">
          <span className="cal-allday-label">終日</span>
          <div className="cal-allday-chips">
            {allDayItems.map((e, i) => (
              <span className="cal-allday-chip" key={e.title + i}>
                {e.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {timedRows.length > 0 && (
        <div className="card">
          {timedRows.map((e) =>
            e.kind === 'task' ? (
              <div className="list-row cal-task-row" key={e.id}>
                <button
                  className="check-circle"
                  title="タスクを完了"
                  onClick={() => toggleTaskDone(e.id)}
                />
                <div className="grow" style={{ cursor: 'pointer' }} onClick={() => setView('tasks')}>
                  <div className="row-title">{e.title}</div>
                  <div className="row-sub">タスク</div>
                </div>
                <span className="muted" style={{ flexShrink: 0 }}>
                  {e.when}
                </span>
              </div>
            ) : (
              <div className="list-row" key={e.id}>
                <FiCalendar
                  size={16}
                  style={{ color: 'var(--accent)', flexShrink: 0 }}
                />
                <div className="grow">
                  <div className="row-title">{e.title}</div>
                </div>
                <span className="muted" style={{ flexShrink: 0 }}>
                  {e.when}
                </span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
