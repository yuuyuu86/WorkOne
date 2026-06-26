// ページタイトルから未読件数を推定する（API を使わない簡易版）。
//
// 多くのサービスはタブのタイトルに未読を埋め込む:
//   "Inbox (5) - example@gmail.com"   -> 5
//   "(3) Slack"                       -> 3
//   "(12+) Discord"                   -> 12
//   "• Slack"  /  "* general"         -> 件数不明だが未読あり → 1
// 見つからなければ 0。
export function parseUnreadCount(title: string): number {
  if (!title) return 0;
  const m = title.match(/\((\d+)\+?\)/);
  if (m) {
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : 0;
  }
  // 件数なしの未読マーカー（先頭の中黒・アスタリスク）
  if (/^\s*[•*]/.test(title)) return 1;
  return 0;
}
