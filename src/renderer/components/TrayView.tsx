import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiInbox, FiCheck, FiPlus, FiExternalLink } from 'react-icons/fi';
import { useAppStore, useActiveProfile } from '../store/useAppStore';
import { todayEvents } from '../lib/calendar';
import { ProfileIcon } from '../lib/profileIcons';
import { ServiceIcon } from './ServiceIcon';
import { dueLabel } from './DuePicker';

const pad = (x: number) => String(x).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 本体ウィンドウと同じ保存領域（localStorage）を読む。本体側の変更は storage イベントで受け取る。
const rehydrate = () => useAppStore.persist.rehydrate();

/**
 * メニューバーのミニ版。次の予定・対応が必要な通知・今日のタスクをすぐ見られる。
 * 操作はタスクの完了と追加だけにして、それ以外は本体の画面を開く。
 */
export function TrayView() {
  const calendarRaw = useAppStore((s) => s.calendarRaw);
  const notifications = useAppStore((s) => s.notifications);
  const tasks = useAppStore((s) => s.tasks);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const theme = useAppStore((s) => s.theme);
  const profile = useActiveProfile();
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState('');

  // 本体の変更を反映（別ウィンドウの書き込みは storage イベントで届く）＋ 表示のたびに最新化
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'workone-store') rehydrate();
    };
    window.addEventListener('storage', onStorage);
    const off = window.workOne?.onTrayShown?.(() => {
      rehydrate();
      setNow(new Date());
    });
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => {
      window.removeEventListener('storage', onStorage);
      off?.();
      clearInterval(t);
    };
  }, []);

  // 外観（本体と同じ判定）
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.setAttribute(
        'data-theme',
        theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme
      );
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  // 次の予定（これから始まる時刻つき予定。無ければ今日の終日予定）
  const nextEvent = useMemo(() => {
    const events = todayEvents(calendarRaw);
    const cur = now.getHours() * 60 + now.getMinutes();
    return events.find((e) => e.startMin >= cur) ?? events.find((e) => e.startMin < 0) ?? null;
  }, [calendarRaw, now]);

  const open = notifications.filter((n) => !n.done && !n.snoozedUntil);
  const unread = open.filter((n) => !n.read).length;
  const top = [...open].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);

  const today = ymd(now);
  const todayTasks = tasks
    .filter((t) => !t.done && t.profileId === activeProfileId && t.due && t.due.slice(0, 10) <= today)
    .sort((a, b) => `${a.due}${a.dueTime ?? ''}`.localeCompare(`${b.due}${b.dueTime ?? ''}`))
    .slice(0, 5);

  const openMain = (target: { view?: string; serviceId?: string }) =>
    window.workOne?.trayOpen?.(target);

  // 書き込む前に最新を読み直し、本体側の新しい変更を上書きしないようにする
  const complete = (id: string) => {
    rehydrate();
    useAppStore.getState().toggleTaskDone(id);
  };
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    rehydrate();
    useAppStore.getState().addTask({ title, due: today, source: 'manual' });
    setDraft('');
  };

  return (
    <div className="tray">
      <div className="tray-head">
        <span className="tray-profile" style={{ color: profile.color }}>
          <ProfileIcon icon={profile.icon} size={14} />
          {profile.name}
        </span>
        <span className="tray-date">
          {now.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
        </span>
        <button className="icon-btn" title="WorkOne を開く" onClick={() => openMain({ view: 'today' })}>
          <FiExternalLink size={14} />
        </button>
      </div>

      <section className="tray-section">
        <div className="tray-label">
          <FiCalendar size={12} /> 次の予定
        </div>
        {nextEvent ? (
          <div className="tray-event">
            <span className="tray-event-time">{nextEvent.when}</span>
            <span className="tray-event-title">{nextEvent.title}</span>
          </div>
        ) : (
          <div className="tray-empty">今日の予定はもうありません</div>
        )}
      </section>

      <section className="tray-section">
        <button className="tray-label link" onClick={() => openMain({ view: 'inbox' })}>
          <FiInbox size={12} /> 対応が必要
          {unread > 0 && <span className="tray-count">{unread}</span>}
        </button>
        {top.length === 0 ? (
          <div className="tray-empty">受信箱は空です</div>
        ) : (
          top.map((n) => (
            <button
              key={n.id}
              className="tray-row"
              onClick={() => openMain({ view: 'service', serviceId: n.serviceId })}
            >
              <ServiceIcon iconKey={n.icon} chip={18} />
              <span className="tray-row-text">{(n.summary || n.title).replace(/[。.]+$/, '')}</span>
            </button>
          ))
        )}
      </section>

      <section className="tray-section grow">
        <button className="tray-label link" onClick={() => openMain({ view: 'tasks' })}>
          <FiCheck size={12} /> 今日のタスク
          {todayTasks.length > 0 && <span className="tray-count">{todayTasks.length}</span>}
        </button>
        {todayTasks.length === 0 && <div className="tray-empty">今日やることはありません</div>}
        {todayTasks.map((t) => (
          <div key={t.id} className="tray-row static">
            <button
              className={`check-circle sm prio-${t.priority ?? 'normal'}`}
              title="完了"
              onClick={() => complete(t.id)}
            />
            <span className="tray-row-text">{t.title}</span>
            {(t.due!.slice(0, 10) < today || t.dueTime) && (
              <span className={`tray-due ${t.due!.slice(0, 10) < today ? 'overdue' : ''}`}>
                {dueLabel(t.due, t.dueTime)}
              </span>
            )}
          </div>
        ))}
        <label className="tray-add">
          <FiPlus size={13} />
          <input
            value={draft}
            placeholder="今日のタスクを追加"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && add()}
          />
        </label>
      </section>
    </div>
  );
}
