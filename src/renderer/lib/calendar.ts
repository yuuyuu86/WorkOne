// カレンダー webview から取得した予定ラベル（aria-label 等）を今日の予定に変換する。
// Home のカードとメニューバーのミニ版で共用する。

export type Parsed = {
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

export function parseLabel(label: string): Parsed | null {
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

/** 今日の予定（重複除去・終日が先、時刻順） */
export function todayEvents(raw: string[] | undefined): Parsed[] {
  return (raw ?? [])
    .map(parseLabel)
    .filter((p): p is Parsed => p !== null)
    .filter((p, i, arr) => arr.findIndex((x) => x.title === p.title) === i)
    .sort((a, b) => a.startMin - b.startMin);
}
