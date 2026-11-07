const DEVICE_SESSION_KEY = 'boiler_chem_device_session_id';

export function getDeviceSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';
  let id = localStorage.getItem(DEVICE_SESSION_KEY);
  if (!id || id.length < 10) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    try {
      localStorage.setItem(DEVICE_SESSION_KEY, id);
    } catch {
      // Ignore
    }
  }
  return id;
}

export function resetDeviceSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';
  const newId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  try {
    localStorage.setItem(DEVICE_SESSION_KEY, newId);
  } catch {
    // Ignore
  }
  return newId;
}

export interface DeviceCoordinates {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

let cachedCoords: DeviceCoordinates | null = null;
let isRequestingLocation = false;

export async function getClientLocationCoordinates(): Promise<DeviceCoordinates> {
  if (cachedCoords && cachedCoords.latitude != null) {
    return cachedCoords;
  }
  if (typeof window === 'undefined') {
    return { latitude: null, longitude: null, accuracy: null };
  }
  try {
    const stored = sessionStorage.getItem('boiler_device_coords');
    if (stored) {
      cachedCoords = JSON.parse(stored);
      if (cachedCoords && cachedCoords.latitude != null) {
        return cachedCoords;
      }
    }
  } catch {}

  if (!navigator.geolocation || isRequestingLocation) {
    return cachedCoords || { latitude: null, longitude: null, accuracy: null };
  }

  isRequestingLocation = true;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        isRequestingLocation = false;
        const coords: DeviceCoordinates = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        };
        cachedCoords = coords;
        try {
          sessionStorage.setItem('boiler_device_coords', JSON.stringify(coords));
        } catch {}
        resolve(coords);
      },
      (_err) => {
        isRequestingLocation = false;
        resolve({ latitude: null, longitude: null, accuracy: null });
      },
      {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 60000,
      }
    );
  });
}

export interface ClientDetectedInfo {
  sessionId: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  model: string;
  os: string;
  browser: string;
  isStandalone: boolean;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
}

export function detectClientDeviceInfo(): ClientDetectedInfo {
  if (typeof window === 'undefined') {
    return {
      sessionId: 'server',
      deviceType: 'desktop',
      model: 'Server Host',
      os: 'Linux',
      browser: 'Node.js',
      isStandalone: false,
    };
  }

  const ua = navigator.userAgent || '';
  const vendor = navigator.vendor || '';

  // 1. Detect Device Type
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/iphone|ipod|android.*mobile|mobile|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = 'mobile';
  }

  // 2. Detect OS & Specific Model
  let os = 'Unknown OS';
  let model = 'อุปกรณ์ไม่ทราบชื่อ';

  if (/iphone/i.test(ua)) {
    os = 'iOS';
    model = 'Apple iPhone';
    const match = ua.match(/OS (\d+[._]\d+)/i);
    if (match) {
      os = `iOS ${match[1].replace(/_/g, '.')}`;
    }
  } else if (/ipad/i.test(ua)) {
    os = 'iPadOS';
    model = 'Apple iPad';
    const match = ua.match(/OS (\d+[._]\d+)/i);
    if (match) {
      os = `iPadOS ${match[1].replace(/_/g, '.')}`;
    }
  } else if (/android/i.test(ua)) {
    os = 'Android';
    const verMatch = ua.match(/Android\s+([0-9.]+)/i);
    if (verMatch) {
      os = `Android ${verMatch[1]}`;
    }

    if (/samsung|sm-[a-z0-9]+/i.test(ua)) {
      model = 'Samsung Galaxy';
    } else if (/xiaomi|redmi|poco/i.test(ua)) {
      model = 'Xiaomi / Redmi';
    } else if (/oppo|cph[0-9]+/i.test(ua)) {
      model = 'OPPO Phone';
    } else if (/vivo|v[0-9]{4}/i.test(ua)) {
      model = 'Vivo Phone';
    } else if (/pixel/i.test(ua)) {
      model = 'Google Pixel';
    } else if (/huawei|honor/i.test(ua)) {
      model = 'Huawei Phone';
    } else {
      model = 'Android Smartphone';
    }
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
    model = 'Apple Mac';
  } else if (/windows nt/i.test(ua)) {
    os = 'Windows';
    if (/windows nt 10\.0/i.test(ua)) {
      os = 'Windows 10/11';
    }
    model = 'Windows PC';
  } else if (/cros/i.test(ua)) {
    os = 'Chrome OS';
    model = 'Chromebook';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
    model = 'Linux Computer';
  }

  // 3. Detect Browser
  let browser = 'Web Browser';
  if (/Line\//i.test(ua)) {
    browser = 'LINE In-App';
  } else if (/FBAN|FBAV/i.test(ua)) {
    browser = 'Facebook In-App';
  } else if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Chrome\//i.test(ua) && /Google/i.test(vendor)) {
    browser = 'Google Chrome';
  } else if (/Safari\//i.test(ua) && /Apple/i.test(vendor)) {
    browser = 'Apple Safari';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/OPR\/|Opera/i.test(ua)) {
    browser = 'Opera';
  }

  // 4. Standalone PWA check
  const isStandalone = Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );

  return {
    sessionId: getDeviceSessionId(),
    deviceType,
    model,
    os,
    browser,
    isStandalone,
  };
}
