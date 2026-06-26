import { useEffect, useMemo, useRef, useState } from 'react';
import { FiSearch, FiClock, FiCornerDownLeft } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import { ServiceIcon } from './ServiceIcon';
import { getServiceSearchUrl } from '../lib/search';

type Props = {
  onClose: () => void;
};

type Item =
  | { kind: 'history'; id: string; serviceId: string; serviceName: string; icon: string; title: string; url: string }
  | { kind: 'search'; id: string; serviceId: string; serviceName: string; icon: string; url: string };

export function CommandPalette({ onClose }: Props) {
  const history = useAppStore((s) => s.history);
  const services = useAppStore((s) => s.services);
  const navigateService = useAppStore((s) => s.navigateService);

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    // 履歴の一致（クエリ無しなら最近の履歴）
    const matched = (
      q
        ? history.filter(
            (h) =>
              h.title.toLowerCase().includes(q) ||
              h.url.toLowerCase().includes(q) ||
              h.serviceName.toLowerCase().includes(q)
          )
        : history
    ).slice(0, 8);

    const histItems: Item[] = matched.map((h) => ({
      kind: 'history',
      id: h.id,
      serviceId: h.serviceId,
      serviceName: h.serviceName,
      icon: h.icon,
      title: h.title,
      url: h.url,
    }));

    // サービス内検索（クエリがある時だけ・検索URL対応サービス）
    const searchItems: Item[] = q
      ? services
          .map((svc) => {
            const url = getServiceSearchUrl(svc, query);
            return url
              ? ({
                  kind: 'search',
                  id: `search-${svc.id}`,
                  serviceId: svc.id,
                  serviceName: svc.name,
                  icon: svc.icon,
                  url,
                } as Item)
              : null;
          })
          .filter((x): x is Item => x !== null)
      : [];

    return [...histItems, ...searchItems];
  }, [query, history, services]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (item: Item) => {
    navigateService(item.serviceId, item.url);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (items[active]) choose(items[active]);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="command-palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="cp-input-row">
          <FiSearch size={18} style={{ color: 'var(--text-tertiary)' }} />
          <input
            ref={inputRef}
            value={query}
            placeholder="キーワードで検索（あの時見たメール / メッセージ…）"
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="cp-kbd">Esc</kbd>
        </div>

        <div className="cp-results">
          {items.length === 0 ? (
            <div className="cp-empty">
              {query.trim()
                ? '一致する履歴がありません。各サービスを開くと履歴に記録されます。'
                : 'まだ履歴がありません。サービスでページを開くと、ここから探せます。'}
            </div>
          ) : (
            items.map((item, i) => (
              <button
                key={item.id}
                className={`cp-item ${i === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
              >
                <ServiceIcon iconKey={item.icon} chip={24} />
                {item.kind === 'history' ? (
                  <div className="cp-item-body">
                    <div className="cp-item-title">{item.title}</div>
                    <div className="cp-item-sub">
                      <FiClock size={11} /> {item.serviceName}
                    </div>
                  </div>
                ) : (
                  <div className="cp-item-body">
                    <div className="cp-item-title">
                      「{query.trim()}」を {item.serviceName} で検索
                    </div>
                    <div className="cp-item-sub">
                      <FiSearch size={11} /> サービス内検索
                    </div>
                  </div>
                )}
                {i === active && (
                  <FiCornerDownLeft
                    size={14}
                    style={{ color: 'var(--text-tertiary)' }}
                  />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
