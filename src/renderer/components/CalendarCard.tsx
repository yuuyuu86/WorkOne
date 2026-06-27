import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCalendar, FiRefreshCw } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';

type Parsed = {
  title: string;
  when: string; // 「終日」or「19:00〜20:30」
  startMin: number; // 並び替え用（終日は -1）
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// 「午後7時」「午後8:30」「午前10時」「13:00」「10時30分」などを分(0-1439)に変換
function jpTimeToMin(s: string): number | null {
  const m = s.match(
    /(午前|午後)?\s*(\d{1,2})(?:\s*時\s*(\d{1,2})?\s*分?|:(\d{2}))?/
  );
  if (!m) return null;
  let h = Number(m[2]);
  const min = m[3] != null ? Number(m[3]) : m[4] != null ? Number(m[4]) : 0;
  if (m[1] === '午後' && h < 12) h += 12;
  if (m[1] === '午前' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function fmt(min: number): string {
  return Math.floor(min / 60) + ':' + String(min % 60).padStart(2, '0');
}

// 1 つの時刻トークンにマッチする部分パターン（午前/午後＋時 or :分）
const TIME_TOKEN = '(?:午前|午後)?\\s*\\d{1,2}(?:\\s*時(?:\\s*\\d{1,2}\\s*分?)?|:\\d{2})';
const TIME_RANGE_RE = new RegExp(`(${TIME_TOKEN})\\s*[～〜~]\\s*(${TIME_TOKEN})`);

function parseLabel(label: string): Parsed | null {
  const todayT = startOfDay(new Date());

  // タイトルは「」内を優先
  const q = label.match(/「([^」]+)」/);
  let title = q ? q[1] : label.split(/[、,]/)[0];
  title = title.replace(/(終日|午前.*|午後.*|\d{1,2}:\d{2}.*)$/, '').trim();

  // 開始日（YYYY年 M月 D日、スペース有無問わず）
  const startM = label.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!startM) return null;
  const year = Number(startM[1]);
  const sMonth = Number(startM[2]);
  const sDay = Number(startM[3]);
  const start = new Date(year, sMonth - 1, sDay);

  // 終了日（「〜 28日」「〜 7月 2日」）。無ければ開始日と同じ。
  let end = start;
  const endM = label.match(/[〜～~]\s*(?:(\d{1,2})\s*月\s*)?(\d{1,2})\s*日/);
  if (endM) {
    const eMonth = endM[1] ? Number(endM[1]) : sMonth;
    end = new Date(year, eMonth - 1, Number(endM[2]));
  }

  // 今日が [start, end] の範囲内か
  const s = startOfDay(start);
  const e = startOfDay(end);
  if (!(s <= todayT && todayT <= e)) return null;

  const allDay = /終日/.test(label);
  let when = '終日';
  let startMin = -1;
  if (!allDay) {
    // タイトル「」より前の時刻レンジを解析
    const head = label.split('「')[0];
    const rm = head.match(TIME_RANGE_RE);
    if (rm) {
      const a = jpTimeToMin(rm[1]);
      const b = jpTimeToMin(rm[2]);
      if (a != null && b != null) {
        when = `${fmt(a)}〜${fmt(b)}`;
        startMin = a;
      }
    }
  }

  return { title: title || '(予定)', when, startMin };
}

export function CalendarCard() {
  // 認証情報には触れず、カレンダー webview が取得した「予定の表示名」だけを
  // ストア経由でキャッシュしている。それを今日分にパースして表示する。
  const calendarRaw = useAppStore((s) => s.calendarRaw);
  const [refreshing, setRefreshing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // キャッシュ済みの生ラベルを今日分にパース
  const items = useMemo<Parsed[]>(
    () =>
      (calendarRaw ?? [])
        .map(parseLabel)
        .filter((p): p is Parsed => p !== null)
        .filter((p, i, arr) => arr.findIndex((x) => x.title === p.title) === i)
        .sort((a, b) => a.startMin - b.startMin),
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
