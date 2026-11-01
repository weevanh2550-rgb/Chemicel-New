import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  FlaskConical,
  QrCode,
  X,
  Copy,
  Share2,
  Home,
  Calculator,
  History,
  Settings,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import { useBoiler } from '../context/BoilerContext';
import appLogo from '../assets/images/boiler_press_chem_logo_1791513593157.jpg';
import { SplashScreen } from './SplashScreen';

// Live public App URL with 100% bypassed authentication (no cookie check)
const LIVE_APP_URL = 'https://ais-dev-3h2c3yfgusnpkwaet556wl-520499311404.asia-east1.run.app/';

export const resolveShareableAppUrl = (): string => {
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return LIVE_APP_URL;
    }
    return `${origin.replace(/\/+$/, '')}/`;
  }
  return LIVE_APP_URL;
};

const copyTextWithFallback = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_e) {
      // Fallback to textarea copy below
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch (_e) {
    return false;
  }
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    settings,
    isLoading,
    toasts,
    dismissToast,
    showToast,
    hasUnreadHistory,
    isHomeScreenApp,
    notificationPermission,
    requestHomeScreenNotificationPermission,
    markHistoryRead,
    isSplashScreenVisible,
  } = useBoiler();

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [notifPromptDismissed, setNotifPromptDismissed] = useState(false);
  const [liveWebUrl, setLiveWebUrl] = useState<string>(() => resolveShareableAppUrl());
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === '/';

  // Automatically sync the real shareable app URL whenever opened or navigated
  useEffect(() => {
    setLiveWebUrl(resolveShareableAppUrl());
  }, [location.pathname, qrModalOpen]);

  // Keep server awake continuously while any user or admin has the app open
  useEffect(() => {
    const pingServer = () => {
      fetch(`/api/keepalive?renew=1&client=${Date.now()}`, { cache: 'no-store' }).catch(() => {});
    };
    pingServer();
    const timer = window.setInterval(pingServer, 45_000);
    return () => window.clearInterval(timer);
  }, []);

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&color=0369a1&data=${encodeURIComponent(
    liveWebUrl
  )}`;

  const handleCopyUrl = async () => {
    const appUrl = resolveShareableAppUrl();
    const copied = await copyTextWithFallback(appUrl);
    if (copied) {
      showToast('คัดลอกลิงก์แอปสำเร็จ', 'พร้อมส่งแชร์ให้ผู้อื่นเปิดใช้งานได้ทันที', 'success');
    } else {
      showToast('ลิงก์แอปสำหรับแชร์', appUrl, 'info');
    }
  };

  const handleShareUrl = async () => {
    const appUrl = resolveShareableAppUrl();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          url: appUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }
    const copied = await copyTextWithFallback(appUrl);
    if (copied) {
      showToast('คัดลอกลิงก์แชร์แอปสำเร็จ', 'พร้อมนำไปวางในแชท Messenger หรือ LINE ได้ทันที', 'success');
    } else {
      showToast('ลิงก์แชร์แอป', appUrl, 'info');
    }
  };

  const handleNavClick = (
    path: string,
    permKey?: keyof typeof settings.permissions,
    label?: string
  ) => {
    // When app is closed for maintenance, only allow navigating to /settings
    if (settings.app_enabled === false && path !== '/settings') {
      showToast('ระบบปิดปรับปรุงชั่วคราว', 'ปิดปรับปรุงชั่วคราว จะเปิดให้ใช้งานในเร็วๆ นี้', 'info');
      return;
    }

    if (permKey && !settings.permissions[permKey]) {
      showToast(
        'ฟังก์ชันถูกปิดไว้',
        `ผู้ดูแลระบบปิดสิทธิ์${label || ''}ไว้ใน Permission Center`,
        'error'
      );
      return;
    }

    if (path === '/history') {
      markHistoryRead();
    }

    if (location.pathname !== path) {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fb] text-slate-800 select-none relative">
      {/* Top Bar with Logo & QR Button — ONLY visible on Home Page */}
      {isHomePage && (
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-2xs">
          <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-2xs shrink-0">
                <img
                  src={appLogo}
                  alt={settings.site_name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-base tracking-tight text-slate-900 truncate">
                  {settings.site_name || 'BOILER CHEMICAL'}
                </div>
                <span className="block text-[11px] font-semibold text-slate-500 truncate">
                  Boiler Chemical Management
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="w-10 h-10 rounded-2xl border border-sky-100/90 bg-white hover:bg-sky-50 hover:border-sky-300 active:bg-sky-100 active:border-sky-400 active:scale-95 text-sky-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0"
              aria-label="เปิด QR Code สำหรับเว็บแอป"
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      {/* Main Content Stage (Responsive: Mobile max-w-md, Tablet max-w-3xl, Desktop max-w-5xl) */}
      <main
        className={`flex-1 w-full max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-3 ${
          isHomePage
            ? 'h-[calc(100dvh-8rem)] max-h-[calc(100dvh-8rem)] overflow-hidden touch-none overscroll-none select-none'
            : 'pb-20'
        } relative z-10`}
      >
        {children}
      </main>

      {/* Centered Maintenance / Update Overlay (Shown on all pages except /settings when app is closed) */}
      {settings.app_enabled === false && location.pathname !== '/settings' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md select-none">
          <div className="w-full max-w-xs rounded-3xl border border-rose-200/90 bg-gradient-to-br from-white via-white to-rose-50/70 p-6 text-center shadow-2xl space-y-4 relative overflow-hidden">
            {/* Top highlight specular sheen & soft rose glow */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-rose-400/60 to-transparent pointer-events-none" />
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-rose-200/40 rounded-full blur-xl pointer-events-none" />

            {/* Red Alert Notification Icon */}
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/90 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
              <AlertTriangle className="w-7 h-7 text-rose-600 animate-pulse" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">ปิดปรับปรุงชั่วคราว</h3>
              <p className="text-xs font-bold text-rose-600 mt-1">
                จะเปิดให้ใช้งานในเร็วๆ นี้
              </p>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed px-1">
              ระบบกำลังอยู่ระหว่างปรับปรุงและอัปเดตข้อมูลชั่วคราว เพื่อความปลอดภัยและความเสถียร ขออภัยในความไม่สะดวก
            </p>

            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 active:bg-rose-100 text-slate-700 hover:text-rose-700 text-xs font-extrabold transition-all cursor-pointer border border-slate-200/80"
            >
              เข้าสู่หน้าตั้งค่า (สำหรับแอดมิน)
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar (5 items: หน้าหลัก, การคำนวณ, ประวัติ, สารเคมี, การตั้งค่า) */}
      <nav
        aria-label="แถบเมนูด้านล่าง"
        onContextMenu={(e) => e.preventDefault()}
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-sky-100/90 shadow-[0_-4px_20px_rgba(14,165,233,0.08)] select-none"
      >
        <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-2 md:px-4 h-16 grid grid-cols-5 gap-1 md:gap-3 items-center">
          {/* 1. หน้าหลัก */}
          <button
            type="button"
            onClick={() => handleNavClick('/')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl border transition-all cursor-pointer select-none touch-manipulation active:scale-95 ${
              location.pathname === '/'
                ? 'text-sky-600 bg-sky-50/90 border-sky-200/90 font-extrabold scale-[1.02]'
                : 'text-slate-400 border-transparent hover:text-sky-600 hover:bg-sky-50/40 active:bg-sky-100/70 active:border-sky-200 active:text-sky-700 font-semibold'
            }`}
          >
            <Home className="w-5 h-5 pointer-events-none" />
            <span className="text-[11px] mt-0.5 pointer-events-none">หน้าหลัก</span>
          </button>

          {/* 2. การคำนวณ */}
          <button
            type="button"
            onClick={() => handleNavClick('/calculation', 'allow_calculate', 'การคำนวณ')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl border transition-all cursor-pointer select-none touch-manipulation active:scale-95 ${
              location.pathname === '/calculation'
                ? 'text-sky-600 bg-sky-50/90 border-sky-200/90 font-extrabold scale-[1.02]'
                : 'text-slate-400 border-transparent hover:text-sky-600 hover:bg-sky-50/40 active:bg-sky-100/70 active:border-sky-200 active:text-sky-700 font-semibold'
            }`}
          >
            <Calculator className="w-5 h-5 pointer-events-none" />
            <span className="text-[11px] mt-0.5 pointer-events-none">การคำนวณ</span>
          </button>

          {/* 3. ประวัติ */}
          <button
            type="button"
            onClick={() => handleNavClick('/history', 'allow_history_view', 'การดูประวัติ')}
            className={`relative flex flex-col items-center justify-center py-1.5 rounded-2xl border transition-all cursor-pointer select-none touch-manipulation active:scale-95 ${
              location.pathname === '/history'
                ? 'text-sky-600 bg-sky-50/90 border-sky-200/90 font-extrabold scale-[1.02]'
                : 'text-slate-400 border-transparent hover:text-sky-600 hover:bg-sky-50/40 active:bg-sky-100/70 active:border-sky-200 active:text-sky-700 font-semibold'
            }`}
          >
            <div className="relative pointer-events-none">
              <History className="w-5 h-5" />
              {isHomeScreenApp && hasUnreadHistory && location.pathname !== '/history' && (
                <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </div>
            <span className="text-[11px] mt-0.5 pointer-events-none">ประวัติ</span>
          </button>

          {/* 4. สารเคมี */}
          <button
            type="button"
            onClick={() => handleNavClick('/chemicals', 'allow_chemical_info', 'ข้อมูลสารเคมี')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl border transition-all cursor-pointer select-none touch-manipulation active:scale-95 ${
              location.pathname === '/chemicals'
                ? 'text-sky-600 bg-sky-50/90 border-sky-200/90 font-extrabold scale-[1.02]'
                : 'text-slate-400 border-transparent hover:text-sky-600 hover:bg-sky-50/40 active:bg-sky-100/70 active:border-sky-200 active:text-sky-700 font-semibold'
            }`}
          >
            <FlaskConical className="w-5 h-5 pointer-events-none" />
            <span className="text-[11px] mt-0.5 pointer-events-none">สารเคมี</span>
          </button>

          {/* 5. การตั้งค่า */}
          <button
            type="button"
            onClick={() => handleNavClick('/settings')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl border transition-all cursor-pointer select-none touch-manipulation active:scale-95 ${
              location.pathname === '/settings'
                ? 'text-sky-600 bg-sky-50/90 border-sky-200/90 font-extrabold scale-[1.02]'
                : 'text-slate-400 border-transparent hover:text-sky-600 hover:bg-sky-50/40 active:bg-sky-100/70 active:border-sky-200 active:text-sky-700 font-semibold'
            }`}
          >
            <Settings className="w-5 h-5 pointer-events-none" />
            <span className="text-[11px] mt-0.5 pointer-events-none">การตั้งค่า</span>
          </button>
        </div>
      </nav>

      {/* Clean Toast Alert */}
      <div className="fixed top-4 inset-x-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            onClick={() => {
              if (t.title === 'Boiler Chemical' || t.message?.includes('สารเคมีใหม่') || t.message?.includes('แตะเพื่อเข้าดู')) {
                markHistoryRead();
                navigate('/history');
                dismissToast(t.id);
              }
            }}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-lg backdrop-blur-md max-w-sm w-full transition-all cursor-pointer active:scale-98 ${
              t.type === 'success'
                ? 'bg-white/95 border-emerald-200 text-slate-800'
                : t.type === 'error'
                ? 'bg-white/95 border-rose-200 text-slate-800'
                : 'bg-white/95 border-sky-200 text-slate-800'
            }`}
          >
            <div className="shrink-0">
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-sky-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-slate-900">{t.title}</p>
              {t.message && (
                <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                  {t.message}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* QR Code Modal (Auto-synced with Real Live URL with Menu Box Gradient Texture) */}
      {qrModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setQrModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-950/50 backdrop-blur-xs select-none"
        >
          <div className="w-full max-w-xs relative overflow-hidden rounded-3xl p-5 shadow-2xl border border-sky-100/90 bg-gradient-to-br from-white via-white to-sky-50/70 text-center">
            {/* Top highlight specular sheen & soft light-blue glow matching menu box */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-sky-300/60 to-transparent pointer-events-none" />
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-sky-200/35 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-sky-100/40 rounded-full blur-xl pointer-events-none" />

            {/* Close Button restored to top-right */}
            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              aria-label="ปิดหน้ารหัส QR"
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-500 font-bold flex items-center justify-center cursor-pointer transition-colors shadow-2xs active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-extrabold text-sky-800 relative z-10">QR Code</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 relative z-10">สแกนเพื่อเปิดแอปบนเครื่องอื่น</p>

            <div className="mx-auto my-3 w-56 aspect-square rounded-2xl border border-sky-100 bg-white p-2 flex items-center justify-center shadow-2xs relative z-10">
              <img
                src={qrImageUrl}
                alt="QR Code"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="px-3 py-2 rounded-xl bg-sky-50 text-[10px] text-sky-700 break-all font-semibold mb-3 relative z-10">
              {liveWebUrl}
            </div>

            <div className="grid grid-cols-2 gap-2 relative z-10">
              <button
                type="button"
                onClick={handleShareUrl}
                className="rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 active:scale-95 text-white py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>แชร์แอป</span>
              </button>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-700 py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>คัดลอก</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Home Screen Only: Native Mobile Notification Permission Modal */}
      {isHomeScreenApp &&
        !isLoading &&
        notificationPermission === 'default' &&
        !notifPromptDismissed &&
        typeof window !== 'undefined' &&
        'Notification' in window && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs">
            <div className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-sky-100 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center mx-auto">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">เปิดรับการแจ้งเตือนสารเคมี</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  รับแจ้งเตือนพร้อมเสียงแจ้งเตือนมาตรฐานของมือถือเมื่อมีเครื่องอื่นคำนวณหรืออัปเดตสารเคมีใหม่
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNotifPromptDismissed(true)}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 text-xs font-extrabold cursor-pointer"
                >
                  ไว้ทีหลัง
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const perm = await requestHomeScreenNotificationPermission();
                    setNotifPromptDismissed(true);
                    if (perm === 'granted') {
                      showToast('เปิดการแจ้งเตือนสำเร็จ', 'พร้อมรับแจ้งเตือนด้วยเสียงมาตรฐานของมือถือ', 'info', {
                        skipAppSound: true,
                      });
                    }
                  }}
                  className="rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white py-2.5 text-xs font-extrabold cursor-pointer"
                >
                  อนุญาตแจ้งเตือน
                </button>
              </div>
            </div>
          </div>
        )}

      {/* App Splash Screen / Launch Screen with Logo, Glowing Aura & % Progress Tube */}
      {isSplashScreenVisible && <SplashScreen />}
    </div>
  );
};
