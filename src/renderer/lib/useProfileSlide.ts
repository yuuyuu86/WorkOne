import { useEffect, useRef, type RefObject } from 'react';
import { useAppStore } from '../store/useAppStore';

// Arc の Space 切り替えのようなスライド。
// - トラックパッドの横スワイプ中は、サイドバーの中身が指に追従して動く
// - 一定以上動かして離すと、そのまま横に抜けて隣のプロファイルが反対側から入ってくる
// - 足りなければ元の位置へ戻る。端のプロファイルではゴムのように少しだけ動く
// - クリックやショートカットで切り替えたときも、方向に合わせて横から入ってくる

const EASE = 'cubic-bezier(0.22, 0.8, 0.24, 1)';
const OUT_MS = 140;
const IN_MS = 300;
const COMMIT_RATIO = 0.22; // サイドバー幅のこの割合を超えたら切り替える
const END_IDLE_MS = 90; // この時間 wheel が来なければ指を離したとみなす

export function useProfileSlide(
  swipeArea: RefObject<HTMLElement>,
  pages: RefObject<HTMLElement>
) {
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const prevIndex = useRef<number>(-1);
  // スワイプで切り替えたときは、入ってくる方向をここに入れておく
  const swipeDir = useRef<number>(0);

  const setX = (x: string, ms = 0, opacity?: number) => {
    const el = pages.current;
    if (!el) return;
    el.style.transition = ms
      ? `transform ${ms}ms ${EASE}, opacity ${ms}ms ease`
      : 'none';
    el.style.transform = x === '0' ? '' : `translateX(${x})`;
    el.style.opacity = opacity === undefined ? '' : String(opacity);
  };

  // プロファイルが変わったら、方向に合わせて横から入れる
  useEffect(() => {
    const st = useAppStore.getState();
    const idx = st.profiles.findIndex((p) => p.id === activeProfileId);
    const prev = prevIndex.current;
    prevIndex.current = idx;
    if (prev < 0 || prev === idx) return;
    const dir = swipeDir.current || (idx > prev ? 1 : -1);
    swipeDir.current = 0;
    const el = pages.current;
    if (!el) return;
    setX(`${dir * 100}%`, 0, 0.4);
    void el.offsetWidth; // 初期位置を確定させてからアニメーション
    setX('0', IN_MS);
  }, [activeProfileId]);

  // 横スワイプへの追従
  useEffect(() => {
    const area = swipeArea.current;
    if (!area) return;
    let acc = 0;
    let tracking = false;
    let lockedUntil = 0;
    let endTimer: number | undefined;

    const neighbor = (dir: number) => {
      const st = useAppStore.getState();
      const idx = st.profiles.findIndex((p) => p.id === st.activeProfileId);
      return st.profiles[idx + dir];
    };

    const finish = () => {
      tracking = false;
      const width = area.clientWidth || 240;
      const dir = acc > 0 ? 1 : -1;
      const next = neighbor(dir);
      if (next && Math.abs(acc) > width * COMMIT_RATIO) {
        // 抜けていく → 切り替え → 反対側から入る
        setX(`${-dir * 100}%`, OUT_MS, 0.4);
        lockedUntil = Date.now() + OUT_MS + IN_MS + 250; // 慣性スクロールで二重に切り替えない
        window.setTimeout(() => {
          swipeDir.current = dir;
          useAppStore.getState().setActiveProfile(next.id);
        }, OUT_MS);
      } else {
        setX('0', 220);
        lockedUntil = Date.now() + 200;
      }
      acc = 0;
    };

    const onWheel = (e: WheelEvent) => {
      // 縦スクロールはそのまま（横成分が明らかに大きいときだけ扱う）
      if (!tracking && Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.5) return;
      if (Date.now() < lockedUntil) return;
      if (useAppStore.getState().profiles.length < 2) return;
      tracking = true;
      acc += e.deltaX;
      const width = area.clientWidth || 240;
      const dir = acc > 0 ? 1 : -1;
      // 隣が無い方向は抵抗をつけて少しだけ動かす
      const resist = neighbor(dir) ? 1 : 0.18;
      const offset = Math.max(-width, Math.min(width, -acc * resist));
      setX(`${offset}px`, 0, 1 - Math.min(0.5, Math.abs(offset) / width));
      window.clearTimeout(endTimer);
      endTimer = window.setTimeout(finish, END_IDLE_MS);
    };

    area.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      area.removeEventListener('wheel', onWheel);
      window.clearTimeout(endTimer);
    };
  }, []);
}
