import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiSearch,
  FiClock,
  FiCornerDownLeft,
  FiBookOpen,
  FiCalendar,
} from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import { ServiceIcon } from './ServiceIcon';
import { getServiceSearchUrl } from '../lib/search';

type Props = {
  onClose: () => void;
};

type Item =
  | { kind: 'history'; id: string; serviceId: string; serviceName: string; icon: string; title: string; url: string }
  | { kind: 'search'; id: string; serviceId: string; serviceName: string; icon: string; url: string }
  | { kind: 'classroom'; id: string; serviceId: string; serviceName: string; icon: string; title: string; sub: string; url: string }
  | { kind: 'calendar'; id: string; serviceId: string; serviceName: string; icon: string; title: string; url: string };

export function CommandPalette({ onClose }: Props) {
  const history = useAppStore((s) => s.history);
  const services = useAppStore((s) => s.services);
  const navigateService = useAppStore((s) => s.navigateService);
  const classroomItems = useAppStore((s) => s.classroomItems);
  const calendarRaw = useAppStore((s) => s.calendarRaw);

  const classroomService = services.find((s) => {
    try {
      return new URL(s.url).hostname.endsWith('classroom.google.com');
    } catch {
      return false;
    }
  });
  const calendarService = services.find((s) => {
    try {
      return new URL(s.url).hostname.endsWith('calendar.google.com');
    } catch {
      return false;
    }
  });

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

    // Classroom の課題（クエリがある時だけ。タイトル/コース名で一致）
    const classroomMatches: Item[] = q
      ? classroomItems
          .filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              c.course.toLowerCase().includes(q)
          )
          .slice(0, 6)
          .map((c) => ({
            kind: 'classroom',
            id: `classroom-${c.href}`,
            serviceId: classroomService?.id ?? '',
            serviceName: classroomService?.name ?? 'Google Classroom',
            icon: classroomService?.icon ?? 'classroom',
            title: c.title,
            sub: `${c.course}${c.due ? `　${c.due}` : ''}`,
            url: c.href,
          }))
      : [];

    // カレンダーの予定（クエリがある時だけ。キャッシュ済みラベルから一致するもの）
    const calendarMatches: Item[] = q
      ? calendarRaw
          .filter((label) => label.toLowerCase().includes(q))
          .slice(0, 6)
          .map((label, i) => ({
            kind: 'calendar',
            id: `calendar-${i}-${label.slice(0, 20)}`,
            serviceId: calendarService?.id ?? '',
            serviceName: calendarService?.name ?? 'Google Calendar',
            icon: calendarService?.icon ?? 'calendar',
            title: label,
            url: calendarService?.url ?? '',
          }))
      : [];

    return [...histItems, ...classroomMatches, ...calendarMatches, ...searchItems];
  }, [query, history, services, classroomItems, calendarRaw, classroomService, calendarService]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (item: Item) => {
    if (!item.serviceId || !item.url) {
      onClose();
      return;
    }
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
            placeholder="キーワードで検索（履歴・課題・予定…）"
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
                ) : item.kind === 'classroom' ? (
                  <div className="cp-item-body">
                    <div className="cp-item-title">{item.title}</div>
                    <div className="cp-item-sub">
                      <FiBookOpen size={11} /> {item.sub}
                    </div>
                  </div>
                ) : item.kind === 'calendar' ? (
                  <div className="cp-item-body">
                    <div className="cp-item-title">{item.title}</div>
                    <div className="cp-item-sub">
                      <FiCalendar size={11} /> {item.serviceName}
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
