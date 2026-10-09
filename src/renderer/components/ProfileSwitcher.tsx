import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import { ProfileEditModal } from './ProfileEditModal';
import { ProfileIcon } from '../lib/profileIcons';

/**
 * Arc の Space 切り替えのような、サイドバー下部のプロファイル列。
 * クリックで切り替え、ダブルクリック／右クリックで編集、＋で追加。
 * 横スワイプでの切り替えは Sidebar（useProfileSlide）が担当する。
 */
export function ProfileSwitcher() {
  const profiles = useAppStore((s) => s.profiles);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);
  const badges = useAppStore((s) => s.serviceBadges);
  const services = useAppStore((s) => s.services);
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  // プロファイルごとの未読合計（他プロファイルの新着に気づけるように）
  const unreadOf = (pid: string) =>
    services
      .filter((s) => (s.profileId ?? 'default') === pid)
      .reduce((a, s) => a + (badges[s.id] > 0 ? badges[s.id] : 0), 0);

  return (
    <div className="profile-switcher">
      {profiles.map((p, i) => {
        const unread = p.id === activeProfileId ? 0 : unreadOf(p.id);
        return (
          <button
            key={p.id}
            className={`profile-dot ${p.id === activeProfileId ? 'active' : ''}`}
            style={{ ['--dot-color' as string]: p.color }}
            title={`${p.name}（⌃${i + 1}）・ダブルクリックで編集`}
            onClick={() => setActiveProfile(p.id)}
            onDoubleClick={() => setEditing(p.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setEditing(p.id);
            }}
          >
            <ProfileIcon icon={p.icon} />
            {unread > 0 && <span className="profile-dot-badge" />}
          </button>
        );
      })}
      <button
        className="profile-dot add"
        title="プロファイルを追加"
        onClick={() => setEditing('new')}
      >
        <FiPlus size={14} />
      </button>
      {editing && (
        <ProfileEditModal
          profileId={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
