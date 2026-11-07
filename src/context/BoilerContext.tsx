import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActiveDeviceInfo,
  AppPermissions,
  AppSettings,
  AuditLogItem,
  BoilerOption,
  CalculationDetailItem,
  CalculationHistoryRecord,
  ChemicalConfig,
  ToastNotice,
} from '../types/boiler';
import {
  detectClientDeviceInfo,
  getClientLocationCoordinates,
  getDeviceSessionId,
  resetDeviceSessionId,
} from '../utils/deviceInfo';

interface BoilerContextValue {
  settings: AppSettings;
  boilers: BoilerOption[];
  chemicals: ChemicalConfig[];
  history: CalculationHistoryRecord[];
  auditLogs: AuditLogItem[];
  supabaseOnline: boolean;
  supabaseUrl: string;
  isLoading: boolean;
  loadingMessage: string;
  toasts: ToastNotice[];
  adminUnlocked: boolean;
  adminSessionToken: string;
  hasUnreadHistory: boolean;
  isHomeScreenApp: boolean;
  notificationPermission: NotificationPermission;
  activeUsersCount: number;
  isDeviceKicked: boolean;
  reconnectDevice: () => void;
  fetchActiveDevices: () => Promise<ActiveDeviceInfo[]>;
  kickDevice: (sessionId: string) => Promise<boolean>;
  deleteDeviceRecord: (sessionId: string) => Promise<boolean>;
  requestHomeScreenNotificationPermission: () => Promise<NotificationPermission>;
  markHistoryRead: () => void;
  showToast: (
    title: string,
    message?: string,
    type?: 'success' | 'error' | 'info',
    options?: { skipAppSound?: boolean }
  ) => void;
  dismissToast: (id: string) => void;
  refreshState: (showSpinner?: boolean) => Promise<void>;
  getLatestLevelForBoiler: (boilerName: string, chemicalName: string) => number | null;
  submitCalculation: (payload: {
    boiler_id: string | null;
    boiler_name: string;
    recorder_name: string;
    note?: string;
    details: CalculationDetailItem[];
  }) => Promise<{ ok: boolean; record?: CalculationHistoryRecord; error?: string }>;
  deleteHistoryRecord: (id: string) => Promise<boolean>;
  loginAdmin: (pin: string, setup?: boolean) => Promise<{ ok: boolean; error?: string }>;
  verifyAdminPin: (pin: string) => Promise<boolean>;
  logoutAdmin: () => void;
  changeAdminPin: (oldPin: string, newPin: string) => Promise<{ ok: boolean; error?: string }>;
  saveAppSettings: (partial: Partial<AppSettings>, options?: { suppressToast?: boolean; silent?: boolean }) => Promise<boolean>;
  togglePermission: (key: keyof AppPermissions, label?: string) => Promise<boolean>;
  manageBoiler: (payload: {
    id?: string;
    name?: string;
    active?: boolean;
    action?: 'add' | 'rename' | 'toggle' | 'delete';
  }) => Promise<boolean>;
  manageChemical: (payload: {
    id?: string;
    code?: string;
    name?: string;
    divisor?: number;
    unit?: string;
    description?: string;
    active?: boolean;
    action?: 'add' | 'update' | 'toggle' | 'delete';
  }) => Promise<boolean>;
  isSplashScreenVisible: boolean;
  triggerSplashScreen: () => void;
  dismissSplashScreen: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  site_name: 'Boiler Chemical',
  app_version: '3.20.0',
  developer_name: 'Weevanh Khambounheuang',
  copyright_name: 'Weevanh Khambounheuang',
  department_name: 'แผนกบอยเลอร์ (Steam Boiler Department)',
  announcement: '',
  preview_image_url: '',
  gas_webapp_url:
    'https://script.google.com/macros/s/AKfycbxKwScnPCoy88EroenTupGnkcXpAC-cZma6VYRFWyQ0iTjCrsLFK_NDpT8YZADMis9X/exec',
  db_mode: 'HYBRID_SUPABASE',
  permissions: {
    allow_calculate: true,
    allow_save: true,
    allow_history_view: true,
    allow_history_delete: true,
    allow_share: true,
    allow_chemical_info: true,
  },
  app_enabled: true,
  bg_enabled: false,
  bg_image_url: '',
  bg_opacity: 0.08,
  pin_initialized: true,
  pin_length: 4,
  facebook_url: 'https://www.facebook.com/share/1FA3TEkixw/?mibextid=wwXIfr',
  line_url: 'https://line.me/ti/p/w2dKjUMt6r',
  updated_at: new Date().toISOString(),
};

const BoilerContext = createContext<BoilerContextValue | undefined>(undefined);

const DIRECT_SUPABASE_URL = 'https://yikekymtticqabnlsmdo.supabase.co';
const DIRECT_SUPABASE_KEY = 'sb_publishable_UY0NZTIxVQ7kF69iReLrLA_Cm6DcbsA';
const DIRECT_SB_HEADERS = {
  apikey: DIRECT_SUPABASE_KEY,
  Authorization: `Bearer ${DIRECT_SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

const LAST_SEEN_HISTORY_KEY = 'boiler_chem_v3_last_seen_history';
const LAST_NOTIFIED_HISTORY_KEY = 'boiler_chem_v3_last_notified_history';
const ADMIN_TOKEN_KEY = 'boiler_chem_v3_admin_token';
const ADMIN_EXP_KEY = 'boiler_chem_v3_admin_exp';
const SETTINGS_CACHE_KEY = 'boiler_chem_v3_settings_cache';

const getInitialCachedSettings = (): AppSettings => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          permissions: {
            ...DEFAULT_SETTINGS.permissions,
            ...(parsed.permissions || {}),
          },
        };
      }
    } catch {
      // Fallback
    }
  }
  return DEFAULT_SETTINGS;
};

const BOILERS_CACHE_KEY = 'boiler_chem_v3_boilers_cache';
const CHEMICALS_CACHE_KEY = 'boiler_chem_v3_chemicals_cache';
const HISTORY_CACHE_KEY = 'boiler_chem_v3_history_cache';

const getInitialCachedBoilers = (): BoilerOption[] => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(BOILERS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  return [
    { id: 'd76e193b-903b-4b22-a0af-654b948f4218', name: 'Boiler #1-2', active: true, sort_order: 1 },
    { id: '437f1304-d144-452a-9a0c-d2b71b1e8ec3', name: 'Boiler #3', active: true, sort_order: 2 },
  ];
};

const getInitialCachedChemicals = (): ChemicalConfig[] => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CHEMICALS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  return [
    { id: 'ea1a770f-3c27-4a6c-8f00-367f0c43eeda', code: 'MCC-N', name: 'MCC-N', divisor: 4, unit: 'L', active: true, sort_order: 1 },
    { id: 'e0c5af2a-8d06-44ef-82e0-8d2267463337', code: 'POLY-SRB', name: 'PolyTreat-SRB', divisor: 4, unit: 'L', active: true, sort_order: 2 },
    { id: 'b71673f0-d26d-44e6-bcab-660d1e8cc25a', code: 'TCE-2138', name: 'TCE-2138', divisor: 8, unit: 'L', active: true, sort_order: 3 },
  ];
};

const getInitialCachedHistory = (): CalculationHistoryRecord[] => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(HISTORY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  return [];
};

export function checkIsStandaloneHomeScreen(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneDisplay =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches;
  const isIosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(isStandaloneDisplay || isIosStandalone);
}

async function triggerNativePhoneNotification(title: string, body: string, tag: string): Promise<void> {
  if (!checkIsStandaloneHomeScreen()) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/app-icon-192.png',
          badge: '/app-icon-192.png',
          tag,
          silent: false, // Uses the mobile device's own default notification sound
          data: { url: '/history' },
        });
        return;
      }
    }
  } catch (_e) {
    // Fallback to standard Notification constructor below
  }

  try {
    new Notification(title, {
      body,
      icon: '/app-icon-192.png',
      tag,
      silent: false, // Uses the mobile device's own default notification sound
    });
  } catch (_e) {
    // Ignore if unsupported
  }
}

let sharedAudioCtx: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (_e) {
      // Ignore audio unlock errors
    }
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

export function playSuccessDingSound(): void {
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    const triggerChime = () => {
      const now = ctx.currentTime;

      // Primary crystal chime note (E6 -> B6 harmonic bell "Ding!")
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1318.51, now); // E6
      osc1.frequency.setValueAtTime(1975.53, now + 0.075); // B6

      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.linearRampToValueAtTime(0.22, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      // Soft harmonic overtone for a warm bell resonance
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2637.02, now + 0.075); // E7 overtone

      gain2.gain.setValueAtTime(0.0001, now);
      gain2.gain.setValueAtTime(0.0001, now + 0.075);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.68);

      osc2.start(now + 0.075);
      osc2.stop(now + 0.52);
    };

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(triggerChime)
        .catch(() => {});
    } else {
      triggerChime();
    }
  } catch (_err) {
    // Ignore if audio is blocked by browser settings
  }
}

export const BoilerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(getInitialCachedSettings);
  const [boilers, setBoilers] = useState<BoilerOption[]>(getInitialCachedBoilers);
  const [chemicals, setChemicals] = useState<ChemicalConfig[]>(getInitialCachedChemicals);
  const [history, setHistory] = useState<CalculationHistoryRecord[]>(getInitialCachedHistory);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [supabaseOnline, setSupabaseOnline] = useState<boolean>(true);
  const [supabaseUrl, setSupabaseUrl] = useState<string>(DIRECT_SUPABASE_URL);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('กำลังโหลดข้อมูล');
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [adminSessionToken, setAdminSessionToken] = useState<string>(() => {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
    const exp = Number(sessionStorage.getItem(ADMIN_EXP_KEY) || 0);
    return token && Date.now() < exp ? token : '';
  });
  const [hasUnreadHistory, setHasUnreadHistory] = useState<boolean>(false);
  const [isHomeScreenApp, setIsHomeScreenApp] = useState<boolean>(() => checkIsStandaloneHomeScreen());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  });

  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);
  const [isDeviceKicked, setIsDeviceKicked] = useState<boolean>(false);

  const [isSplashScreenVisible, setIsSplashScreenVisible] = useState<boolean>(true);

  const triggerSplashScreen = useCallback(() => {
    setIsSplashScreenVisible(true);
  }, []);

  const dismissSplashScreen = useCallback(() => {
    setIsSplashScreenVisible(false);
  }, []);

  const sendPresencePing = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const info = detectClientDeviceInfo();
      const coords = await getClientLocationCoordinates();
      const res = await fetch('/api/presence/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...info,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.kicked) {
          setIsDeviceKicked(true);
        } else {
          setIsDeviceKicked(false);
          if (typeof data.activeCount === 'number') {
            setActiveUsersCount(data.activeCount);
          }
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    sendPresencePing();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        sendPresencePing();
      }
    }, 15000);

    const handleVis = () => {
      if (document.visibilityState === 'visible') {
        sendPresencePing();
      }
    };
    window.addEventListener('focus', handleVis);
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVis);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, [sendPresencePing]);

  // Track server build/boot ID for automatic app refresh when code is updated
  const initialBuildIdRef = useRef<string | null>(null);
  const isReloadingForUpdateRef = useRef<boolean>(false);

  useEffect(() => {
    const updateStandaloneState = () => {
      setIsHomeScreenApp(checkIsStandaloneHomeScreen());
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
    };
    updateStandaloneState();
    const mql = window.matchMedia?.('(display-mode: standalone)');
    mql?.addEventListener?.('change', updateStandaloneState);
    window.addEventListener('focus', updateStandaloneState);
    return () => {
      mql?.removeEventListener?.('change', updateStandaloneState);
      window.removeEventListener('focus', updateStandaloneState);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(BOILERS_CACHE_KEY, JSON.stringify(boilers));
    } catch {
      // Ignore
    }
  }, [boilers]);

  useEffect(() => {
    try {
      localStorage.setItem(CHEMICALS_CACHE_KEY, JSON.stringify(chemicals));
    } catch {
      // Ignore
    }
  }, [chemicals]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(history.slice(0, 150)));
    } catch {
      // Ignore
    }
  }, [history]);

  const requestHomeScreenNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      return result;
    } catch (_e) {
      return Notification.permission;
    }
  }, []);

  const adminUnlocked = Boolean(adminSessionToken);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      title: string,
      message = '',
      type?: 'success' | 'error' | 'info',
      options?: { skipAppSound?: boolean }
    ) => {
      const resolvedType: 'success' | 'error' | 'info' =
        type ||
        (/(สำเร็จ|เรียบร้อย|คัดลอก|บันทึกแล้ว|อัปเดต)/.test(title)
          ? 'success'
          : /(ผิดพลาด|ไม่สำเร็จ|ไม่ถูกต้อง|ไม่ครบ|ปิดไว้|ไม่สามารถ)/.test(title)
          ? 'error'
          : 'info');

      if (resolvedType === 'success' && !options?.skipAppSound) {
        playSuccessDingSound();
      }

      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type: resolvedType, title, message }]);
      setTimeout(() => {
        dismissToast(id);
      }, 2500);
    },
    [dismissToast]
  );

  const lastNotifiedRef = useRef<string>(
    typeof window !== 'undefined' ? localStorage.getItem(LAST_NOTIFIED_HISTORY_KEY) || '' : ''
  );

  const checkUnreadBadge = useCallback(
    (records: CalculationHistoryRecord[]) => {
      if (!records.length) {
        setHasUnreadHistory(false);
        return;
      }
      const latestRecord = records[0];
      const latestId = latestRecord.id;

      // Only devices that added the app to their Home Screen (standalone mode) receive notifications
      if (!checkIsStandaloneHomeScreen()) {
        localStorage.setItem(LAST_SEEN_HISTORY_KEY, latestId);
        localStorage.setItem(LAST_NOTIFIED_HISTORY_KEY, latestId);
        lastNotifiedRef.current = latestId;
        setHasUnreadHistory(false);
        return;
      }

      const lastSeen = localStorage.getItem(LAST_SEEN_HISTORY_KEY);
      if (!lastSeen) {
        localStorage.setItem(LAST_SEEN_HISTORY_KEY, latestId);
        localStorage.setItem(LAST_NOTIFIED_HISTORY_KEY, latestId);
        lastNotifiedRef.current = latestId;
        setHasUnreadHistory(false);
      } else {
        const isUnread = lastSeen !== latestId;
        setHasUnreadHistory(isUnread);
        if (isUnread && lastNotifiedRef.current !== latestId) {
          lastNotifiedRef.current = latestId;
          localStorage.setItem(LAST_NOTIFIED_HISTORY_KEY, latestId);
          // Trigger native mobile notification using the phone's own default notification sound (no custom app sound)
          void triggerNativePhoneNotification(
            'Boiler Chemical',
            'มีการอัปเดตข้อมูลสารเคมีใหม่ แตะเพื่อเข้าดู',
            `boiler-chem-${latestId}`
          );
          showToast(
            'Boiler Chemical',
            'มีการอัปเดตข้อมูลสารเคมีใหม่ แตะเพื่อเข้าดู',
            'info',
            { skipAppSound: true }
          );
        }
      }
    },
    [showToast]
  );

  const markHistoryRead = useCallback(() => {
    if (history.length > 0) {
      const latestId = history[0].id;
      localStorage.setItem(LAST_SEEN_HISTORY_KEY, latestId);
      localStorage.setItem(LAST_NOTIFIED_HISTORY_KEY, latestId);
      lastNotifiedRef.current = latestId;
    }
    setHasUnreadHistory(false);
  }, [history]);

  const fetchDirectFromSupabase = useCallback(async () => {
    try {
      const [boilerRes, chemRes, histRes, sysRes] = await Promise.all([
        fetch(`${DIRECT_SUPABASE_URL}/rest/v1/boilers?select=*&order=sort_order.asc`, {
          headers: DIRECT_SB_HEADERS,
        }),
        fetch(`${DIRECT_SUPABASE_URL}/rest/v1/chemicals?select=*&order=sort_order.asc`, {
          headers: DIRECT_SB_HEADERS,
        }),
        fetch(
          `${DIRECT_SUPABASE_URL}/rest/v1/calculation_history?select=*&order=calculated_at.desc&limit=5000`,
          { headers: DIRECT_SB_HEADERS }
        ),
        fetch(`${DIRECT_SUPABASE_URL}/rest/v1/system_settings?select=setting_key,setting_value`, {
          headers: DIRECT_SB_HEADERS,
        }),
      ]);

      if (boilerRes.ok) {
        const bRows = await boilerRes.json();
        if (Array.isArray(bRows) && bRows.length > 0) {
          const active = bRows
            .filter((b: Record<string, unknown>) => b && b.name && b.active !== false)
            .map((b: Record<string, unknown>, i: number) => ({
              id: String(b.id),
              name: String(b.name),
              active: true,
              sort_order: Number(b.sort_order ?? i + 1),
            }));
          if (active.length > 0) setBoilers(active);
        }
      }

      if (chemRes.ok) {
        const cRows = await chemRes.json();
        if (Array.isArray(cRows) && cRows.length > 0) {
          const active = cRows
            .filter((c: Record<string, unknown>) => c && c.name && c.active !== false)
            .map((c: Record<string, unknown>, i: number) => ({
              id: String(c.id),
              code: String(c.code || c.name),
              name: String(c.name),
              divisor: Number(c.divisor) || 4,
              unit: String(c.unit || 'L'),
              active: true,
              sort_order: Number(c.sort_order ?? i + 1),
            }));
          if (active.length > 0) setChemicals(active);
        }
      }

      if (histRes.ok) {
        const hRows = await histRes.json();
        if (Array.isArray(hRows)) {
          const mapped: CalculationHistoryRecord[] = hRows.map((rh: Record<string, unknown>) => {
            const rawDetails = Array.isArray(rh.details) ? (rh.details as CalculationDetailItem[]) : [];
            const extractedNote =
              typeof rh.note === 'string' && rh.note.trim()
                ? rh.note.trim()
                : rawDetails.find((d) => typeof d?.note === 'string' && d.note.trim())?.note?.trim() || '';
            return {
              id: String(rh.id),
              client_record_id: String(rh.client_record_id || rh.id),
              boiler_id: rh.boiler_id ? String(rh.boiler_id) : null,
              boiler_name: String(rh.boiler_name || 'Boiler'),
              recorder_name: String(rh.recorder_name || 'แผนกบอยเลอร์'),
              ...(extractedNote ? { note: extractedNote } : {}),
              calculated_at: String(rh.calculated_at || rh.created_at || new Date().toISOString()),
              details: rawDetails,
              synced_supabase: true,
            };
          });
          setHistory(mapped);
          checkUnreadBadge(mapped);
        }
      }

      if (sysRes.ok) {
        const sRows = await sysRes.json();
        if (Array.isArray(sRows)) {
          setSettings((prev) => {
            const next = { ...prev, permissions: { ...prev.permissions } };
            for (const row of sRows) {
              const key = String(row?.setting_key || '');
              const valObj = row?.setting_value as Record<string, unknown> | undefined;
              if (key === 'site_name' && typeof valObj?.value === 'string' && valObj.value.trim()) {
                next.site_name = valObj.value.trim();
              } else if (
                key === 'app_version' &&
                typeof valObj?.value === 'string' &&
                valObj.value.trim()
              ) {
                next.app_version = valObj.value.trim();
              } else if (
                key === 'preview_image_url' &&
                typeof valObj?.value === 'string'
              ) {
                next.preview_image_url = valObj.value.trim();
              } else if (key === 'permissions' && valObj && typeof valObj === 'object') {
                next.permissions = {
                  ...next.permissions,
                  ...(valObj as Partial<AppPermissions>),
                };
              } else if (key === 'bg_enabled' && valObj?.value !== undefined) {
                next.bg_enabled = Boolean(valObj.value);
              } else if (key === 'bg_image_url' && typeof valObj?.value === 'string') {
                next.bg_image_url = valObj.value.trim();
              } else if (key === 'bg_opacity' && (typeof valObj?.value === 'number' || typeof valObj?.value === 'string')) {
                const num = Number(valObj.value);
                if (Number.isFinite(num)) next.bg_opacity = num;
              }
            }
            return next;
          });
        }
      }

      setSupabaseOnline(true);
    } catch (err) {
      console.warn('Direct Supabase fallback error:', err);
    }
  }, [checkUnreadBadge]);

  const refreshState = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) {
        setIsLoading(true);
        setLoadingMessage('กำลังโหลดข้อมูล');
      }
      try {
        const res = await fetch(`/api/state?_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data?.ok) {
          // Auto-detect server update/deployment and smoothly reload for all open clients
          const currentBuildId = String(data.buildId || data.serverBootTime || '').trim();
          if (currentBuildId) {
            if (!initialBuildIdRef.current) {
              initialBuildIdRef.current = currentBuildId;
            } else if (
              initialBuildIdRef.current !== currentBuildId &&
              !isReloadingForUpdateRef.current
            ) {
              isReloadingForUpdateRef.current = true;
              showToast(
                'ระบบมีการอัปเดตใหม่',
                'กำลังรีเฟรชหน้าจอเพื่อดึงเวอร์ชันล่าสุดอัตโนมัติ...',
                'info'
              );
              setTimeout(() => {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then((registrations) => {
                    for (const r of registrations) {
                      r.update().catch(() => {});
                    }
                  });
                }
                window.location.reload();
              }, 800);
              return;
            }
          }

          if (data.settings) {
            setSettings((prev) => {
              if (
                prev.site_name === data.settings.site_name &&
                prev.app_version === data.settings.app_version &&
                prev.preview_image_url === data.settings.preview_image_url &&
                prev.app_enabled === data.settings.app_enabled &&
                prev.bg_enabled === data.settings.bg_enabled &&
                prev.bg_image_url === data.settings.bg_image_url &&
                prev.bg_opacity === data.settings.bg_opacity &&
                JSON.stringify(prev.permissions) === JSON.stringify(data.settings.permissions)
              ) {
                return prev;
              }
              return data.settings;
            });
          }
          if (Array.isArray(data.boilers)) {
            setBoilers((prev) => {
              if (prev.length === data.boilers.length && JSON.stringify(prev) === JSON.stringify(data.boilers)) {
                return prev;
              }
              return data.boilers;
            });
          }
          if (Array.isArray(data.chemicals)) {
            setChemicals((prev) => {
              if (prev.length === data.chemicals.length && JSON.stringify(prev) === JSON.stringify(data.chemicals)) {
                return prev;
              }
              return data.chemicals;
            });
          }
          if (Array.isArray(data.history)) {
            setHistory((prev) => {
              if (prev.length === data.history.length && prev[0]?.id === data.history[0]?.id) {
                return prev;
              }
              checkUnreadBadge(data.history);
              return data.history;
            });
          }
          if (Array.isArray(data.audit_logs)) {
            setAuditLogs((prev) => {
              if (prev.length === data.audit_logs.length && prev[0]?.id === data.audit_logs[0]?.id) {
                return prev;
              }
              return data.audit_logs;
            });
          }
          if (typeof data.activeUsersCount === 'number') {
            setActiveUsersCount(data.activeUsersCount);
          }
          setSupabaseOnline(Boolean(data.supabaseOnline));
          if (data.supabaseUrl) setSupabaseUrl(data.supabaseUrl);
          return;
        }
      } catch (_err) {
        await fetchDirectFromSupabase();
      } finally {
        if (showSpinner) {
          setTimeout(() => setIsLoading(false), 300);
        }
      }
    },
    [checkUnreadBadge, fetchDirectFromSupabase, showToast]
  );

  useEffect(() => {
    refreshState(false);
    // Poll every 5s only when tab is visible to conserve mobile battery and network
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshState(false);
      }
    }, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshState(false);
      }
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshState]);

  const getLatestLevelForBoiler = useCallback(
    (boilerName: string, chemicalName: string): number | null => {
      if (!boilerName || !chemicalName) return null;
      const targetBoiler = boilerName.replace(/\s+/g, '').toLowerCase();
      const targetChem = chemicalName.trim().toLowerCase();

      for (const rec of history) {
        if (rec.boiler_name.replace(/\s+/g, '').toLowerCase() === targetBoiler) {
          const found = (rec.details || []).find(
            (d) => d.name.trim().toLowerCase() === targetChem
          );
          if (found && Number.isFinite(Number(found.curr))) {
            return Number(found.curr);
          }
        }
      }
      return null;
    },
    [history]
  );

  const submitCalculation = useCallback(
    async (payload: {
      boiler_id: string | null;
      boiler_name: string;
      recorder_name: string;
      note?: string;
      details: CalculationDetailItem[];
    }) => {
      const client_record_id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`;
      const calculated_at = new Date().toISOString();
      const cleanNote = typeof payload.note === 'string' ? payload.note.trim() : '';

      try {
        const res = await fetch('/api/calculations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            ...(cleanNote ? { note: cleanNote } : {}),
            client_record_id,
            calculated_at,
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          throw new Error('Static host fallback');
        }
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast('บันทึกไม่สำเร็จ', data?.error || 'ไม่สามารถบันทึกผลการคำนวณได้', 'error');
          return { ok: false, error: data?.error };
        }
        if (Array.isArray(data.history)) {
          if (data.history[0]?.id) {
            lastNotifiedRef.current = String(data.history[0].id);
            localStorage.setItem(LAST_NOTIFIED_HISTORY_KEY, String(data.history[0].id));
          }
          setHistory(data.history);
          checkUnreadBadge(data.history);
        }
        showToast('บันทึกสำเร็จ', `บันทึกข้อมูล ${payload.boiler_name} เรียบร้อยแล้ว`, 'success');
        return { ok: true, record: data.record };
      } catch (_err) {
        try {
          const uuidBoilerId =
            payload.boiler_id &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.boiler_id)
              ? payload.boiler_id
              : null;

          const sbRes = await fetch(`${DIRECT_SUPABASE_URL}/rest/v1/calculation_history`, {
            method: 'POST',
            headers: {
              ...DIRECT_SB_HEADERS,
              Prefer: 'resolution=ignore-duplicates,return=representation',
            },
            body: JSON.stringify({
              client_record_id,
              boiler_id: uuidBoilerId,
              boiler_name: payload.boiler_name,
              recorder_name: payload.recorder_name || 'แผนกบอยเลอร์',
              calculated_at,
              details: payload.details.map((d) => ({
                name: d.name,
                report: d.report,
                raw_report: d.raw_report,
                rounded_report: d.rounded_report,
                curr: d.curr,
                ...(d.note || cleanNote ? { note: String(d.note || cleanNote).trim() } : {}),
              })),
            }),
          });
          if (sbRes.ok) {
            const inserted = await sbRes.json();
            const row = Array.isArray(inserted) ? inserted[0] : inserted;
            const record: CalculationHistoryRecord = {
              id: String(row?.id || client_record_id),
              client_record_id,
              boiler_id: payload.boiler_id,
              boiler_name: payload.boiler_name,
              recorder_name: payload.recorder_name || 'แผนกบอยเลอร์',
              ...(cleanNote ? { note: cleanNote } : {}),
              calculated_at,
              details: payload.details.map((d) => ({
                ...d,
                ...(d.note || cleanNote ? { note: String(d.note || cleanNote).trim() } : {}),
              })),
              synced_supabase: true,
            };
            lastNotifiedRef.current = record.id;
            localStorage.setItem(LAST_NOTIFIED_HISTORY_KEY, record.id);
            await fetchDirectFromSupabase();
            showToast('บันทึกสำเร็จ', `บันทึกข้อมูล ${payload.boiler_name} เรียบร้อยแล้ว`, 'success');
            return { ok: true, record };
          }
        } catch (_sbErr) {
          // Ignore and show error toast below
        }
        showToast('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
        return { ok: false, error: 'Network error' };
      }
    },
    [checkUnreadBadge, fetchDirectFromSupabase, showToast]
  );

  const callDirectSupabaseRpc = useCallback(
    async (name: string, payload: Record<string, unknown> = {}) => {
      const res = await fetch(`${DIRECT_SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: DIRECT_SB_HEADERS,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    },
    []
  );

  const deleteHistoryRecord = useCallback(
    async (id: string) => {
      const prevHistory = history;
      setHistory((prev) => prev.filter((h) => h.id !== id && h.client_record_id !== id));
      try {
        const res = await fetch(`/api/calculations/${encodeURIComponent(id)}?isAdmin=${adminUnlocked}`, {
          method: 'DELETE',
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          throw new Error('Static host fallback');
        }
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setHistory(prevHistory);
          showToast('ลบรายการไม่สำเร็จ', data?.error || 'ไม่มีสิทธิ์ลบรายการนี้', 'error');
          return false;
        }
        if (Array.isArray(data.history)) {
          setHistory(data.history);
        }
        showToast('ลบรายการสำเร็จ', 'ลบเฉพาะรายการที่เลือกจากฐานข้อมูลกลางแล้ว', 'success');
        return true;
      } catch (_err) {
        try {
          if (!adminUnlocked && !settings.permissions.allow_history_delete) {
            setHistory(prevHistory);
            showToast('ลบรายการไม่สำเร็จ', 'ผู้ดูแลระบบปิดสิทธิ์การลบประวัติไว้ใน Permission Center', 'error');
            return false;
          }
          const rpc = await callDirectSupabaseRpc('delete_calculation_history', { p_id: id });
          if (rpc.ok) {
            showToast('ลบรายการสำเร็จ', 'ลบเฉพาะรายการที่เลือกจากฐานข้อมูลกลางแล้ว', 'success');
            return true;
          }
        } catch (_sbErr) {
          // Ignore and show error toast below
        }
        setHistory(prevHistory);
        showToast('ลบรายการไม่สำเร็จ', 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล', 'error');
        return false;
      }
    },
    [adminUnlocked, callDirectSupabaseRpc, history, settings.permissions.allow_history_delete, showToast]
  );

  const loginAdmin = useCallback(
    async (pin: string, setup = false) => {
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, setup }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          throw new Error('Static host fallback');
        }
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast('รหัสไม่ถูกต้อง', data?.error || 'กรุณาตรวจสอบรหัส Admin 4 หลัก', 'error');
          return { ok: false, error: data?.error };
        }
        const token = data.sessionToken || `admin_${Date.now()}`;
        const exp = data.expiresAt || Date.now() + 2 * 3600 * 1000;
        sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
        sessionStorage.setItem(ADMIN_EXP_KEY, String(exp));
        setAdminSessionToken(token);
        // Refresh in background so UI unlocks and responds instantly
        refreshState(false).catch(() => {});
        return { ok: true };
      } catch (_err) {
        try {
          const rpcName = setup ? 'admin_setup_pin' : 'admin_login';
          const rpcPayload = setup ? { p_pin: pin, p_pin_length: 4 } : { p_pin: pin };
          const rpc = await callDirectSupabaseRpc(rpcName, rpcPayload);
          const loginData = rpc.data as { ok?: boolean; session_token?: string; message?: string } | null;
          if (rpc.ok && loginData?.ok && loginData.session_token) {
            const token = loginData.session_token;
            const exp = Date.now() + 2 * 3600 * 1000;
            sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
            sessionStorage.setItem(ADMIN_EXP_KEY, String(exp));
            setAdminSessionToken(token);
            fetchDirectFromSupabase().catch(() => {});
            return { ok: true };
          }
          showToast('รหัสไม่ถูกต้อง', loginData?.message || 'กรุณาตรวจสอบรหัส Admin 4 หลัก', 'error');
          return { ok: false, error: loginData?.message || 'Invalid PIN' };
        } catch (_sbErr) {
          showToast('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบรหัส Admin ได้', 'error');
          return { ok: false, error: 'Network error' };
        }
      }
    },
    [callDirectSupabaseRpc, fetchDirectFromSupabase, refreshState, showToast]
  );

  const verifyAdminPin = useCallback(
    async (pin: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, setup: false }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data?.ok) return true;
        }
      } catch (_e) {
        // Fallback to Supabase below
      }
      try {
        const rpc = await callDirectSupabaseRpc('admin_login', { p_pin: pin });
        const loginData = rpc.data as { ok?: boolean } | null;
        if (rpc.ok && loginData?.ok) {
          return true;
        }
      } catch (_sb) {}
      return false;
    },
    [callDirectSupabaseRpc]
  );

  const logoutAdmin = useCallback(() => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_EXP_KEY);
    setAdminSessionToken('');
  }, []);

  const changeAdminPin = useCallback(
    async (oldPin: string, newPin: string) => {
      setIsLoading(true);
      setLoadingMessage('กำลังบันทึกรหัส Admin ใหม่...');
      try {
        const res = await fetch('/api/admin/change-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPin, newPin, sessionToken: adminSessionToken }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          throw new Error('Static host fallback');
        }
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast('เปลี่ยนรหัสไม่สำเร็จ', data?.error || 'กรุณาตรวจสอบรหัสเดิมอีกครั้ง', 'error');
          return { ok: false, error: data?.error };
        }
        showToast('เปลี่ยน PIN สำเร็จ', 'รหัส Admin ใหม่ถูกบันทึกในฐานข้อมูลกลางแล้ว', 'success');
        return { ok: true };
      } catch (_err) {
        try {
          const rpc = await callDirectSupabaseRpc('admin_change_pin', {
            p_session_token: adminSessionToken,
            p_old_pin: oldPin,
            p_new_pin: newPin,
            p_pin_length: 4,
          });
          const changeData = rpc.data as { ok?: boolean; message?: string } | null;
          if (rpc.ok && changeData?.ok !== false) {
            showToast('เปลี่ยน PIN สำเร็จ', 'รหัส Admin ใหม่ถูกบันทึกในฐานข้อมูลกลางแล้ว', 'success');
            return { ok: true };
          }
          showToast('เปลี่ยนรหัสไม่สำเร็จ', changeData?.message || 'กรุณาตรวจสอบรหัสเดิมอีกครั้ง', 'error');
          return { ok: false, error: changeData?.message };
        } catch (_sbErr) {
          showToast('เปลี่ยนรหัสไม่สำเร็จ', 'เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
          return { ok: false, error: 'Network error' };
        }
      } finally {
        setIsLoading(false);
      }
    },
    [adminSessionToken, callDirectSupabaseRpc, showToast]
  );

  const saveAppSettings = useCallback(
    async (partial: Partial<AppSettings>, options?: { suppressToast?: boolean; silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
        setLoadingMessage('กำลังบันทึกการตั้งค่าระบบ...');
      }
      // Optimistic UI update
      setSettings((prev) => ({
        ...prev,
        ...partial,
        permissions: {
          ...prev.permissions,
          ...(partial.permissions || {}),
        },
        updated_at: new Date().toISOString(),
      }));

      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...partial, sessionToken: adminSessionToken }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          throw new Error('Static host fallback');
        }
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast('บันทึกไม่สำเร็จ', data?.error || 'เกิดข้อผิดพลาด', 'error');
          return false;
        }
        if (data.settings) setSettings(data.settings);
        if (Array.isArray(data.audit_logs)) setAuditLogs(data.audit_logs);
        if (!options?.suppressToast) {
          showToast('บันทึกสำเร็จ', 'ข้อมูลถูกบันทึกในฐานข้อมูลกลางแล้ว', 'success');
        }
        return true;
      } catch (_err) {
        try {
          if (partial.site_name !== undefined) {
            await callDirectSupabaseRpc('admin_set_setting', {
              p_session_token: adminSessionToken,
              p_key: 'site_name',
              p_value: { value: String(partial.site_name).trim() },
            });
          }
          if (partial.app_version !== undefined) {
            await callDirectSupabaseRpc('admin_set_setting', {
              p_session_token: adminSessionToken,
              p_key: 'app_version',
              p_value: { value: String(partial.app_version).trim() },
            });
          }
          if (partial.preview_image_url !== undefined) {
            await callDirectSupabaseRpc('admin_set_setting', {
              p_session_token: adminSessionToken,
              p_key: 'preview_image_url',
              p_value: { value: String(partial.preview_image_url).trim() },
            });
          }
          if (partial.permissions) {
            await callDirectSupabaseRpc('admin_set_permissions', {
              p_session_token: adminSessionToken,
              p_permissions: partial.permissions,
            });
          }
          if (partial.app_enabled !== undefined) {
            await callDirectSupabaseRpc('admin_set_setting', {
              p_session_token: adminSessionToken,
              p_key: 'app_enabled',
              p_value: { value: Boolean(partial.app_enabled) },
            });
          }
          if (partial.bg_enabled !== undefined) {
            await callDirectSupabaseRpc('admin_set_setting', {
              p_session_token: adminSessionToken,
              p_key: 'bg_enabled',
              p_value: { value: Boolean(partial.bg_enabled) },
            });
          }
          if (partial.bg_image_url !== undefined) {
            await callDirectSupabaseRpc('admin_set_setting', {
              p_session_token: adminSessionToken,
              p_key: 'bg_image_url',
              p_value: { value: String(partial.bg_image_url).trim() },
            });
          }
          if (partial.bg_opacity !== undefined) {
            await callDirectSupabaseRpc('admin_set_setting', {
              p_session_token: adminSessionToken,
              p_key: 'bg_opacity',
              p_value: { value: Number(partial.bg_opacity) },
            });
          }
          await fetchDirectFromSupabase();
          if (!options?.suppressToast) {
            showToast('บันทึกสำเร็จ', 'ข้อมูลถูกบันทึกในฐานข้อมูลกลางแล้ว', 'success');
          }
          return true;
        } catch (_sbErr) {
          showToast('บันทึกไม่สำเร็จ', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
          return false;
        }
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [adminSessionToken, callDirectSupabaseRpc, fetchDirectFromSupabase, showToast]
  );

  const togglePermission = useCallback(
    async (key: keyof AppPermissions, label?: string) => {
      const nextVal = !settings.permissions[key];
      const nextPermissions: AppPermissions = {
        ...settings.permissions,
        [key]: nextVal,
      };
      setSettings((prev) => ({ ...prev, permissions: nextPermissions }));
      const permName = label ? `สิทธิ์${label}` : 'สิทธิ์การใช้งาน';
      showToast(
        `${nextVal ? 'เปิด' : 'ปิด'}สิทธิ์สำเร็จ`,
        `${nextVal ? 'เปิด' : 'ปิด'}${permName}เรียบร้อยแล้ว`,
        'success'
      );

      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: nextPermissions, sessionToken: adminSessionToken }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          throw new Error('Static host fallback');
        }
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setSettings((prev) => ({ ...prev, permissions: settings.permissions }));
          showToast('เปลี่ยนสิทธิ์ไม่สำเร็จ', data?.error || 'เกิดข้อผิดพลาด', 'error');
          return false;
        }
        if (data.settings) setSettings(data.settings);
        if (Array.isArray(data.audit_logs)) setAuditLogs(data.audit_logs);
        return true;
      } catch (_err) {
        try {
          const rpc = await callDirectSupabaseRpc('admin_set_permissions', {
            p_session_token: adminSessionToken,
            p_permissions: nextPermissions,
          });
          if (rpc.ok) {
            await fetchDirectFromSupabase();
            return true;
          }
        } catch (_sbErr) {
          // Fallback error below
        }
        setSettings((prev) => ({ ...prev, permissions: settings.permissions }));
        showToast('เปลี่ยนสิทธิ์ไม่สำเร็จ', 'เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        return false;
      }
    },
    [adminSessionToken, callDirectSupabaseRpc, fetchDirectFromSupabase, settings.permissions, showToast]
  );

  const manageBoiler = useCallback(
    async (payload: {
      id?: string;
      name?: string;
      active?: boolean;
      action?: 'add' | 'rename' | 'toggle' | 'delete';
    }) => {
      setIsLoading(true);
      setLoadingMessage('กำลังอัปเดตข้อมูล Boiler...');
      try {
        const res = await fetch('/api/boilers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, sessionToken: adminSessionToken }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          throw new Error('Static host fallback');
        }
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast('ดำเนินการไม่สำเร็จ', data?.error || 'ไม่สามารถอัปเดต Boiler ได้', 'error');
          return false;
        }
        if (Array.isArray(data.boilers)) setBoilers(data.boilers);
        if (Array.isArray(data.audit_logs)) setAuditLogs(data.audit_logs);
        showToast('บันทึกสำเร็จ', 'ข้อมูล Boiler ถูกบันทึกในฐานข้อมูลกลางแล้ว', 'success');
        return true;
      } catch (_err) {
        try {
          const cleanName = (payload.name || '').trim();
          const matchKey = cleanName.toLowerCase().replace(/[\s#]+/g, '');
          if (!payload.action || payload.action === 'add') {
            const bRes = await fetch(`${DIRECT_SUPABASE_URL}/rest/v1/boilers?select=*&order=sort_order.asc`, {
              headers: DIRECT_SB_HEADERS,
            });
            const allRows = bRes.ok ? ((await bRes.json()) as Array<Record<string, unknown>>) : [];
            const inactiveRow = allRows.find(
              (r) =>
                r.active === false &&
                String(r.name || '')
                  .toLowerCase()
                  .replace(/[\s#]+/g, '') === matchKey
            );
            if (inactiveRow) {
              await callDirectSupabaseRpc('admin_manage_boiler', {
                p_session_token: adminSessionToken,
                p_action: 'enable',
                p_id: String(inactiveRow.id),
              });
              if (String(inactiveRow.name || '').trim() !== cleanName) {
                await callDirectSupabaseRpc('admin_manage_boiler', {
                  p_session_token: adminSessionToken,
                  p_action: 'rename',
                  p_id: String(inactiveRow.id),
                  p_name: cleanName,
                });
              }
              await fetchDirectFromSupabase();
              showToast('บันทึกสำเร็จ', 'ข้อมูล Boiler ถูกบันทึกในฐานข้อมูลกลางแล้ว', 'success');
              return true;
            }
          }
          const sbAction =
            payload.action === 'delete' || payload.action === 'toggle'
              ? 'disable'
              : payload.action === 'rename'
              ? 'rename'
              : 'add';
          const rpc = await callDirectSupabaseRpc('admin_manage_boiler', {
            p_session_token: adminSessionToken,
            p_action: sbAction,
            ...(payload.id ? { p_id: payload.id } : {}),
            ...(cleanName ? { p_name: cleanName } : {}),
          });
          if (rpc.ok) {
            await fetchDirectFromSupabase();
            showToast('บันทึกสำเร็จ', 'ข้อมูล Boiler ถูกบันทึกในฐานข้อมูลกลางแล้ว', 'success');
            return true;
          }
        } catch (_sbErr) {
          // Ignore and show error below
        }
        showToast('ดำเนินการไม่สำเร็จ', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [adminSessionToken, callDirectSupabaseRpc, fetchDirectFromSupabase, showToast]
  );

  const manageChemical = useCallback(
    async (payload: {
      id?: string;
      code?: string;
      name?: string;
      divisor?: number;
      unit?: string;
      description?: string;
      active?: boolean;
      action?: 'add' | 'update' | 'toggle' | 'delete';
    }) => {
      setIsLoading(true);
      setLoadingMessage('กำลังอัปเดตข้อมูลสารเคมี...');
      try {
        const res = await fetch('/api/chemicals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, sessionToken: adminSessionToken }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          throw new Error('Static host fallback');
        }
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast('ดำเนินการไม่สำเร็จ', data?.error || 'ไม่สามารถอัปเดตสารเคมีได้', 'error');
          return false;
        }
        if (Array.isArray(data.chemicals)) setChemicals(data.chemicals);
        if (Array.isArray(data.audit_logs)) setAuditLogs(data.audit_logs);
        showToast('บันทึกสำเร็จ', 'ข้อมูลสารเคมีถูกบันทึกในฐานข้อมูลกลางแล้ว', 'success');
        return true;
      } catch (_err) {
        try {
          const cleanName = (payload.name || '').trim();
          const cleanLower = cleanName.toLowerCase();
          if (!payload.action || payload.action === 'add') {
            const cRes = await fetch(`${DIRECT_SUPABASE_URL}/rest/v1/chemicals?select=*&order=sort_order.asc`, {
              headers: DIRECT_SB_HEADERS,
            });
            const allRows = cRes.ok ? ((await cRes.json()) as Array<Record<string, unknown>>) : [];
            const inactiveRow = allRows.find(
              (r) => r.active === false && String(r.name || '').trim().toLowerCase() === cleanLower
            );
            if (inactiveRow) {
              await callDirectSupabaseRpc('admin_manage_chemical', {
                p_session_token: adminSessionToken,
                p_action: 'enable',
                p_id: String(inactiveRow.id),
              });
              await callDirectSupabaseRpc('admin_manage_chemical', {
                p_session_token: adminSessionToken,
                p_action: 'update',
                p_id: String(inactiveRow.id),
                p_name: cleanName,
                p_divisor: Number(payload.divisor) || 4,
                p_unit: payload.unit || 'L',
              });
              await fetchDirectFromSupabase();
              showToast('บันทึกสำเร็จ', 'ข้อมูลสารเคมีถูกบันทึกในฐานข้อมูลกลางแล้ว', 'success');
              return true;
            }
          }
          const sbAction =
            payload.action === 'delete' || payload.action === 'toggle'
              ? 'disable'
              : payload.action === 'update'
              ? 'update'
              : 'add';
          const rpc = await callDirectSupabaseRpc('admin_manage_chemical', {
            p_session_token: adminSessionToken,
            p_action: sbAction,
            ...(payload.id ? { p_id: payload.id } : {}),
            ...(cleanName ? { p_name: cleanName } : {}),
            ...(payload.divisor !== undefined ? { p_divisor: Number(payload.divisor) } : {}),
            ...(payload.unit ? { p_unit: payload.unit } : {}),
          });
          if (rpc.ok) {
            await fetchDirectFromSupabase();
            showToast('บันทึกสำเร็จ', 'ข้อมูลสารเคมีถูกบันทึกในฐานข้อมูลกลางแล้ว', 'success');
            return true;
          }
        } catch (_sbErr) {
          // Ignore and show error below
        }
        showToast('ดำเนินการไม่สำเร็จ', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [adminSessionToken, callDirectSupabaseRpc, fetchDirectFromSupabase, showToast]
  );

  const reconnectDevice = useCallback(() => {
    resetDeviceSessionId();
    setIsDeviceKicked(false);
    void sendPresencePing();
    void refreshState(false);
  }, [refreshState, sendPresencePing]);

  const fetchActiveDevices = useCallback(async (): Promise<ActiveDeviceInfo[]> => {
    try {
      const res = await fetch(`/api/presence/devices?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const currentSessionId = getDeviceSessionId();
        if (Array.isArray(data.devices)) {
          return data.devices.map((d: ActiveDeviceInfo) => ({
            ...d,
            isCurrent: d.sessionId === currentSessionId,
          }));
        }
      }
    } catch {
      // Ignore
    }
    return [];
  }, []);

  const kickDevice = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/presence/kick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.activeCount === 'number') {
            setActiveUsersCount(data.activeCount);
          }
          showToast('ตัดการเชื่อมต่อสำเร็จ', 'อุปกรณ์ดังกล่าวถูกลบออกจากระบบและเด้งออกทันที', 'success');
          return true;
        }
      } catch {
        // Ignore
      }
      showToast('เกิดข้อผิดพลาด', 'ไม่สามารถตัดการเชื่อมต่ออุปกรณ์ได้', 'error');
      return false;
    },
    [showToast]
  );

  const deleteDeviceRecord = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/presence/devices/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.activeCount === 'number') {
            setActiveUsersCount(data.activeCount);
          }
          showToast('ลบประวัติสำเร็จ', 'ลบประวัติอุปกรณ์ดังกล่าวออกจากระบบเรียบร้อยแล้ว', 'success');
          return true;
        }
      } catch {
        // Ignore
      }
      showToast('เกิดข้อผิดพลาด', 'ไม่สามารถลบประวัติอุปกรณ์ได้', 'error');
      return false;
    },
    [showToast]
  );

  return (
    <BoilerContext.Provider
      value={{
        settings,
        boilers,
        chemicals,
        history,
        auditLogs,
        supabaseOnline,
        supabaseUrl,
        isLoading,
        loadingMessage,
        toasts,
        adminUnlocked,
        adminSessionToken,
        hasUnreadHistory,
        isHomeScreenApp,
        notificationPermission,
        activeUsersCount,
        isDeviceKicked,
        reconnectDevice,
        fetchActiveDevices,
        kickDevice,
        deleteDeviceRecord,
        requestHomeScreenNotificationPermission,
        markHistoryRead,
        showToast,
        dismissToast,
        refreshState,
        getLatestLevelForBoiler,
        submitCalculation,
        deleteHistoryRecord,
        loginAdmin,
        verifyAdminPin,
        logoutAdmin,
        changeAdminPin,
        saveAppSettings,
        togglePermission,
        manageBoiler,
        manageChemical,
        isSplashScreenVisible,
        triggerSplashScreen,
        dismissSplashScreen,
      }}
    >
      {children}
    </BoilerContext.Provider>
  );
};

export function useBoiler() {
  const ctx = useContext(BoilerContext);
  if (!ctx) {
    throw new Error('useBoiler must be used within a BoilerProvider');
  }
  return ctx;
}
