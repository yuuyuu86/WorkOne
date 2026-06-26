import type { IconType } from 'react-icons';
import {
  SiGmail,
  SiGooglecalendar,
  SiGooglemeet,
  SiGoogleclassroom,
  SiGoogledrive,
  SiGooglechat,
  SiSlack,
  SiDiscord,
  SiZoom,
  SiProtonmail,
  SiIcloud,
  SiZoho,
  SiWebex,
} from 'react-icons/si';
import {
  FiMail,
  FiMessageSquare,
  FiCalendar,
  FiBookOpen,
  FiGlobe,
  FiLink,
} from 'react-icons/fi';
import {
  PiMicrosoftOutlookLogoFill,
  PiMicrosoftTeamsLogoFill,
} from 'react-icons/pi';
import type { ServiceCategory } from '../types/service';

// アイコンキー -> react-icons コンポーネントの対応表。
// サービスの icon フィールドにはこのキーを保存する。
const ICONS: Record<string, IconType> = {
  gmail: SiGmail,
  outlook: PiMicrosoftOutlookLogoFill,
  yahoo: FiMail, // Simple Icons に Yahoo がないため汎用メールアイコン + ブランドカラー
  slack: SiSlack,
  discord: SiDiscord,
  classroom: SiGoogleclassroom,
  drive: SiGoogledrive,
  calendar: SiGooglecalendar,
  meet: SiGooglemeet,
  zoom: SiZoom,
  teams: PiMicrosoftTeamsLogoFill,
  googlechat: SiGooglechat,
  proton: SiProtonmail,
  icloud: SiIcloud,
  zoho: SiZoho,
  webex: SiWebex,
  chatwork: FiMessageSquare, // 専用アイコンが無いため汎用 + ブランドカラー
  // カスタム/汎用アイコン
  mail: FiMail,
  chat: FiMessageSquare,
  schedule: FiCalendar,
  school: FiBookOpen,
  web: FiGlobe,
  link: FiLink,
};

// 各サービスらしいブランドカラー（背景チップ用）
const ICON_COLORS: Record<string, string> = {
  gmail: '#EA4335',
  outlook: '#0078D4',
  yahoo: '#6001D2',
  slack: '#4A154B',
  discord: '#5865F2',
  classroom: '#1E8E3E',
  drive: '#1FA463',
  calendar: '#4285F4',
  meet: '#00897B',
  zoom: '#2D8CFF',
  teams: '#6264A7',
  googlechat: '#00897B',
  proton: '#6D4AFF',
  icloud: '#3693F3',
  zoho: '#E42527',
  webex: '#005073',
  chatwork: '#F93D00',
};

export const CATEGORY_DEFAULT_ICON: Record<ServiceCategory, string> = {
  mail: 'mail',
  chat: 'chat',
  school: 'school',
  calendar: 'schedule',
  custom: 'web',
};

/** カスタムURL追加で選べるアイコン候補 */
export const CUSTOM_ICON_CHOICES: { key: string; label: string }[] = [
  { key: 'web', label: 'Web' },
  { key: 'mail', label: 'メール' },
  { key: 'chat', label: 'チャット' },
  { key: 'school', label: '学校' },
  { key: 'schedule', label: '予定' },
  { key: 'link', label: 'リンク' },
];

export function getIcon(key: string): IconType {
  return ICONS[key] ?? FiGlobe;
}

export function getIconColor(key: string): string | undefined {
  return ICON_COLORS[key];
}

// --- ファビコン（カスタムサービスでサイトのアイコンを使う場合） ---
// icon フィールドが画像 URL の場合は <img> として描画する。
export function isImageIcon(key: string): boolean {
  return /^https?:\/\//i.test(key);
}

/** URL のドメインからファビコン画像 URL を生成する（Google のファビコンサービス） */
export function faviconUrlFor(siteUrl: string): string | null {
  try {
    const host = new URL(siteUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return null;
  }
}
