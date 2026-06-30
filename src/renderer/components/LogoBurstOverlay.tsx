import { useEffect, useState } from 'react';
import { FiInbox } from 'react-icons/fi';
import { getIconColor } from '../data/iconMap';
import { ServiceIcon } from './ServiceIcon';
import { FLY_ICONS } from './WelcomeOverlay';

type Props = {
  onDone: () => void;
};

/**
 * 小ネタ: サイドバーのロゴを連打すると、初回ウェルカムのアイコン集約アニメを
 * もう一度見られる。クリックでも自動でも数秒後に消える。
 */
export function LogoBurstOverlay({ onDone }: Props) {
  const [closing, setClosing] = useState(false);

  const close = () => {
    setClosing(true);
    setTimeout(onDone, 300);
  };

  useEffect(() => {
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const t = setTimeout(close, reduce ? 300 : 2800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = FLY_ICONS.length;
  const radius = 190;

  return (
    <div
      className={`logo-burst-overlay ${closing ? 'welcome-closing' : ''}`}
      onClick={close}
    >
      <div className="welcome-stage">
        {FLY_ICONS.map((key, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const dx = Math.cos(angle) * radius;
          const dy = Math.sin(angle) * radius;
          return (
            <span
              key={key}
              className="welcome-fly"
              style={
                {
                  background: getIconColor(key) ?? 'var(--text-secondary)',
                  '--dx': `${dx}px`,
                  '--dy': `${dy}px`,
                  animationDelay: `${i * 0.05}s`,
                } as React.CSSProperties
              }
            >
              <ServiceIcon iconKey={key} size={20} />
            </span>
          );
        })}
        <span className="welcome-logo">
          <FiInbox size={36} />
        </span>
      </div>
    </div>
  );
}
