// おやすみ時間（DND）の判定。"HH:MM" 形式の開始・終了で、
// 深夜をまたぐ範囲（例: 22:00〜07:00）にも対応する。
export function isWithinDnd(
  start: string,
  end: string,
  now: Date = new Date()
): boolean {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map((x) => parseInt(x, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };
  const s = toMin(start);
  const e = toMin(end);
  if (s === null || e === null || s === e) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  // 同日内の範囲
  if (s < e) return cur >= s && cur < e;
  // 深夜をまたぐ範囲（開始 > 終了）
  return cur >= s || cur < e;
}
