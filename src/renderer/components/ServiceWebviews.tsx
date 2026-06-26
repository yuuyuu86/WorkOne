import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ServiceFrame } from './ServiceFrame';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * すべてのサービス webview のホスト。App に常時マウントされる。
 * 一度開いたサービスは背景でも生かしておく（keep-alive）ことで、
 * - サービス切替時に再読み込みが起きない
 * - 背景でもタイトルから未読を拾える（バッジ／通知）
 * activeView が 'service' のときだけ表示する。
 */
export function ServiceWebviews() {
  const activeView = useAppStore((s) => s.activeView);
  const activeServiceId = useAppStore((s) => s.activeServiceId);
  const services = useAppStore((s) => s.services);
  const autoloadServices = useAppStore((s) => s.autoloadServices);

  // 自動読み込みが ON なら起動時に全サービスをマウント（通知ハブ用）。
  // OFF なら一度開いたサービスだけマウント（軽量）。
  const [mountedIds, setMountedIds] = useState<string[]>(() =>
    useAppStore.getState().autoloadServices
      ? useAppStore.getState().services.map((s) => s.id)
      : []
  );

  // 自動読み込み ON のときは、追加された新サービスも順次マウント
  useEffect(() => {
    if (!autoloadServices) return;
    setMountedIds((ids) => {
      const next = services.map((s) => s.id).filter((id) => !ids.includes(id));
      return next.length ? [...ids, ...next] : ids;
    });
  }, [autoloadServices, services]);

  useEffect(() => {
    if (activeServiceId && !mountedIds.includes(activeServiceId)) {
      setMountedIds((ids) => [...ids, activeServiceId]);
    }
  }, [activeServiceId, mountedIds]);

  // 削除されたサービスはマウント一覧からも外す
  useEffect(() => {
    setMountedIds((ids) => ids.filter((id) => services.some((s) => s.id === id)));
  }, [services]);

  const mountedServices = mountedIds
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const showLayer = activeView === 'service';
  const hasActive = mountedServices.some((s) => s.id === activeServiceId);

  // レイヤーは常にレイアウトに存在させる（display:none にしない）。
  // サービス表示中でないときは webview の上に各ビューを重ねて隠す。
  return (
    <div className="webview-layer">
      {mountedServices.map((svc) => (
        <ErrorBoundary key={svc.id} compact label={svc.name}>
          <ServiceFrame
            service={svc}
            isActive={showLayer && svc.id === activeServiceId}
          />
        </ErrorBoundary>
      ))}

      {showLayer && !hasActive && (
        <div className="empty-state" style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
          <h3>サービスが選択されていません</h3>
          <p>サイドバーからサービスを選ぶと、ここに公式Web版が表示されます。</p>
        </div>
      )}
    </div>
  );
}
