import type { IconType } from 'react-icons';
import {
  FiHome,
  FiBookOpen,
  FiBriefcase,
  FiMonitor,
  FiBook,
  FiPenTool,
  FiActivity,
  FiMoon,
  FiCoffee,
  FiMusic,
  FiHeart,
  FiStar,
} from 'react-icons/fi';

// プロファイルのアイコン（react-icons / Feather）。キーで保存する。
export const PROFILE_ICONS: Record<string, IconType> = {
  home: FiHome,
  school: FiBookOpen,
  work: FiBriefcase,
  game: FiMonitor,
  study: FiBook,
  art: FiPenTool,
  sport: FiActivity,
  night: FiMoon,
  cafe: FiCoffee,
  music: FiMusic,
  heart: FiHeart,
  star: FiStar,
};

export const PROFILE_ICON_KEYS = Object.keys(PROFILE_ICONS);

// v2 初期に絵文字で保存していたプロファイルの変換表
const LEGACY_EMOJI: Record<string, string> = {
  '🏠': 'home',
  '🏫': 'school',
  '💼': 'work',
  '🎮': 'game',
  '📚': 'study',
  '🎨': 'art',
  '⚽': 'sport',
  '🌙': 'night',
  '🧪': 'star',
  '🎵': 'music',
};

export function profileIconKeyFromLegacy(emoji: string | undefined): string {
  return (emoji && LEGACY_EMOJI[emoji]) || 'home';
}

export function ProfileIcon({ icon, size = 15 }: { icon: string; size?: number }) {
  const Icon = PROFILE_ICONS[icon] ?? FiHome;
  return <Icon size={size} />;
}
