import type { Service } from '../types/service';

// 各サービスの「検索URL」を組み立てる（セッション流用で結果ページへ直行）。
// 対応していないサービスは null（その場合はサービスを開くだけ）。
export function getServiceSearchUrl(
  service: Service,
  query: string
): string | null {
  const q = encodeURIComponent(query.trim());
  if (!q) return null;
  let host = '';
  try {
    host = new URL(service.url).hostname;
  } catch {
    return null;
  }

  if (host === 'mail.google.com') {
    return `https://mail.google.com/mail/u/0/#search/${q}`;
  }
  if (host === 'drive.google.com') {
    return `https://drive.google.com/drive/u/0/search?q=${q}`;
  }
  if (host.endsWith('outlook.office.com') || host.endsWith('outlook.live.com')) {
    return `https://outlook.office.com/mail/search/query/${q}`;
  }
  if (host === 'mail.yahoo.co.jp') {
    return `https://mail.yahoo.co.jp/d/search/keyword=${q}`;
  }
  return null;
}

/** そのサービスがキーワード検索URLに対応しているか */
export function isSearchable(service: Service): boolean {
  return getServiceSearchUrl(service, 'x') !== null;
}
