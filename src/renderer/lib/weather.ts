// 天気取得（Open-Meteo・APIキー不要・無料）。位置は IP 自動判定（ipapi.co・無料）
// または都市名ジオコーディング（Open-Meteo Geocoding・無料）で取得する。

export type WeatherLocation = { lat: number; lon: number; label: string };

export type Weather = {
  temp: number;
  tempMax: number;
  tempMin: number;
  code: number;
  label: string;
};

// WMO weather code -> 日本語ラベル + アイコンキー（react-icons/wi のキー）
export function describeWeather(code: number): { label: string; icon: string } {
  if (code === 0) return { label: '快晴', icon: 'sunny' };
  if (code === 1 || code === 2) return { label: '晴れ時々くもり', icon: 'partly' };
  if (code === 3) return { label: 'くもり', icon: 'cloudy' };
  if (code === 45 || code === 48) return { label: '霧', icon: 'fog' };
  if (code >= 51 && code <= 57) return { label: '霧雨', icon: 'rain' };
  if (code >= 61 && code <= 67) return { label: '雨', icon: 'rain' };
  if (code >= 71 && code <= 77) return { label: '雪', icon: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'にわか雨', icon: 'rain' };
  if (code >= 85 && code <= 86) return { label: 'にわか雪', icon: 'snow' };
  if (code >= 95) return { label: '雷雨', icon: 'thunder' };
  return { label: '—', icon: 'cloudy' };
}

/**
 * OS の位置情報サービス（GPS/WiFi）で正確な現在地を取得（失敗・拒否時 null）。
 * macOS では CoreLocation を使用。初回は OS の許可ダイアログが出る。
 */
export function getPreciseLocation(): Promise<WeatherLocation | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return resolve(null);
    }
    let done = false;
    const finish = (v: WeatherLocation | null) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    const timer = setTimeout(() => finish(null), 8000);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearTimeout(timer);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let label = '現在地';
        try {
          const api = window.workOne;
          if (api?.reverseGeocode) label = (await api.reverseGeocode(lat, lon)) || '現在地';
        } catch {
          /* ラベルは既定のまま */
        }
        finish({ lat, lon, label });
      },
      () => {
        clearTimeout(timer);
        finish(null);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  });
}

/** IP から現在地を推定（メインプロセス経由。失敗時 null） */
export async function detectLocation(): Promise<WeatherLocation | null> {
  try {
    const api = window.workOne;
    if (!api?.detectLocation) return null;
    return await api.detectLocation();
  } catch {
    return null;
  }
}

/** 都市名から位置を取得（メインプロセス経由・日本語対応。失敗時 null） */
export async function geocodeCity(
  name: string
): Promise<WeatherLocation | null> {
  // メインプロセス（Nominatim＝日本語に強い）を優先
  try {
    const api = window.workOne;
    if (api?.geocodeCity) {
      const loc = await api.geocodeCity(name);
      if (loc) return loc;
    }
  } catch {
    /* フォールバックへ */
  }
  // フォールバック: レンダラーから Open-Meteo geocoding
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=1&language=ja&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.results?.[0];
    if (!r) return null;
    return { lat: r.latitude, lon: r.longitude, label: r.name };
  } catch {
    return null;
  }
}

/** 現在の天気を取得 */
export async function fetchWeather(
  lat: number,
  lon: number
): Promise<Weather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    const code = j.current?.weather_code ?? 0;
    return {
      temp: Math.round(j.current?.temperature_2m ?? 0),
      tempMax: Math.round(j.daily?.temperature_2m_max?.[0] ?? 0),
      tempMin: Math.round(j.daily?.temperature_2m_min?.[0] ?? 0),
      code,
      label: describeWeather(code).label,
    };
  } catch {
    return null;
  }
}
