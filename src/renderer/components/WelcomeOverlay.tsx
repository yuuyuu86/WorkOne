import { useEffect, useState } from 'react';
import {
  FiInbox,
  FiCheck,
  FiPlus,
  FiArrowRight,
  FiBell,
  FiSearch,
  FiShield,
} from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import { SERVICE_TEMPLATES } from '../data/serviceTemplates';
import { getIconColor } from '../data/iconMap';
import { ServiceIcon } from './ServiceIcon';
import type { ServiceTemplate } from '../types/service';

type Props = {
  onDone: () => void;
};

// アニメーションで中央へ集まるサービスアイコン
const FLY_ICONS = [
  'gmail',
  'slack',
  'calendar',
  'classroom',
  'discord',
  'outlook',
  'drive',
  'teams',
];

const isMac =
  typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

// 使い方のヒント
const TIPS: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <FiBell size={16} />,
    title: '通知はひとつのInboxへ',
    body: '各サービスの設定で「デスクトップ通知」をオンにすると、新着が Inbox にまとまります。',
  },
  {
    icon: <FiSearch size={16} />,
    title: 'すばやく開く・探す',
    body: `${MOD}K で検索、? でショートカット一覧。サイドバーから各サービスをすぐ開けます。`,
  },
  {
    icon: <FiInbox size={16} />,
    title: '閉じても受信し続ける',
    body: 'ウィンドウを閉じてもバックグラウンドで常駐し、通知を受け取り続けます（メニューバー／Dock から復帰）。',
  },
  {
    icon: <FiShield size={16} />,
    title: 'ログイン情報は保存しません',
    body: 'ログインは各サービスの公式画面で行います。ID・パスワードやメール本文は保存しません。',
  },
];

// オンボーディングで提案する代表的なサービス（テンプレートキーで指定）
const SUGGESTED_KEYS = [
  'gmail',
  'slack',
  'google-calendar',
  'classroom',
  'discord',
  'outlook',
];

export function WelcomeOverlay({ onDone }: Props) {
  const [phase, setPhase] = useState<'intro' | 'onboarding'>('intro');
  const [closing, setClosing] = useState(false);
  const addServiceFromTemplate = useAppStore((s) => s.addServiceFromTemplate);
  const isTemplateAdded = useAppStore((s) => s.isTemplateAdded);
  useAppStore((s) => s.services); // 追加済み表示を即時更新

  // 「はじめる」を押したら、ふわっと消してから次（ツアー）へ渡す。
  // 唐突にハイライト画面へ切り替わらないようにするためのクッション。
  const handleStart = () => {
    setClosing(true);
    setTimeout(onDone, 350);
  };

  // イントロ（集約アニメ）を再生したら自動でオンボーディングへ
  useEffect(() => {
    if (phase !== 'intro') return;
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    // 集約(〜2.8s)→ロゴpop(〜3.2s)→タイトル/コピー(〜3.85s)。
    // そのあとロゴをしっかり見せてから遷移する。
    const t = setTimeout(() => setPhase('onboarding'), reduce ? 300 : 5200);
    return () => clearTimeout(t);
  }, [phase]);

  const suggested = SUGGESTED_KEYS.map((k) =>
    SERVICE_TEMPLATES.find((t) => t.templateKey === k)
  ).filter((t): t is ServiceTemplate => Boolean(t));

  const n = FLY_ICONS.length;
  const radius = 220;

  return (
    <div className={`welcome-overlay ${closing ? 'welcome-closing' : ''}`}>
      {phase === 'intro' ? (
        <div className="welcome-intro">
          <div className="welcome-stage">
            {FLY_ICONS.map((key, i) => {
              const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
              const dx = Math.cos(angle) * radius;
              const dy = Math.sin(angle) * radius;
              return (
                <span
                  key={key}
                  className="welcome-fly"
                  style={
                    {
                      background: getIconColor(key) ?? 'var(--text-secondary)',
                      '--dx': `${dx}px`,
                      '--dy': `${dy}px`,
                      animationDelay: `${i * 0.05}s`,
                    } as React.CSSProperties
                  }
                >
                  <ServiceIcon iconKey={key} size={22} />
                </span>
              );
            })}
            <span className="welcome-logo">
              <FiInbox size={40} />
            </span>
          </div>
          <h1 className="welcome-title">WorkOne</h1>
          <p className="welcome-tagline">連絡を、ひとつに。</p>
          <button className="btn btn-ghost welcome-skip" onClick={() => setPhase('onboarding')}>
            スキップ
          </button>
        </div>
      ) : (
        <div className="welcome-onboarding">
          <h2>さっそく始めましょう</h2>
          <p className="muted">
            よく使うサービスを選んで追加できます。あとから「設定 →
            サービスを追加」でいつでも変更できます。
          </p>
          <div className="welcome-grid">
            {suggested.map((t) => {
              const added = isTemplateAdded(t);
              return (
                <button
                  key={t.templateKey}
                  className={`welcome-card ${added ? 'added' : ''}`}
                  onClick={() => !added && addServiceFromTemplate(t)}
                  disabled={added}
                >
                  <span
                    className="welcome-card-icon"
                    style={{
                      background: getIconColor(t.icon) ?? 'var(--text-secondary)',
                    }}
                  >
                    <ServiceIcon iconKey={t.icon} size={20} />
                  </span>
                  <span className="welcome-card-name">{t.name}</span>
                  <span className="welcome-card-act">
                    {added ? <FiCheck size={16} /> : <FiPlus size={16} />}
                  </span>
                </button>
              );
            })}
          </div>

          <h3 className="welcome-tips-title">使い方のヒント</h3>
          <div className="welcome-tips">
            {TIPS.map((t) => (
              <div className="welcome-tip" key={t.title}>
                <span className="welcome-tip-icon">{t.icon}</span>
                <div>
                  <div className="welcome-tip-title">{t.title}</div>
                  <div className="welcome-tip-body">{t.body}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-primary welcome-start" onClick={handleStart}>
            はじめる <FiArrowRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
