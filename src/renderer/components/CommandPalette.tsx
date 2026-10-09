import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiSearch,
  FiClock,
  FiCornerDownLeft,
  FiBookOpen,
  FiCalendar,
  FiCheckSquare,
} from 'react-icons/fi';
import { useAppStore, useProfileServices } from '../store/useAppStore';
import { ServiceIcon } from './ServiceIcon';
import { getServiceSearchUrl } from '../lib/search';

type Props = {
  onClose: () => void;
};

type Item =
  | { kind: 'history'; id: string; serviceId: string; serviceName: string; icon: string; title: string; url: string }
  | { kind: 'search'; id: string; serviceId: string; serviceName: string; icon: string; url: string }
  | { kind: 'classroom'; id: string; serviceId: string; serviceName: string; icon: string; title: string; sub: string; url: string }
  | { kind: 'calendar'; id: string; serviceId: string; serviceName: string; icon: string; title: string; url: string }
  | { kind: 'addTask'; id: string; title: string }
  | { kind: 'task'; id: string; title: string; sub: string }
  | { kind: 'profile'; id: string; profileId: string; title: string; emoji: string };

export function CommandPalette({ onClose }: Props) {
  const history = useAppStore((s) => s.history);
  const services = useProfileServices();
  const navigateService = useAppStore((s) => s.navigateService);
  const classroomItems = useAppStore((s) => s.classroomItems);
  const calendarRaw = useAppStore((s) => s.calendarRaw);
  const tasks = useAppStore((s) => s.tasks);
  const profiles = useAppStore((s) => s.profiles);
  const addTask = useAppStore((s) => s.addTask);
  const setView = useAppStore((s) => s.setView);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);

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

    // タスク: 「+ タスクを追加」と、一致する未完了タスク
    const taskItems: Item[] = q
      ? [
          { kind: 'addTask', id: 'add-task', title: query.trim().replace(/^[+＋]\s*/, '') } as Item,
          ...tasks
            .filter((t) => !t.done && t.title.toLowerCase().includes(q))
            .slice(0, 5)
            .map(
              (t) =>
                ({
                  kind: 'task',
                  id: `task-${t.id}`,
                  title: t.title,
                  sub: t.due ? `期限 ${t.due.slice(0, 10)}` : '期限なし',
                }) as Item
            ),
        ]
      : [];

    // プロファイル切り替え
    const profileItems: Item[] = q
      ? profiles
          .filter((p) => p.name.toLowerCase().includes(q))
          .map((p) => ({
            kind: 'profile',
            id: `profile-${p.id}`,
            profileId: p.id,
            title: p.name,
            emoji: p.emoji,
          }))
      : [];

    // 「+」で始まる入力はタスク追加を先頭に
    const taskFirst = /^[+＋]/.test(query.trim());
    return taskFirst
      ? [...taskItems, ...profileItems, ...histItems]
      : [
          ...profileItems,
          ...histItems,
          ...classroomMatches,
          ...calendarMatches,
          ...searchItems,
          ...taskItems,
        ];
  }, [query, history, services, classroomItems, calendarRaw, classroomService, calendarService, tasks, profiles]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const choose = (item: Item) => {
    if (item.kind === 'addTask') {
      if (item.title) addTask({ title: item.title, source: 'manual' });
      setView('tasks');
      onClose();
      return;
    }
    if (item.kind === 'task') {
      setView('tasks');
      onClose();
      return;
    }
    if (item.kind === 'profile') {
      setActiveProfile(item.profileId);
      onClose();
      return;
    }
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
            placeholder="検索（履歴・課題・予定・タスク）／ + でタスク追加"
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
                {item.kind === 'addTask' || item.kind === 'task' ? (
                  <FiCheckSquare size={20} style={{ color: 'var(--accent)', margin: '0 2px' }} />
                ) : item.kind === 'profile' ? (
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.emoji}</span>
                ) : (
                  <ServiceIcon iconKey={item.icon} chip={24} />
                )}
                {item.kind === 'addTask' ? (
                  <div className="cp-item-body">
                    <div className="cp-item-title">タスクを追加:「{item.title}」</div>
                    <div className="cp-item-sub">先頭に + を付けるとすぐ追加できます</div>
                  </div>
                ) : item.kind === 'task' ? (
                  <div className="cp-item-body">
                    <div className="cp-item-title">{item.title}</div>
                    <div className="cp-item-sub">タスク・{item.sub}</div>
                  </div>
                ) : item.kind === 'profile' ? (
                  <div className="cp-item-body">
                    <div className="cp-item-title">{item.title} に切り替え</div>
                    <div className="cp-item-sub">プロファイル</div>
                  </div>
                ) : item.kind === 'history' ? (
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
