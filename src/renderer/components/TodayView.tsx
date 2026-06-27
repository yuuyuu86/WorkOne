import { useEffect, useState } from 'react';
import {
  FiPlus,
  FiTarget,
  FiBookmark,
  FiSunrise,
  FiSun,
  FiSunset,
  FiMoon,
  FiBell,
  FiGrid,
  FiMail,
  FiEdit2,
  FiCheck,
  FiEye,
  FiEyeOff,
  FiMove,
  FiMaximize2,
  FiMinimize2,
  FiRotateCcw,
} from 'react-icons/fi';
import { useAppStore, DEFAULT_HOME_WIDGETS } from '../store/useAppStore';
import { ServiceIcon } from './ServiceIcon';
import { WeatherIcon } from './WeatherIcon';
import { ClassroomCard } from './ClassroomCard';
import { CalendarCard } from './CalendarCard';
import {
  detectLocation,
  getPreciseLocation,
  fetchWeather,
  describeWeather,
  type Weather,
} from '../lib/weather';

const FOCUS_LABEL: Record<string, string> = {
  normal: '通常モード',
  focus: '集中モード',
  deep: '完全集中モード',
};

// 編集モードでウィジェットに表示する名称
const WIDGET_LABELS: Record<string, string> = {
  stats: 'サマリー',
  notifications: '最近の通知',
  calendar: '今日の予定',
  classroom: 'Classroomの課題',
  frequent: 'よく使うサービス',
  readLater: 'あとで見る',
  focus: '集中モードの状態',
};

// 時間帯に応じたあいさつとアイコン・色
function greeting(hour: number) {
  if (hour >= 4 && hour < 10)
    return { text: 'おはようございます', Icon: FiSunrise, color: '#FF9500' };
  if (hour >= 10 && hour < 17)
    return { text: 'こんにちは', Icon: FiSun, color: '#FFB300' };
  if (hour >= 17 && hour < 22)
    return { text: 'こんばんは', Icon: FiSunset, color: '#FF7043' };
  return { text: 'こんばんは', Icon: FiMoon, color: '#5C6BC0' };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return new Date(iso).toLocaleDateString('ja-JP');
}

type Props = {
  onOpenAdd: () => void;
};

export function TodayView({ onOpenAdd }: Props) {
  const services = useAppStore((s) => s.services);
  const recent = useAppStore((s) => s.recent);
  const readLater = useAppStore((s) => s.readLater);
  const notifications = useAppStore((s) => s.notifications);
  const serviceBadges = useAppStore((s) => s.serviceBadges);
  const focusMode = useAppStore((s) => s.focusMode);
  const openService = useAppStore((s) => s.openService);
  const setView = useAppStore((s) => s.setView);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const weatherEnabled = useAppStore((s) => s.weatherEnabled);
  const weatherLocation = useAppStore((s) => s.weatherLocation);
  const setWeatherLocation = useAppStore((s) => s.setWeatherLocation);

  // ライブ時計（1分ごと更新で十分）
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  // 天気（Open-Meteo・無料）。位置は IP 自動判定（成功時保存）。失敗時は東京を仮表示。
  const [weather, setWeather] = useState<Weather | null>(null);
  const [wxLabel, setWxLabel] = useState('');
  useEffect(() => {
    if (!weatherEnabled) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    (async () => {
      let loc = weatherLocation;
      if (!loc) {
        // まず OS の位置情報（正確）、ダメなら IP（おおよそ）
        const detected = (await getPreciseLocation()) ?? (await detectLocation());
        if (detected) {
          loc = detected;
          if (!cancelled) setWeatherLocation(detected); // 次回以降は再判定しない
        }
      }
      // 判定できなければ東京を仮表示（保存はしない。設定で都市変更可）
      const effective = loc ?? { lat: 35.68, lon: 139.69, label: '東京' };
      const w = await fetchWeather(effective.lat, effective.lon);
      if (!cancelled) {
        setWeather(w);
        setWxLabel(effective.label);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weatherEnabled, weatherLocation, setWeatherLocation]);

  const g = greeting(now.getHours());
  const dateStr = now.toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const timeStr = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalUnread = Object.values(serviceBadges).reduce(
    (a, b) => a + (b > 0 ? b : 0),
    0
  );
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const hasServiceHost = (host: string) =>
    services.some((s) => {
      try {
        return new URL(s.url).hostname.endsWith(host);
      } catch {
        return false;
      }
    });
  const hasClassroom = hasServiceHost('classroom.google.com');
  const hasCalendar = hasServiceHost('calendar.google.com');

  const recentServices = recent
    .map((r) => services.find((s) => s.id === r.serviceId))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const frequent = recentServices.length
    ? recentServices.slice(0, 6)
    : services.slice(0, 6);

  // --- Home ウィジェット設定 ---
  const homeWidgetOrder = useAppStore((s) => s.homeWidgetOrder);
  const homeWidgetHidden = useAppStore((s) => s.homeWidgetHidden);
  const homeWidgetWidth = useAppStore((s) => s.homeWidgetWidth);
  const setHomeWidgetOrder = useAppStore((s) => s.setHomeWidgetOrder);
  const toggleHomeWidgetHidden = useAppStore((s) => s.toggleHomeWidgetHidden);
  const setHomeWidgetWidth = useAppStore((s) => s.setHomeWidgetWidth);
  const resetHomeWidgets = useAppStore((s) => s.resetHomeWidgets);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  // ドロップ位置のヒント（左/右に重ねると横並び、中央は全幅で並び替え）
  const [dropHint, setDropHint] = useState<{
    id: string;
    side: 'left' | 'right' | 'full';
  } | null>(null);

  // 保存済みの順序に、未知（将来追加）の既定ウィジェットを末尾補完
  const orderedWidgets = [
    ...homeWidgetOrder.filter((id) => DEFAULT_HOME_WIDGETS.includes(id)),
    ...DEFAULT_HOME_WIDGETS.filter((id) => !homeWidgetOrder.includes(id)),
  ];

  const widgetHasContent = (id: string): boolean => {
    switch (id) {
      case 'stats':
      case 'focus':
        return true;
      case 'notifications':
        return notifications.length > 0;
      case 'calendar':
        return hasCalendar;
      case 'classroom':
        return hasClassroom;
      case 'frequent':
        return frequent.length > 0;
      case 'readLater':
        return readLater.length > 0;
      default:
        return false;
    }
  };

  // 対象ウィジェット上のカーソル位置から左/右/中央を判定
  const sideFromEvent = (
    e: React.DragEvent
  ): 'left' | 'right' | 'full' => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    if (rel < 0.34) return 'left';
    if (rel > 0.66) return 'right';
    return 'full';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    if (!editing || !dragId) return;
    e.preventDefault();
    const side = dragId === targetId ? 'full' : sideFromEvent(e);
    if (dropHint?.id !== targetId || dropHint?.side !== side)
      setDropHint({ id: targetId, side });
  };

  const handleDropOn = (e: React.DragEvent, targetId: string) => {
    const side = dragId === targetId ? 'full' : sideFromEvent(e);
    setDropHint(null);
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const order = [...orderedWidgets];
    const from = order.indexOf(dragId);
    if (from < 0) {
      setDragId(null);
      return;
    }
    order.splice(from, 1);
    let to = order.indexOf(targetId);
    if (to < 0) {
      setDragId(null);
      return;
    }
    if (side === 'right') to += 1;
    order.splice(to, 0, dragId);
    setHomeWidgetOrder(order);
    if (side === 'full') {
      // 中央へ：全幅で並び替え
      setHomeWidgetWidth(dragId, 'full');
    } else {
      // 左右へ：両方を半幅にして横並びにする
      setHomeWidgetWidth(dragId, 'half');
      setHomeWidgetWidth(targetId, 'half');
    }
    setDragId(null);
  };

  const renderWidget = (id: string): React.ReactNode => {
    switch (id) {
      case 'stats':
        return (
          <div className="stat-grid" style={{ margin: 0 }}>
            <div className={`stat-tile ${totalUnread > 0 ? 'danger' : ''}`}>
              <div className="stat-head">
                <FiMail size={14} /> 未読合計
              </div>
              <div className="stat-value">{totalUnread}</div>
            </div>
            <button
              className="stat-tile accent"
              style={{ cursor: 'pointer', textAlign: 'left' }}
              onClick={() => setView('inbox')}
            >
              <div className="stat-head">
                <FiBell size={14} /> 新着通知
              </div>
              <div className="stat-value">{unreadNotifs}</div>
            </button>
            <div className="stat-tile">
              <div className="stat-head">
                <FiGrid size={14} /> サービス
              </div>
              <div className="stat-value">{services.length}</div>
            </div>
            <button
              className="stat-tile"
              style={{ cursor: 'pointer', textAlign: 'left' }}
              onClick={() => setView('readLater')}
            >
              <div className="stat-head">
                <FiBookmark size={14} /> あとで見る
              </div>
              <div className="stat-value">{readLater.length}</div>
            </button>
          </div>
        );
      case 'notifications':
        return (
          <div className="section" style={{ margin: 0 }}>
            <h3 className="section-title">最近の通知</h3>
            <div className="card">
              {notifications.slice(0, 5).map((n) => (
                <div
                  className="list-row"
                  key={n.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    markNotificationRead(n.id);
                    if (services.some((s) => s.id === n.serviceId))
                      openService(n.serviceId);
                  }}
                >
                  <ServiceIcon iconKey={n.icon} chip={26} />
                  <div className="grow">
                    <div className="row-title">{n.title}</div>
                    <div className="row-sub">
                      {n.serviceName}
                      {n.body ? ` ・ ${n.body}` : ''}
                    </div>
                  </div>
                  <span className="muted" style={{ flexShrink: 0 }}>
                    {timeAgo(n.receivedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      case 'calendar':
        return <CalendarCard />;
      case 'classroom':
        return <ClassroomCard />;
      case 'frequent':
        return (
          <div className="section" style={{ margin: 0 }}>
            <h3 className="section-title">よく使うサービス</h3>
            <div className="shortcut-grid">
              {frequent.map((svc) => (
                <button
                  key={svc.id}
                  className="shortcut-tile"
                  onClick={() => openService(svc.id)}
                >
                  <ServiceIcon iconKey={svc.icon} chip={34} />
                  <span className="tile-name">
                    {svc.name}
                    {serviceBadges[svc.id] > 0
                      ? `（${serviceBadges[svc.id]}）`
                      : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      case 'readLater':
        return (
          <div className="section" style={{ margin: 0 }}>
            <h3 className="section-title">あとで見る</h3>
            <div className="card">
              {readLater.slice(0, 4).map((item) => (
                <div className="list-row" key={item.id}>
                  <FiBookmark size={16} style={{ color: 'var(--accent)' }} />
                  <div className="grow">
                    <div className="row-title">{item.title}</div>
                    <div className="row-sub">{item.serviceName}</div>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => window.workOne.openExternal(item.url)}
                  >
                    開く
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      case 'focus':
        return (
          <div className="section" style={{ margin: 0 }}>
            <h3 className="section-title">集中モードの状態</h3>
            <span
              className={`status-pill ${
                focusMode !== 'normal' ? 'active-mode' : ''
              }`}
            >
              <FiTarget size={14} />
              {FOCUS_LABEL[focusMode]}
            </span>
            <button
              className="btn btn-sm"
              style={{ marginLeft: 10 }}
              onClick={() => setView('focus')}
            >
              変更
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="content-scroll">
      <div className="today-hero">
        <span className="hero-icon" style={{ background: g.color }}>
          <g.Icon size={28} />
        </span>
        <div>
          <h2>{g.text}</h2>
          <div className="hero-sub">
            {dateStr} ・ {timeStr}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {weatherEnabled && weather && (
          <div className="weather-card">
            <span className="weather-ic">
              <WeatherIcon icon={describeWeather(weather.code).icon} size={40} />
            </span>
            <div>
              <div className="weather-temp">{weather.temp}°</div>
              <div className="weather-meta">
                {wxLabel}・{weather.label}
              </div>
              <div className="weather-meta">
                最高 {weather.tempMax}° / 最低 {weather.tempMin}°
              </div>
            </div>
          </div>
        )}
      </div>

      {services.length === 0 ? (
        <div className="empty-state">
          <FiPlus size={40} className="empty-icon" />
          <h3>まだサービスがありません</h3>
          <p>
            「サービスを追加」から Gmail、Slack、Google Classroom
            などを追加すると、ここに今日の状況がまとまります。
          </p>
          <button className="btn btn-primary" onClick={onOpenAdd}>
            <FiPlus size={14} /> サービスを追加
          </button>
        </div>
      ) : (
        <>
          <div className="home-toolbar">
            {editing && (
              <button className="btn btn-ghost" onClick={resetHomeWidgets}>
                <FiRotateCcw size={15} /> リセット
              </button>
            )}
            <button
              className={`btn ${editing ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setEditing((v) => !v);
                setDragId(null);
              }}
            >
              {editing ? (
                <>
                  <FiCheck size={15} /> 完了
                </>
              ) : (
                <>
                  <FiEdit2 size={15} /> 編集
                </>
              )}
            </button>
          </div>

          <div className="home-grid">
            {orderedWidgets.map((id) => {
              const hidden = homeWidgetHidden.includes(id);
              const hasContent = widgetHasContent(id);
              // 通常時: 非表示 or 中身なしはスキップ。編集時: 全部出す。
              if (!editing && (hidden || !hasContent)) return null;
              const half = homeWidgetWidth[id] === 'half';
              return (
                <div
                  key={id}
                  className={`home-widget ${half ? 'half' : 'full'} ${
                    editing ? 'editing' : ''
                  } ${hidden ? 'is-hidden' : ''} ${
                    dragId === id ? 'dragging' : ''
                  } ${
                    dropHint?.id === id ? `drop-${dropHint.side}` : ''
                  }`}
                  draggable={editing}
                  onDragStart={() => editing && setDragId(id)}
                  onDragOver={(e) => handleDragOver(e, id)}
                  onDrop={(e) => editing && handleDropOn(e, id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropHint(null);
                  }}
                >
                  {editing && (
                    <div className="widget-edit-bar">
                      <span className="widget-edit-handle" title="ドラッグで並び替え">
                        <FiMove size={13} />
                        {WIDGET_LABELS[id]}
                      </span>
                      <button
                        className="icon-btn-sm"
                        title={half ? '全幅にする' : '半幅にする'}
                        onClick={() =>
                          setHomeWidgetWidth(id, half ? 'full' : 'half')
                        }
                      >
                        {half ? (
                          <FiMaximize2 size={13} />
                        ) : (
                          <FiMinimize2 size={13} />
                        )}
                      </button>
                      <button
                        className="icon-btn-sm"
                        title={hidden ? '表示する' : '非表示にする'}
                        onClick={() => toggleHomeWidgetHidden(id)}
                      >
                        {hidden ? <FiEyeOff size={13} /> : <FiEye size={13} />}
                      </button>
                    </div>
                  )}
                  {hasContent ? (
                    renderWidget(id)
                  ) : (
                    <div className="card muted widget-empty">
                      今は表示する内容がありません
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
