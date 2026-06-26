// ページタイトルから未読件数を推定する（API を使わない簡易版）。
//
// 多くのサービスはタブのタイトルに未読を埋め込む:
//   "Inbox (5) - example@gmail.com"   -> 5
//   "(3) Slack"                       -> 3
//   "(12+) Discord"                   -> 12
//   "[5] メッセージ"                   -> 5
//   "受信トレイ（３） - Outlook"        -> 3（全角）
//   "• Slack"  /  "* general"         -> 件数不明だが未読あり → 1
// 見つからなければ 0。
//
// 第2引数に hostname を渡すと、サービス固有のクセを補正する。

// 全角の数字・括弧を半角へ正規化する（Yahoo!メール/Outlook などは全角を使うことがある）
function normalizeWidth(s: string): string {
  return s.replace(/[０-９（）［］｛｝＋]/g, (ch) => {
    const code = ch.charCodeAt(0);
    // 全角数字 ０-９
    if (code >= 0xff10 && code <= 0xff19) return String(code - 0xff10);
    const map: Record<string, string> = {
      '（': '(',
      '）': ')',
      '［': '[',
      '］': ']',
      '｛': '{',
      '｝': '}',
      '＋': '+',
    };
    return map[ch] ?? ch;
  });
}

// 異常に大きな数値（年号や時刻の誤検出）を弾くための上限
const MAX_REASONABLE = 9999;

export function parseUnreadCount(title: string, hostname?: string): number {
  if (!title) return 0;
  const t = normalizeWidth(title);

  // (N) / (N+) / [N] / {N} のいずれか。最初に見つかった括弧つき数値を採用。
  const m = t.match(/[([{](\d{1,5})\+?[)\]}]/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n <= MAX_REASONABLE) return n;
  }

  // 件数なしの未読マーカー（先頭の中黒・アスタリスク・●など）→ 1 件あり
  if (/^\s*[•*●∙·🔴]/.test(t)) return 1;

  // サービス固有の補正
  if (hostname) {
    // Discord: 数値が取れなくても、タイトルに未読マーカーが付くことがある
    if (hostname.includes('discord.com') && /^\s*\(\d*\)/.test(t)) return 1;
  }

  return 0;
}

// service.url の hostname を安全に取り出す
export function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
