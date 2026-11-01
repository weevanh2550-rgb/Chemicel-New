import React, { useState, useEffect } from 'react';
import appLogo from '../assets/images/boiler_press_chem_logo_1791513593157.jpg';
import { useBoiler } from '../context/BoilerContext';

interface SplashScreenProps {
  onDismiss?: () => void;
  isManualPreview?: boolean;
}

const SPLASH_NAVY = '#024368';

const setSystemBarColor = (color: string) => {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
};

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDismiss, isManualPreview = false }) => {
  const { refreshState, dismissSplashScreen } = useBoiler();
  const [progress, setProgress] = useState<number>(0);
  const [isExiting, setIsExiting] = useState<boolean>(false);

  // ปรับเวลาโหลด 2.4 วินาที กำลังพอดี สวยงาม และเปิดแอปได้เนียนตา
  useEffect(() => {
    setSystemBarColor(SPLASH_NAVY);

    if (!isManualPreview) {
      refreshState(false).catch(() => {});
    }

    const startTime = Date.now();
    const duration = 2400; // 2.4 วินาที

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const rawFraction = Math.min(elapsed / duration, 1);
      // Smooth natural cubic ease-out curve
      const easedProgress = Math.round((1 - Math.pow(1 - rawFraction, 2.2)) * 100);

      setProgress(easedProgress);

      if (rawFraction >= 1) {
        clearInterval(interval);
        // เมื่อครบ 100% เฟดจางหายเข้าสู่แอปอย่างรวดเร็วและนุ่มนวล
        setTimeout(() => {
          setIsExiting(true);
          setSystemBarColor('#ffffff');
          setTimeout(() => {
            if (onDismiss) onDismiss();
            dismissSplashScreen();
          }, 350);
        }, 150);
      }
    }, 24);

    return () => {
      clearInterval(interval);
      setSystemBarColor('#ffffff');
    };
  }, [isManualPreview, onDismiss, refreshState, dismissSplashScreen]);

  const handleSilentDismiss = () => {
    setIsExiting(true);
    setSystemBarColor('#ffffff');
    setTimeout(() => {
      if (onDismiss) onDismiss();
      dismissSplashScreen();
    }, 200);
  };

  return (
    <div
      onClick={handleSilentDismiss}
      className={`fixed inset-0 w-screen h-[100dvh] min-h-screen z-[100] flex flex-col items-center justify-center p-6 text-white select-none overflow-hidden transition-all duration-500 ease-in-out cursor-default ${
        isExiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        backgroundColor: SPLASH_NAVY,
        background: 'linear-gradient(180deg, #024368 0%, #024368 22%, #025785 48%, #0369a1 72%, #081b33 100%)',
      }}
    >
      {/* Top Status Bar Canopy: กลืนแถบด้านบน (สัญญาณ, เวลา, แบตเตอรี่) ให้เป็นสีน้ำเงินเข้มเนียนกริบ 100% ไม่มีรอยต่อ */}
      <div
        className="absolute top-0 left-0 right-0 h-44 pointer-events-none z-30"
        style={{
          background: 'linear-gradient(180deg, #024368 0%, #024368 75%, rgba(2, 67, 104, 0) 100%)',
        }}
      />
      {/* Background: ตกแต่งเอฟเฟกต์สารเคมีสุดสวยงาม (Chemical Fluid, Molecular Rings & Effervescence Bubbles) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* คลื่นของเหลวสารเคมีสีคราม-มรกต เรืองแสงไหวพริบนุ่มนวล */}
        <div className="absolute top-20 -left-20 w-[450px] h-[450px] bg-cyan-400/20 rounded-full blur-[100px] animate-ambient-sway-1" />
        <div className="absolute -bottom-24 -right-20 w-[480px] h-[480px] bg-teal-400/20 rounded-full blur-[100px] animate-ambient-sway-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-88 h-88 rounded-full bg-sky-400/20 blur-[80px]" />

        {/* ระลอกคลื่นน้ำเคมีใสใจกลางจอ */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 sm:w-96 sm:h-96 rounded-full border border-cyan-300/20 animate-ripple-wave" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 sm:w-120 sm:h-120 rounded-full border border-teal-300/15 animate-ripple-wave"
          style={{ animationDelay: '1.8s' }}
        />

        {/* 1. โครงสร้างโมเลกุลสารเคมีทรงหกเหลี่ยมเรืองแสง (Chemical Molecular Hexagon Rings) */}
        {/* โมเลกุลด้านขวาบน */}
        <div
          className="absolute top-[14%] right-[10%] w-18 h-18 text-cyan-300/40 animate-chem-hex"
          style={{ animationDelay: '0s' }}
        >
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-full h-full drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
            <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" />
            <line x1="50" y1="10" x2="50" y2="40" strokeDasharray="3 3" />
            <circle cx="50" cy="10" r="4" fill="#67e8f9" />
            <circle cx="85" cy="30" r="4" fill="#67e8f9" />
            <circle cx="85" cy="70" r="4" fill="#67e8f9" />
            <circle cx="50" cy="90" r="4" fill="#67e8f9" />
            <circle cx="15" cy="70" r="4" fill="#67e8f9" />
            <circle cx="15" cy="30" r="4" fill="#67e8f9" />
          </svg>
        </div>

        {/* โมเลกุลด้านซ้ายล่าง */}
        <div
          className="absolute bottom-[16%] left-[8%] w-16 h-16 text-teal-300/35 animate-chem-hex"
          style={{ animationDelay: '2.5s', animationDuration: '7s' }}
        >
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-full h-full drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]">
            <polygon points="50,12 82,30 82,68 50,86 18,68 18,30" />
            <polygon points="50,26 70,38 70,62 50,74 30,62 30,38" strokeWidth="1.5" strokeDasharray="4 2" />
            <circle cx="50" cy="12" r="3.5" fill="#5eead4" />
            <circle cx="82" cy="68" r="3.5" fill="#5eead4" />
            <circle cx="18" cy="30" r="3.5" fill="#5eead4" />
          </svg>
        </div>

        {/* โมเลกุลด้านซ้ายบน (เล็กๆ) */}
        <div
          className="absolute top-[22%] left-[12%] w-12 h-12 text-sky-200/35 animate-chem-hex"
          style={{ animationDelay: '1.2s', animationDuration: '8s' }}
        >
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
            <polygon points="50,15 80,32 80,68 50,85 20,68 20,32" />
            <circle cx="50" cy="15" r="3" fill="#bae6fd" />
            <circle cx="80" cy="68" r="3" fill="#bae6fd" />
            <circle cx="20" cy="68" r="3" fill="#bae6fd" />
          </svg>
        </div>

        {/* 2. ฟองอากาศสารเคมีเรืองแสงลอยขึ้นเบาๆ (Rising Luminous Chemical Bubbles) */}
        <div
          className="absolute bottom-10 left-[26%] w-4 h-4 rounded-full border border-cyan-300/60 bg-gradient-to-tr from-cyan-400/20 to-white/40 shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-chem-bubble"
          style={{ animationDelay: '0.4s', animationDuration: '4.2s' }}
        />
        <div
          className="absolute bottom-14 left-[45%] w-6 h-6 rounded-full border border-teal-200/60 bg-gradient-to-tr from-teal-400/20 to-white/50 shadow-[0_0_10px_rgba(45,212,191,0.7)] animate-chem-bubble"
          style={{ animationDelay: '1.8s', animationDuration: '5.2s' }}
        />
        <div
          className="absolute bottom-8 right-[24%] w-3.5 h-3.5 rounded-full border border-sky-300/60 bg-gradient-to-tr from-sky-400/20 to-white/40 shadow-[0_0_8px_rgba(56,189,248,0.6)] animate-chem-bubble"
          style={{ animationDelay: '2.6s', animationDuration: '4.8s' }}
        />
        <div
          className="absolute bottom-16 right-[38%] w-5 h-5 rounded-full border border-cyan-200/60 bg-gradient-to-tr from-cyan-300/20 to-white/50 shadow-[0_0_10px_rgba(103,232,249,0.7)] animate-chem-bubble"
          style={{ animationDelay: '0.9s', animationDuration: '4.5s' }}
        />

        {/* 3. ประกายวิบวับไหวพริบ (Twinkling Sparkle Stars) */}
        <div
          className="absolute top-[28%] right-[22%] w-4 h-4 text-sky-100 animate-twinkle"
          style={{ animationDelay: '1.4s', animationDuration: '3.4s' }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full drop-shadow-[0_0_8px_#ffffff]">
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>
        </div>

        <div
          className="absolute bottom-[30%] left-[16%] w-3.5 h-3.5 text-cyan-200 animate-twinkle"
          style={{ animationDelay: '2.1s', animationDuration: '3.2s' }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full drop-shadow-[0_0_7px_#67e8f9]">
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>
        </div>

        <div
          className="absolute top-[48%] right-[14%] w-3 h-3 text-cyan-100 animate-twinkle"
          style={{ animationDelay: '2.6s', animationDuration: '3.1s' }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full drop-shadow-[0_0_7px_#a5f3fc]">
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>
        </div>
      </div>

      {/* Main Center Content Container */}
      <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center">
        {/* 1. โลโก้เดิมของแอปตรงกลาง เด่นชัด สวยงาม แบบแอปทั่วไป */}
        <div className="relative flex items-center justify-center">
          {/* Subtle glowing halo */}
          <div className="absolute -inset-3.5 rounded-full bg-cyan-300/35 blur-xl animate-pulse" />

          {/* White Glossy Bezel */}
          <div className="relative p-2.5 sm:p-3 rounded-full bg-white/20 backdrop-blur-xl border-2 border-white/50 ring-8 ring-white/10 shadow-[0_20px_50px_rgba(2,132,199,0.5)]">
            <img
              src={appLogo}
              alt="ระบบสารเคมี"
              className="w-32 h-32 sm:w-36 sm:h-36 rounded-full object-cover shadow-2xl ring-2 ring-white/60"
            />
            {/* Top specular lens sheen */}
            <div className="absolute inset-2.5 sm:inset-3 rounded-full bg-gradient-to-b from-white/30 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

        {/* 2. ชื่อ "ระบบสารเคมี" ชัดเจน หรูหรา สไตล์แอปแท้ */}
        <h1 className="mt-7 text-3xl sm:text-4xl font-black text-white tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
          ระบบสารเคมี
        </h1>

        {/* 3. ส่วนหลอด% โหลด */}
        <div className="w-68 sm:w-76 mt-9 space-y-3">
          {/* คำด้านบนหลอดใส่ "กำลังโหลด" กลางจอ */}
          <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-sky-100 tracking-wider">
            <span>กำลังโหลด</span>
            <span className="inline-flex tracking-widest text-white animate-pulse">...</span>
          </div>

          {/* หลอด% แก้วใสคริสตัล พร้อมตัวเลขเปอร์เซ็นต์อยู่ตรงกลางหลอด */}
          <div className="h-7 sm:h-8 w-full bg-black/30 rounded-full p-[3px] border-2 border-white/35 backdrop-blur-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),0_8px_25px_rgba(0,0,0,0.3)] relative overflow-hidden">
            {/* หลอดสี Gradient สว่างสดใส */}
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 transition-all duration-150 ease-out shadow-[0_0_16px_rgba(103,232,249,0.85)] relative"
              style={{ width: `${Math.max(progress, 5)}%` }}
            >
              {/* แสงประกายวิ่งผ่านหลอด */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer-sweep pointer-events-none" />
            </div>

            {/* ตัวเลขเปอร์เซ็นต์ % อยู่กึ่งกลางหลอดอย่างชัดเจน อ่านง่าย */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span className="font-mono font-black text-xs sm:text-sm text-slate-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.7)] tracking-wider">
                {progress}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
