import { useEffect, useState } from 'react';
import { FiX, FiArrowRight, FiArrowLeft, FiBell, FiShield } from 'react-icons/fi';
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
  const openService = useAppStore((s) => s.openService);
  const setView = useAppStore((s) => s.setView);

  const steps: Step[] = [
    {
      selector: '[data-tour="services"]',
      title: 'サービス一覧',
      body: 'クリックでサービスを切り替えられます。ドラッグで並び替え、Slack は複数ワークスペースをまとめて1つのプルダウンに表示します。',
      skip: () => useAppStore.getState().services.length === 0,
    },
    {
      selector: '[data-tour="add-service"]',
      title: 'サービスを追加',
      body: 'Gmail / Slack / Classroom などをここから追加できます。Slack は複数ワークスペースを個別に追加可能、学校ポータルなどの独自 URL も追加できます。',
    },
    {
      selector: '[data-tour="search"]',
      title: '検索',
      body: '⌘K（Windows は Ctrl+K）でいつでも検索できます。サービス名や閲覧履歴から目的のページに飛べます。',
    },
    {
      selector: '[data-tour="nav-views"]',
      title: 'Home / Inbox / あとで見る',
      body: 'Inbox には各サービスの通知が集約されます。あとで見るは、気になったページを保存しておけるリストです。',
    },
    {
      selector: '[data-tour="service-toolbar"]',
      title: 'サービスを開いたときの操作',
      body: 'ホームボタンで最初のページに戻れます。動画だけを小窓（ピクチャーインピクチャー）にしたり、ページ全体を常に最前面の小窓に固定することもできます。',
      beforeShow: () => {
        const st = useAppStore.getState();
        if (st.activeView !== 'service' && st.services.length > 0) {
          openService(st.services[0].id);
        }
      },
      skip: () => useAppStore.getState().services.length === 0,
    },
    {
      title: '通知の許可について',
      icon: <FiBell size={18} />,
      body: '初めてサービスを開いて通知が発生すると、macOS が通知の許可を確認することがあります。許可すると新着が Inbox と OS 通知の両方に届きます。許可しなくても後から各サービスの設定で有効化できます。',
    },
    {
      selector: '[data-tour="focus-mode"]',
      title: '集中モード',
      body: '通知を出すサービスを絞り込めます。「完全集中モード」ではサービス一覧そのものを隠せます。',
    },
    {
      selector: '[data-tour="settings"]',
      title: '設定',
      body: 'テーマ・サイドバーの幅・通知の重要設定/ミュート・おやすみ時間・バックアップ（書き出し/読み込み）などはすべて設定にまとまっています。',
    },
    {
      title: 'これで準備完了です',
      icon: <FiShield size={18} />,
      body: (
        <>
          ログインが切れたときは画面上部に再ログインの案内が表示されます。
          ID・パスワードやメール本文はどこにも保存・送信されません。
          <br />
          このツアーは <strong>?</strong> キー（ショートカット一覧）からいつでも見返せます。
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
