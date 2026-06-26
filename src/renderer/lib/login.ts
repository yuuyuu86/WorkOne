// ページの URL からログイン／サインイン画面かどうかを推定する。
// （DOM のスクレイピングはせず、URL のみで判定する）
//
// 用途: 一度ログイン済みになったサービスが、後からログイン画面へ
// 引き戻された＝セッション切れ、を検知して再ログインを促すため。

// 主要サービスの認証用ホスト
const LOGIN_HOST_PATTERNS: RegExp[] = [
  /(^|\.)accounts\.google\.com$/i, // Google（Gmail/Classroom/Drive/Calendar/Meet）
  /(^|\.)login\.microsoftonline\.com$/i, // Microsoft 365 / Outlook / Teams
  /(^|\.)login\.live\.com$/i, // Microsoft アカウント
  /(^|\.)login\.yahoo\.co\.jp$/i, // Yahoo!メール
  /(^|\.)login\.yahoo\.com$/i,
  /(^|\.)idmsa\.apple\.com$/i, // Apple / iCloud
  /(^|\.)accounts\.zoho\.com$/i, // Zoho
  /(^|\.)account\.proton\.me$/i, // Proton
];

// パスにログイン系のセグメントを含むか（同一ホスト内のログイン画面用）
const LOGIN_PATH_RE = /(^|\/)(login|signin|sign-in|sign_in)(\/|\.|$|\?)/i;

export function isLoginUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (LOGIN_HOST_PATTERNS.some((re) => re.test(u.hostname))) return true;
    if (LOGIN_PATH_RE.test(u.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}
