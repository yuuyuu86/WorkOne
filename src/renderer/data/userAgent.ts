// 各サービスの <webview> に渡す User-Agent。
//
// Electron 標準の UA には "Electron/x.y.z" や "WorkOne/x.y.z" という
// トークンが含まれ、一部サービス（Slack など）が未対応ブラウザとして弾く。
// 中身は本物の Chromium なので、これらのトークンだけを取り除いて
// 「素の Chrome」として見せる（エンジンと矛盾しない範囲の正規化）。
function buildChromeUserAgent(): string {
  const base =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

  // Slack などが古い Chrome を未対応扱いするため、UA 上のバージョンを引き上げる。
  const MIN_CHROME_MAJOR = 140;

  return base
    .replace(/\sElectron\/[\d.]+/i, '')
    .replace(/\sWorkOne\/[\d.]+/i, '')
    .replace(/Chrome\/(\d+)(\.[\d.]+)/i, (full, major: string, rest: string) =>
      Number(major) < MIN_CHROME_MAJOR ? `Chrome/${MIN_CHROME_MAJOR}${rest}` : full
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const CHROME_USER_AGENT = buildChromeUserAgent();
