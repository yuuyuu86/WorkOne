import type { IconType } from 'react-icons';
import { FiGrid, FiTarget, FiMoon } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import type { FocusMode } from '../types/service';
import { ServiceIcon } from './ServiceIcon';

const MODES: {
  key: FocusMode;
  label: string;
  desc: string;
  Icon: IconType;
}[] = [
  {
    key: 'normal',
    label: '通常モード',
    desc: '追加済みのすべてのサービスをサイドバーに表示します。',
    Icon: FiGrid,
  },
  {
    key: 'focus',
    label: '集中モード',
    desc: '下で選んだサービスだけをサイドバーに表示します。',
    Icon: FiTarget,
  },
  {
    key: 'deep',
    label: '完全集中モード',
    desc: 'サービス一覧を隠し、Home・Inbox・あとで見る・設定だけを表示します。',
    Icon: FiMoon,
  },
];

export function FocusModeView() {
  const focusMode = useAppStore((s) => s.focusMode);
  const setFocusMode = useAppStore((s) => s.setFocusMode);
  const services = useAppStore((s) => s.services);
  const focusServiceIds = useAppStore((s) => s.focusServiceIds);
  const toggleFocusService = useAppStore((s) => s.toggleFocusService);

  return (
    <div className="content-scroll">
      <div className="page-header">
        <h2>集中モード</h2>
        <p>表示するサービスを絞って、気が散らないようにします。</p>
      </div>

      <div className="section">
        <h3 className="section-title">モード</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MODES.map((m) => (
            <button
              key={m.key}
              className="card"
              onClick={() => setFocusMode(m.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: 16,
                textAlign: 'left',
                cursor: 'pointer',
                borderColor:
                  focusMode === m.key ? 'var(--accent)' : 'var(--border)',
                background:
                  focusMode === m.key ? 'var(--accent-soft)' : 'var(--panel-bg)',
              }}
            >
              <m.Icon
                size={20}
                style={{
                  color:
                    focusMode === m.key ? 'var(--accent)' : 'var(--text-tertiary)',
                }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{m.label}</div>
                <div className="muted" style={{ marginTop: 2 }}>
                  {m.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">集中モードで表示するサービス</h3>
        {services.length === 0 ? (
          <p className="muted">先にサービスを追加してください。</p>
        ) : (
          <div className="card">
            {services.map((svc) => (
              <label className="check-row" key={svc.id}>
                <input
                  type="checkbox"
                  checked={focusServiceIds.includes(svc.id)}
                  onChange={() => toggleFocusService(svc.id)}
                />
                <ServiceIcon iconKey={svc.icon} chip={24} />
                <span className="grow">{svc.name}</span>
              </label>
            ))}
          </div>
        )}
        <p className="muted" style={{ marginTop: 10 }}>
          ここでの選択は「集中モード」で表示するサービスに反映されます。
        </p>
      </div>
    </div>
  );
}
