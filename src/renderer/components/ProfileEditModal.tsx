import { useState } from 'react';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { PROFILE_COLORS, useAppStore } from '../store/useAppStore';
import { DEFAULT_PROFILE_ID, type ProfileSchedule } from '../types/service';
import { confirmAction } from '../lib/confirm';
import { PROFILE_ICON_KEYS, ProfileIcon } from '../lib/profileIcons';

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

type Props = {
  /** null なら新規作成 */
  profileId: string | null;
  onClose: () => void;
};

export function ProfileEditModal({ profileId, onClose }: Props) {
  const existing = useAppStore((s) =>
    profileId ? s.profiles.find((p) => p.id === profileId) : undefined
  );
  const profileCount = useAppStore((s) => s.profiles.length);
  const addProfile = useAppStore((s) => s.addProfile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const removeProfile = useAppStore((s) => s.removeProfile);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(
    existing?.icon ?? PROFILE_ICON_KEYS[profileCount % PROFILE_ICON_KEYS.length]
  );
  const [color, setColor] = useState(
    existing?.color ?? PROFILE_COLORS[profileCount % PROFILE_COLORS.length]
  );
  const [schedule, setSchedule] = useState<ProfileSchedule[]>(
    existing?.schedule ?? []
  );

  const save = () => {
    const trimmed = name.trim() || '新しいプロファイル';
    if (existing) {
      updateProfile(existing.id, { name: trimmed, icon, color, schedule });
    } else {
      const id = addProfile({ name: trimmed, icon, color });
      updateProfile(id, { schedule });
      setActiveProfile(id);
    }
    onClose();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAction(
      `プロファイル「${existing.name}」を削除しますか？\nこのプロファイルのサービスとタスクも削除されます。`
    );
    if (!ok) return;
    removeProfile(existing.id);
    onClose();
  };

  const updateSlot = (i: number, patch: Partial<ProfileSchedule>) =>
    setSchedule((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{existing ? 'プロファイルを編集' : 'プロファイルを追加'}</h3>
          <button className="icon-btn" onClick={onClose} title="閉じる">
            <FiX size={16} />
          </button>
        </div>
        <div className="modal-body profile-form">
          <label className="form-label">名前</label>
          <input
            autoFocus
            value={name}
            placeholder="例: 学校"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />

          <label className="form-label">アイコン</label>
          <div className="profile-choice-row">
            {PROFILE_ICON_KEYS.map((key) => (
              <button
                key={key}
                className={`profile-choice ${key === icon ? 'active' : ''}`}
                style={key === icon ? { color } : undefined}
                onClick={() => setIcon(key)}
              >
                <ProfileIcon icon={key} size={16} />
              </button>
            ))}
          </div>

          <label className="form-label">色</label>
          <div className="profile-choice-row">
            {PROFILE_COLORS.map((c) => (
              <button
                key={c}
                className={`profile-swatch ${c === color ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>

          <label className="form-label">時間割（自動切り替え）</label>
          <p className="form-hint">
            設定の「時間割で自動切り替え」が ON のとき、この時間帯はこのプロファイルになります。
          </p>
          {schedule.map((slot, i) => (
            <div key={i} className="schedule-row">
              <div className="schedule-days">
                {DAY_LABELS.map((d, day) => (
                  <button
                    key={d}
                    className={`schedule-day ${slot.days.includes(day) ? 'active' : ''}`}
                    onClick={() =>
                      updateSlot(i, {
                        days: slot.days.includes(day)
                          ? slot.days.filter((x) => x !== day)
                          : [...slot.days, day].sort(),
                      })
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
              <input
                type="time"
                value={slot.start}
                onChange={(e) => updateSlot(i, { start: e.target.value })}
              />
              <span>〜</span>
              <input
                type="time"
                value={slot.end}
                onChange={(e) => updateSlot(i, { end: e.target.value })}
              />
              <button
                className="icon-btn"
                title="削除"
                onClick={() => setSchedule((s) => s.filter((_, j) => j !== i))}
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          ))}
          <button
            className="btn btn-sm"
            onClick={() =>
              setSchedule((s) => [
                ...s,
                { days: [1, 2, 3, 4, 5], start: '08:30', end: '15:30' },
              ])
            }
          >
            <FiPlus size={13} /> 時間帯を追加
          </button>

          {!existing && (
            <p className="form-hint">
              新しいプロファイルはログイン状態が別になります。追加後、このプロファイルでサービスを追加してログインしてください。
            </p>
          )}
        </div>
        <div className="modal-footer">
          {existing && existing.id !== DEFAULT_PROFILE_ID && (
            <button className="btn btn-danger" onClick={remove} style={{ marginRight: 'auto' }}>
              削除
            </button>
          )}
          <button className="btn" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
