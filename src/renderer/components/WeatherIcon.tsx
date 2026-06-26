import type { IconType } from 'react-icons';
import {
  WiDaySunny,
  WiDayCloudy,
  WiCloudy,
  WiRain,
  WiSnow,
  WiThunderstorm,
  WiFog,
} from 'react-icons/wi';

const MAP: Record<string, IconType> = {
  sunny: WiDaySunny,
  partly: WiDayCloudy,
  cloudy: WiCloudy,
  rain: WiRain,
  snow: WiSnow,
  thunder: WiThunderstorm,
  fog: WiFog,
};

export function WeatherIcon({ icon, size = 36 }: { icon: string; size?: number }) {
  const Icon = MAP[icon] ?? WiDayCloudy;
  return <Icon size={size} />;
}
