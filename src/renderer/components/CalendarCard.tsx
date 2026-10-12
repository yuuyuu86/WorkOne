import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCalendar, FiRefreshCw } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import { todayEvents, type Parsed } from '../lib/calendar';

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

  // 終日イベントはまとめて上にコンパクト表示、時刻つき予定は下に時間順で表示
  const allDayItems = items.filter((e) => e.startMin < 0);
  const timedItems = items.filter((e) => e.startMin >= 0);

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
  if (items.length === 0) {
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

      {timedItems.length > 0 && (
        <div className="card">
          {timedItems.map((e, i) => (
            <div className="list-row" key={e.title + i}>
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
          ))}
        </div>
      )}
    </div>
  );
}
