import { useState } from 'react';
import { FiInfo, FiPlus, FiCheck, FiTrash2, FiBell, FiStar } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import { ServiceIcon } from './ServiceIcon';

type Props = {
  onOpenAdd: () => void;
};

type Filter = 'all' | 'unread' | 'important' | string; // string = serviceId

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return new Date(iso).toLocaleDateString('ja-JP');
}

export function InboxView({ onOpenAdd }: Props) {
  const services = useAppStore((s) => s.services);
  const notifications = useAppStore((s) => s.notifications);
  const serviceBadges = useAppStore((s) => s.serviceBadges);
  const openService = useAppStore((s) => s.openService);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useAppStore((s) => s.markAllNotificationsRead);
  const removeNotification = useAppStore((s) => s.removeNotification);
  const clearNotifications = useAppStore((s) => s.clearNotifications);

  const [filter, setFilter] = useState<Filter>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const importantCount = notifications.filter((n) => n.important).length;

  // フィルタ適用
  const shown = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    if (filter === 'important') return n.important;
    return n.serviceId === filter; // サービス別
  });

  // 通知が存在するサービス（フィルタ用）
  const notifServiceIds = Array.from(
    new Set(notifications.map((n) => n.serviceId))
  );

  const openFromNotification = (serviceId: string, id: string) => {
    markNotificationRead(id);
    if (services.some((s) => s.id === serviceId)) openService(serviceId);
  };

  return (
    <div className="content-scroll">
      <div className="page-header">
        <h2>Inbox</h2>
        <p>各サービスの通知をまとめて表示します。</p>
      </div>

      <div className="info-banner">
        <FiInfo size={18} className="info-icon" />
        <div>
          各サービスが出す通知（Gmail / Slack / Calendar など）を 1
          か所に集約しています。通知を表示するには、各サービスの設定で「デスクトップ通知」を
          オンにし、そのサービスを一度開いておいてください。通知の内容はメモリ上だけで保持し、
          保存はしません。
        </div>
      </div>

      <div className="section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <h3 className="section-title" style={{ margin: 0 }}>
            通知{unreadCount > 0 ? `（未読 ${unreadCount}）` : ''}
          </h3>
          {notifications.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={markAllNotificationsRead}>
                <FiCheck size={13} /> すべて既読
              </button>
              <button className="btn btn-sm" onClick={clearNotifications}>
                <FiTrash2 size={13} /> クリア
              </button>
            </div>
          )}
        </div>

        {/* フィルタ */}
        {notifications.length > 0 && (
          <div className="filter-chips">
            <button
              className={`chip ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              すべて
            </button>
            <button
              className={`chip ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              未読 {unreadCount}
            </button>
            {importantCount > 0 && (
              <button
                className={`chip ${filter === 'important' ? 'active' : ''}`}
                onClick={() => setFilter('important')}
              >
                重要 {importantCount}
              </button>
            )}
            {notifServiceIds.map((sid) => {
              const svc = services.find((s) => s.id === sid);
              if (!svc) return null;
              return (
                <button
                  key={sid}
                  className={`chip ${filter === sid ? 'active' : ''}`}
                  onClick={() => setFilter(sid)}
                >
                  {svc.name}
                </button>
              );
            })}
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="empty-state">
            <FiBell size={36} className="empty-icon" />
            <h3>通知はまだありません</h3>
            <p>
              サービスを開いて通知が届くと、ここに集約されます。各サービスの
              「デスクトップ通知」をオンにしてください。
            </p>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <FiBell size={32} className="empty-icon" />
            <p>この絞り込みに一致する通知はありません。</p>
          </div>
        ) : (
          <div className="card">
            {shown.map((n) => (
              <div
                className="list-row"
                key={n.id}
                style={{
                  cursor: 'pointer',
                  background: n.read ? undefined : 'var(--accent-soft)',
                }}
                onClick={() => openFromNotification(n.serviceId, n.id)}
              >
                <ServiceIcon iconKey={n.icon} chip={28} />
                <div className="grow">
                  <div className="row-title">
                    {n.important && (
                      <FiStar
                        size={12}
                        fill="#FFB300"
                        style={{ color: '#FFB300', marginRight: 5 }}
                      />
                    )}
                    {n.title}
                    <span
                      className="muted"
                      style={{ marginLeft: 8, fontWeight: 400 }}
                    >
                      {n.serviceName}
                    </span>
                  </div>
                  {n.body && <div className="row-sub">{n.body}</div>}
                </div>
                <span className="muted" style={{ flexShrink: 0 }}>
                  {timeAgo(n.receivedAt)}
                </span>
                <button
                  className="icon-btn"
                  title="削除"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNotification(n.id);
                  }}
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">サービス別の未読</h3>
        {services.length === 0 ? (
          <div className="empty-state">
            <FiPlus size={36} className="empty-icon" />
            <h3>サービスがありません</h3>
            <p>「サービスを追加」からサービスを追加してください。</p>
            <button className="btn btn-primary" onClick={onOpenAdd}>
              <FiPlus size={14} /> サービスを追加
            </button>
          </div>
        ) : (
          <div className="card">
            {services.map((svc) => (
              <div className="list-row" key={svc.id}>
                <ServiceIcon iconKey={svc.icon} chip={28} />
                <div className="grow">
                  <div className="row-title">{svc.name}</div>
                  <div className="row-sub">
                    {serviceBadges[svc.id] > 0
                      ? `未読 ${serviceBadges[svc.id]} 件`
                      : '新着なし'}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => openService(svc.id)}
                >
                  開く
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
