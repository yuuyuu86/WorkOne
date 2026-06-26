import { getIcon, getIconColor, isImageIcon } from '../data/iconMap';

type Props = {
  iconKey: string;
  size?: number;
  /** チップ（角丸背景）として表示する場合の一辺 */
  chip?: number;
  /** チップ背景色の上書き */
  color?: string;
};

/**
 * react-icons をキーから解決して表示する共通コンポーネント。
 * iconKey が画像 URL（ファビコン等）の場合は <img> として表示する。
 * chip を指定するとブランドカラーの角丸背景付きで表示する。
 */
export function ServiceIcon({ iconKey, size = 16, chip, color }: Props) {
  // 画像アイコン（カスタムサービスのファビコン）
  if (isImageIcon(iconKey)) {
    if (chip) {
      return (
        <span
          className="service-icon-chip"
          style={{ width: chip, height: chip, background: '#fff', border: '1px solid var(--border)' }}
        >
          <img
            src={iconKey}
            alt=""
            width={chip * 0.62}
            height={chip * 0.62}
            style={{ borderRadius: 3 }}
          />
        </span>
      );
    }
    return <img src={iconKey} alt="" width={size} height={size} style={{ borderRadius: 3 }} />;
  }

  const Icon = getIcon(iconKey);
  if (chip) {
    const bg = color ?? getIconColor(iconKey) ?? 'var(--text-secondary)';
    return (
      <span
        className="service-icon-chip"
        style={{ width: chip, height: chip, background: bg }}
      >
        <Icon size={chip * 0.58} />
      </span>
    );
  }
  return <Icon size={size} />;
}
