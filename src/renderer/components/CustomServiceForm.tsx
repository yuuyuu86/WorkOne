import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type Service,
  type ServiceCategory,
} from '../types/service';
import { CUSTOM_ICON_CHOICES, faviconUrlFor } from '../data/iconMap';
import { ServiceIcon } from './ServiceIcon';

type Props = {
  /** 指定すると編集モードになる */
  editing?: Service;
  onAdded: () => void;
};

// 入力された URL を正規化する。スキームが無ければ https:// を補う。
function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

// http:// または https:// で始まる正しい URL か
function isValidUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const FAVICON = 'favicon';

export function CustomServiceForm({ editing, onAdded }: Props) {
  const addCustomService = useAppStore((s) => s.addCustomService);
  const updateService = useAppStore((s) => s.updateService);

  const [name, setName] = useState(editing?.name ?? '');
  const [url, setUrl] = useState(editing?.url ?? '');
  const [category, setCategory] = useState<ServiceCategory>(
    editing?.category ?? 'custom'
  );
  // editing.icon が画像 URL（ファビコン）なら FAVICON 選択状態にする
  const initialIcon =
    editing && /^https?:\/\//i.test(editing.icon) ? FAVICON : editing?.icon ?? 'web';
  const [icon, setIcon] = useState(initialIcon);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('表示名を入力してください。');
      return;
    }
    const normalized = normalizeUrl(url);
    if (!isValidUrl(normalized)) {
      setError('URL は http:// または https:// から始まる必要があります。');
      return;
    }
    // ファビコン選択時は、URL のドメインからファビコン画像 URL を icon に保存
    let iconValue = icon;
    if (icon === FAVICON) {
      iconValue = faviconUrlFor(normalized) ?? 'web';
    }
    const input = { name, url: normalized, category, icon: iconValue };
    if (editing) {
      updateService(editing.id, input);
    } else {
      addCustomService(input);
    }
    onAdded();
  };

  const faviconPreview = faviconUrlFor(normalizeUrl(url));

  return (
    <div>
      {!editing && (
        <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>
          学校ポータル、Webメール、掲示板、独自の連絡サイトなどを自由に追加できます。
        </p>
      )}

      <div className="field">
        <label>表示名</label>
        <input
          type="text"
          value={name}
          placeholder="例: 学校ポータル"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label>URL</label>
        <input
          type="text"
          value={url}
          placeholder="example.ac.jp/portal（https:// は省略可）"
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div className="field">
        <label>カテゴリ</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ServiceCategory)}
        >
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>アイコン</label>
        <div className="icon-choice-row">
          {/* サイトのファビコンを使う */}
          <button
            type="button"
            className={`icon-choice ${icon === FAVICON ? 'selected' : ''}`}
            onClick={() => setIcon(FAVICON)}
            title="サイトのアイコンを使う"
          >
            {faviconPreview ? (
              <img src={faviconPreview} alt="" width={18} height={18} />
            ) : (
              <ServiceIcon iconKey="web" size={18} />
            )}
            サイト
          </button>
          {CUSTOM_ICON_CHOICES.map((choice) => (
            <button
              key={choice.key}
              type="button"
              className={`icon-choice ${icon === choice.key ? 'selected' : ''}`}
              onClick={() => setIcon(choice.key)}
            >
              <ServiceIcon iconKey={choice.key} size={18} />
              {choice.label}
            </button>
          ))}
        </div>
        {icon === FAVICON && (
          <p className="muted" style={{ marginTop: 6 }}>
            URL のサイトのアイコンを自動取得して使います。
          </p>
        )}
      </div>

      {error && <div className="field-error">{error}</div>}

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 8 }}
        onClick={handleSubmit}
      >
        {editing ? '保存する' : '追加する'}
      </button>
    </div>
  );
}
