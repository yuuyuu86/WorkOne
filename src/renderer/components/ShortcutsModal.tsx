import { FiX } from 'react-icons/fi';

type Props = {
  onClose: () => void;
};

// 表示用。Cmd は mac、Ctrl はそれ以外。
const isMac =
  typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
const MOD = isMac ? 'Cmd' : 'Ctrl';

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: '基本操作',
    items: [
      ['検索（コマンドパレット）', `${MOD} + K`],
      ['サービスを追加', `${MOD} + N`],
      ['設定', `${MOD} + ,`],
      ['ショートカット一覧', `${MOD} + /（または ?）`],
    ],
  },
  {
    title: '画面の移動',
    items: [
      ['Home', `${MOD} + 1`],
      ['Inbox', `${MOD} + 2`],
      ['あとで見る', `${MOD} + 3`],
      ['次のサービス', `${MOD} + Shift + ]`],
      ['前のサービス', `${MOD} + Shift + [`],
    ],
  },
  {
    title: '表示中のサービス',
    items: [
      ['再読み込み', `${MOD} + R`],
      ['戻る', `${MOD} + [`],
      ['進む', `${MOD} + ]`],
      ['拡大', `${MOD} + +`],
      ['縮小', `${MOD} + -`],
      ['実際のサイズ', `${MOD} + 0`],
    ],
  },
];

export function ShortcutsModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>キーボードショートカット</h3>
          <button className="icon-btn" onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>
        <div className="modal-body">
          <button
            className="btn btn-block"
            style={{ marginBottom: 20 }}
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent('md:show-tour'));
            }}
          >
            使い方ツアーを見る
          </button>
          {GROUPS.map((g) => (
            <div key={g.title} className="section" style={{ marginBottom: 20 }}>
              <h3 className="section-title">{g.title}</h3>
              <div className="card">
                {g.items.map(([label, keys]) => (
                  <div className="list-row" key={label}>
                    <span className="grow">{label}</span>
                    <span className="cp-kbd">{keys}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
