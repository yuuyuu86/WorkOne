import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ServiceFrame } from './ServiceFrame';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * すべてのサービス webview のホスト。App に常時マウントされる。
 * 一度開いたサービスは背景でも生かしておく（keep-alive）ことで、
 * - サービス切替時に再読み込みが起きない
 * - 背景でもタイトルから未読を拾える（バッジ／通知）
 * activeView が 'service' のときだけ表示する。
 *
 * メモリ節約のため、hibernateMinutes 以上開いていないサービスは休止（アンマウント）する。
 * 常駐（keepAlive）にしたサービスと表示中のサービスは休止しない。
 * 全プロファイルのサービスを対象にするので、別プロファイルの通知も受け取れる。
 */
export function ServiceWebviews() {
  const activeView = useAppStore((s) => s.activeView);
  const activeServiceId = useAppStore((s) => s.activeServiceId);
  const services = useAppStore((s) => s.services);
  const autoloadServices = useAppStore((s) => s.autoloadServices);
  const hibernateMinutes = useAppStore((s) => s.hibernateMinutes);

  // 自動読み込みが ON なら起動時に全サービスをマウント（通知ハブ用）。
  // OFF なら一度開いたサービスだけマウント（軽量）。
  const [mountedIds, setMountedIds] = useState<string[]>(() =>
    useAppStore.getState().autoloadServices
      ? useAppStore.getState().services.map((s) => s.id)
      : []
  );
  // 休止中のサービス（自動読み込みで勝手に復帰させない）
  const hibernatedRef = useRef<Set<string>>(new Set());
  // サービスごとに最後に表示していた時刻（起動時はいまを起点にする）
  const lastActiveRef = useRef<Record<string, number>>({});

  // 自動読み込み ON のときは、追加された新サービスも順次マウント
  useEffect(() => {
    if (!autoloadServices) return;
    setMountedIds((ids) => {
      const next = services
        .map((s) => s.id)
        .filter((id) => !ids.includes(id) && !hibernatedRef.current.has(id));
      return next.length ? [...ids, ...next] : ids;
    });
  }, [autoloadServices, services]);

  useEffect(() => {
    if (!activeServiceId) return;
    lastActiveRef.current[activeServiceId] = Date.now();
    hibernatedRef.current.delete(activeServiceId);
    if (!mountedIds.includes(activeServiceId)) {
      setMountedIds((ids) => [...ids, activeServiceId]);
    }
  }, [activeServiceId, mountedIds]);

  // 削除されたサービスはマウント一覧からも外す
  useEffect(() => {
    setMountedIds((ids) => ids.filter((id) => services.some((s) => s.id === id)));
  }, [services]);

  // 休止の判定（1 分ごと）
  useEffect(() => {
    if (hibernateMinutes <= 0) return;
    const limit = hibernateMinutes * 60000;
    const tick = () => {
      const st = useAppStore.getState();
      const now = Date.now();
      setMountedIds((ids) => {
        const keep = ids.filter((id) => {
          const svc = st.services.find((s) => s.id === id);
          if (!svc || svc.keepAlive) return true;
          if (st.activeView === 'service' && st.activeServiceId === id) {
            // 表示し続けている間は「最後に使った時刻」を更新し続ける
            lastActiveRef.current[id] = now;
            return true;
          }
          const last = (lastActiveRef.current[id] ??= now);
          if (now - last < limit) return true;
          hibernatedRef.current.add(id);
          return false;
        });
        return keep.length === ids.length ? ids : keep;
      });
    };
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [hibernateMinutes]);

  const mountedServices = mountedIds
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const showLayer = activeView === 'service';
  const hasActive = mountedServices.some((s) => s.id === activeServiceId);

  // レイヤーは常にレイアウトに存在させる（display:none にしない）。
  // サービス表示中でないときは webview の上に各ビューを重ねて隠す。
  // key にプロファイルを含めるのは、プロファイル移動時に別パーティションで作り直すため。
  return (
    <div className="webview-layer">
      {mountedServices.map((svc) => (
        <ErrorBoundary key={`${svc.id}:${svc.profileId ?? 'default'}`} compact label={svc.name}>
          <ServiceFrame
            service={svc}
            isActive={showLayer && svc.id === activeServiceId}
          />
        </ErrorBoundary>
      ))}

      {showLayer && !hasActive && (
        <div className="empty-state" style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
          <h3>サービスが選択されていません</h3>
          <p>サイドバーからサービスを選ぶと、ここに表示されます。</p>
        </div>
      )}
    </div>
  );
}
