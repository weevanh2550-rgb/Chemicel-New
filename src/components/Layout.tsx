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
  Download,
  Share2,
  Home,
  Calculator,
  History,
  Settings,
  Bell,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import QRCode from 'qrcode';
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
    activeUsersCount,
    isDeviceKicked,
    reconnectDevice,
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
    window.scrollTo(0, 0);
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

  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Generate QR Code locally inside the device (0ms instant load, works offline, no external API lag)
  useEffect(() => {
    if (!liveWebUrl) return;
    QRCode.toDataURL(liveWebUrl, {
      width: 600,
      margin: 1.5,
      color: {
        dark: '#0369a1', // sky-700
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.warn('QR Code generation error:', err);
      });
  }, [liveWebUrl]);

  const handleDownloadQr = async () => {
    if (!qrDataUrl) return;
    try {
      // Convert Data URL to Blob and File object for native Photo Library / System integration
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'Boiler-Chemical-QRCode.png', { type: 'image/png' });

      // On Mobile (iOS / Android): Trigger native share sheet where user can tap "บันทึกภาพ" (Save Image to Photos)
      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: 'Boiler App QR Code',
          });
          showToast('บันทึกรูป QR Code สำเร็จ', 'นำรูปภาพไปสั่งพิมพ์หรือแปะตามแผนกได้เลยครับ', 'success');
          return;
        } catch (shareErr) {
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            return;
          }
        }
      }

      // On Computer (PC / Mac) or standard browser: Direct file download to Downloads / Files folder
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'Boiler-Chemical-QRCode.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      showToast('บันทึกรูป QR Code สำเร็จ', 'ดาวน์โหลดไฟล์รูปภาพลงเครื่องคอมพิวเตอร์เรียบร้อยแล้ว', 'success');
    } catch (_e) {
      // Direct fallback
      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = 'Boiler-Chemical-QRCode.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('บันทึกรูป QR Code สำเร็จ', 'บันทึกไฟล์รูปภาพลงเครื่องแล้ว', 'success');
    }
  };

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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8f9fb] dark:bg-slate-950 text-slate-800 dark:text-slate-100 select-none relative transition-colors duration-200">
      {/* 💻 แถบเมนูด้านข้างสำหรับคอมพิวเตอร์ (Desktop Sidebar Navigation: Windows / Mac / PC) */}
      <aside className="hidden md:flex flex-col justify-between w-64 lg:w-72 shrink-0 h-screen sticky top-0 bg-white dark:bg-slate-900 border-r border-sky-100/90 dark:border-slate-800 shadow-2xs z-30 select-none p-4 lg:p-5">
        {/* Top: Branding */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-2xs shrink-0">
              <img
                src={appLogo}
                alt={settings.site_name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-base tracking-tight text-slate-900 dark:text-slate-100 truncate">
                {settings.site_name || 'BOILER CHEMICAL'}
              </div>
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                {settings.department_name || 'แผนกบอยเลอร์'}
              </span>
            </div>
          </div>

          <div className="h-[1px] bg-sky-100/80 dark:bg-slate-800" />

          {/* Navigation Links in Sidebar */}
          <nav aria-label="เมนูหลักสำหรับคอมพิวเตอร์" className="space-y-1.5">
            <button
              type="button"
              onClick={() => handleNavClick('/')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                location.pathname === '/'
                  ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200/90 dark:border-sky-800/80 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-50/50 dark:hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Home className="w-5 h-5 shrink-0" />
              <span>หน้าหลัก</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('/calculation', 'allow_calculate', 'การคำนวณ')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                location.pathname === '/calculation'
                  ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200/90 dark:border-sky-800/80 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-50/50 dark:hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Calculator className="w-5 h-5 shrink-0" />
              <span>การคำนวณ</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('/history', 'allow_history_view', 'การดูประวัติ')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                location.pathname === '/history'
                  ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200/90 dark:border-sky-800/80 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-50/50 dark:hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <History className="w-5 h-5 shrink-0" />
                <span>ประวัติ</span>
              </div>
              {isHomeScreenApp && hasUnreadHistory && location.pathname !== '/history' && (
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('/chemicals', 'allow_chemical_info', 'ข้อมูลสารเคมี')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                location.pathname === '/chemicals'
                  ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200/90 dark:border-sky-800/80 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-50/50 dark:hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <FlaskConical className="w-5 h-5 shrink-0" />
              <span>สารเคมี</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('/settings')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                location.pathname === '/settings'
                  ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200/90 dark:border-sky-800/80 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-50/50 dark:hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Settings className="w-5 h-5 shrink-0" />
              <span>การตั้งค่า</span>
            </button>
          </nav>
        </div>

        {/* Bottom of Sidebar: QR & Version Info */}
        <div className="space-y-3 pt-4 border-t border-sky-100/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setQrModalOpen(true)}
            className="w-full p-2.5 rounded-2xl bg-sky-50 dark:bg-slate-800 hover:bg-sky-100/80 dark:hover:bg-slate-750 active:bg-sky-200 border border-sky-200/70 dark:border-slate-700 text-sky-800 dark:text-sky-300 text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <QrCode className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>เปิด QR Code / ติดตั้ง</span>
          </button>

          <div className="text-center">
            <span className="inline-block text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50/70 dark:bg-sky-950/60 px-2.5 py-0.5 rounded-full border border-sky-100 dark:border-sky-800">
              เวอร์ชัน {settings.app_version || '3.25.0'} • PC & Web
            </span>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar with Logo & QR Button — ONLY visible on Mobile Home Page */}
        {isHomePage && (
          <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-2xs shrink-0">
                  <img
                    src={appLogo}
                    alt={settings.site_name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-base tracking-tight text-slate-900 dark:text-slate-100 truncate">
                    {settings.site_name || 'BOILER CHEMICAL'}
                  </div>
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    Boiler Chemical Management
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setQrModalOpen(true)}
                  className="w-10 h-10 rounded-2xl border border-sky-100/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 hover:border-sky-300 active:bg-sky-100 active:scale-95 text-sky-600 dark:text-sky-400 flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0"
                  aria-label="เปิด QR Code สำหรับเว็บแอป"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Main Content Stage: Centered in desktop view, vertical and comfortable to read */}
        <main className="flex-1 w-full max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 pt-3 pb-28 md:pb-12 relative z-10">
          {children}
        </main>
      </div>

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

      {/* Disconnected / Kicked by Admin Overlay */}
      {isDeviceKicked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md select-none animate-in fade-in duration-200">
          <div className="w-full max-w-xs rounded-3xl border border-amber-200/90 dark:border-amber-800 bg-white dark:bg-slate-900 p-6 text-center shadow-2xl space-y-4 relative overflow-hidden">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-2xs">
              <LogOut className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">การเชื่อมต่อถูกตัด</h3>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1">
                ออกจากระบบโดยผู้ดูแลระบบ
              </p>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed px-1">
              อุปกรณ์เครื่องนี้ถูกตัดการเชื่อมต่อออกจากระบบชั่วคราว คุณสามารถแตะปุ่มด้านล่างเพื่อเข้าสู่ระบบใหม่ได้ทันที
            </p>

            <button
              type="button"
              onClick={reconnectDevice}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 active:scale-98 text-white text-xs font-extrabold transition-all cursor-pointer shadow-md shadow-sky-500/20"
            >
              เข้าใช้งานใหม่ (เชื่อมต่ออีกครั้ง)
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar (แสดงเฉพาะบนมือถือ — ซ่อนบนจอคอมพิวเตอร์ md:hidden) */}
      <nav
        aria-label="แถบเมนูด้านล่างสำหรับมือถือ"
        onContextMenu={(e) => e.preventDefault()}
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-sky-100/90 dark:border-slate-800 shadow-[0_-4px_20px_rgba(14,165,233,0.08)] select-none"
      >
        <div className="max-w-md mx-auto px-2 h-16 grid grid-cols-5 gap-1 items-center">
          {/* 1. หน้าหลัก */}
          <button
            type="button"
            onClick={() => handleNavClick('/')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl border transition-all cursor-pointer select-none touch-manipulation active:scale-95 ${
              location.pathname === '/'
                ? 'text-sky-600 dark:text-sky-400 bg-sky-50/90 dark:bg-sky-950/70 border-sky-200/90 dark:border-sky-800/80 font-extrabold scale-[1.02]'
                : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50/40 dark:hover:bg-slate-800/40 active:bg-sky-100/70 dark:active:bg-slate-750 active:border-sky-200 active:text-sky-700 font-semibold'
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
                ? 'text-sky-600 dark:text-sky-400 bg-sky-50/90 dark:bg-sky-950/70 border-sky-200/90 dark:border-sky-800/80 font-extrabold scale-[1.02]'
                : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50/40 dark:hover:bg-slate-800/40 active:bg-sky-100/70 dark:active:bg-slate-750 active:border-sky-200 active:text-sky-700 font-semibold'
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
                ? 'text-sky-600 dark:text-sky-400 bg-sky-50/90 dark:bg-sky-950/70 border-sky-200/90 dark:border-sky-800/80 font-extrabold scale-[1.02]'
                : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50/40 dark:hover:bg-slate-800/40 active:bg-sky-100/70 dark:active:bg-slate-750 active:border-sky-200 active:text-sky-700 font-semibold'
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
                ? 'text-sky-600 dark:text-sky-400 bg-sky-50/90 dark:bg-sky-950/70 border-sky-200/90 dark:border-sky-800/80 font-extrabold scale-[1.02]'
                : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50/40 dark:hover:bg-slate-800/40 active:bg-sky-100/70 dark:active:bg-slate-750 active:border-sky-200 active:text-sky-700 font-semibold'
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
                ? 'text-sky-600 dark:text-sky-400 bg-sky-50/90 dark:bg-sky-950/70 border-sky-200/90 dark:border-sky-800/80 font-extrabold scale-[1.02]'
                : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50/40 dark:hover:bg-slate-800/40 active:bg-sky-100/70 dark:active:bg-slate-750 active:border-sky-200 active:text-sky-700 font-semibold'
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
                ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-100'
                : t.type === 'error'
                ? 'bg-white/95 dark:bg-slate-900/95 border-rose-200 dark:border-rose-800 text-slate-800 dark:text-slate-100'
                : 'bg-white/95 dark:bg-slate-900/95 border-sky-200 dark:border-sky-800 text-slate-800 dark:text-slate-100'
            }`}
          >
            <div className="shrink-0">
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-sky-600 dark:text-sky-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">{t.title}</p>
              {t.message && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate mt-0.5">
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-950/50 dark:bg-black/70 backdrop-blur-xs select-none"
        >
          <div className="w-full max-w-xs relative overflow-hidden rounded-3xl p-5 shadow-2xl border border-sky-100/90 dark:border-slate-800 bg-gradient-to-br from-white via-white to-sky-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 text-center">
            {/* Top highlight specular sheen & soft light-blue glow matching menu box */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-sky-300/60 dark:via-sky-500/40 to-transparent pointer-events-none" />
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-sky-200/35 dark:bg-sky-900/30 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-sky-100/40 dark:bg-sky-950/40 rounded-full blur-xl pointer-events-none" />

            {/* Close Button restored to top-right */}
            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              aria-label="ปิดหน้ารหัส QR"
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 hover:text-rose-600 text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center cursor-pointer transition-colors shadow-2xs active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-extrabold text-sky-800 dark:text-sky-300 relative z-10">QR Code</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 relative z-10">สแกนเพื่อเปิดแอปหรือติดตั้ง</p>

            <div className="mx-auto my-3 w-56 aspect-square rounded-2xl border border-sky-100 dark:border-slate-700 bg-white p-2 flex items-center justify-center shadow-2xs relative z-10 overflow-hidden">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                  <div className="w-7 h-7 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin" />
                  <span className="text-[10px] font-semibold">สร้าง QR Code...</span>
                </div>
              )}
            </div>

            <div className="px-3 py-2 rounded-xl bg-sky-50 dark:bg-slate-800 text-[10px] text-sky-700 dark:text-sky-300 break-all font-semibold mb-3 relative z-10">
              {liveWebUrl}
            </div>

            <div className="grid grid-cols-2 gap-2 relative z-10">
              <button
                type="button"
                onClick={handleShareUrl}
                className="rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 active:scale-95 text-white py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation shadow-xs shadow-sky-600/20"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>แชร์แอป</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadQr}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shadow-emerald-600/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>บันทึก QR</span>
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
