import { useEffect, useState } from 'react';
import { FiX, FiArrowRight, FiArrowLeft, FiShield } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';

type Props = {
  onClose: () => void;
};

type Rect = { top: number; left: number; width: number; height: number };

type Step = {
  selector?: string; // 未指定なら中央カード（スポットライトなし）
  title: string;
  body: React.ReactNode;
  icon?: React.ReactNode;
  /** このステップを表示する前に実行（対象要素を出現させる等） */
  beforeShow?: () => void;
  /** true ならこのステップをスキップ */
  skip?: () => boolean;
};

const PADDING = 8;

function unionRect(selector: string): Rect | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  if (els.length === 0) return null;
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(top)) return null;
  return {
    top: top - PADDING,
    left: left - PADDING,
    width: right - left + PADDING * 2,
    height: bottom - top + PADDING * 2,
  };
}

export function TourOverlay({ onClose }: Props) {
  const setView = useAppStore((s) => s.setView);

  // 最初に覚えておけば十分な 3 つだけに絞る（細かい機能は使いながら見つけられる）
  const steps: Step[] = [
    {
      selector: '[data-tour="nav-views"]',
      title: 'Home・Inbox・タスク',
      body: 'Inbox には各サービスの通知が重要度順に集まります。完了・スヌーズ・タスク化で片付けましょう。気になったページはサービス画面の「あとで見る」でタスクに保存できます。',
    },
    {
      selector: '.profile-switcher',
      title: 'プロファイル',
      body: '「学校」「個人」のようにプロファイルを分けると、ログインもサービスも別々になります。ここをクリックするか、サイドバーを横にスワイプして切り替えます。',
    },
    {
      selector: '[data-tour="search"]',
      title: '⌘K でなんでも',
      icon: <FiShield size={18} />,
      body: (
        <>
          検索・タスク追加（先頭に + ）・プロファイル切り替えは ⌘K から。ID・パスワードやメール本文は
          どこにも保存・送信されません。このツアーは <strong>?</strong> キーからいつでも見返せます。
        </>
      ),
      beforeShow: () => setView('today'),
    },
  ];

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = steps[index];

  const goTo = (next: number) => {
    if (next < 0) return;
    if (next >= steps.length) {
      onClose();
      return;
    }
    setIndex(next);
  };

  // ステップ表示準備：スキップ判定 → beforeShow → 対象の位置を計測
  useEffect(() => {
    if (step.skip?.()) {
      goTo(index + 1);
      return;
    }
    step.beforeShow?.();
    const measure = () => {
      if (step.selector) setRect(unionRect(step.selector));
      else setRect(null);
    };
    const t = setTimeout(measure, 60);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const cardStyle: React.CSSProperties = rect
    ? (() => {
        const top = rect.top + rect.height + 14;
        const fitsBelow = top + 180 < window.innerHeight;
        return fitsBelow
          ? { top, left: Math.max(16, Math.min(rect.left, window.innerWidth - 360)) }
          : {
              top: Math.max(16, rect.top - 14 - 200),
              left: Math.max(16, Math.min(rect.left, window.innerWidth - 360)),
            };
      })()
    : {};

  return (
    <div className="tour-root">
      <div className="tour-blocker" onClick={() => goTo(index + 1)} />
      {rect && (
        <div
          className="tour-spotlight"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}
      <div
        className={`tour-card ${rect ? '' : 'tour-card-center'}`}
        style={rect ? cardStyle : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="icon-btn tour-close" onClick={onClose} title="ツアーを終了">
          <FiX size={16} />
        </button>
        {step.icon && <span className="tour-icon">{step.icon}</span>}
        <div className="tour-step-count">
          {index + 1} / {steps.length}
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button
            className="btn btn-sm"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
          >
            <FiArrowLeft size={13} /> 戻る
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            スキップ
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => goTo(index + 1)}>
            {index === steps.length - 1 ? '完了' : '次へ'} <FiArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
