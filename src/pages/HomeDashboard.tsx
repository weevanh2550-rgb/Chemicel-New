import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  History,
  FlaskConical,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { useBoiler } from '../context/BoilerContext';
import { parsePreviewImages } from '../types/boiler';
export const HomeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { settings, isHomeScreenApp, hasUnreadHistory, markHistoryRead, showToast } = useBoiler();

  const customSlides = parsePreviewImages(settings.preview_image_url);
  const bannerImages = customSlides;
  const slideCount = bannerImages.length;

  const [activeSlide, setActiveSlide] = useState(0);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDraggingSlide, setIsDraggingSlide] = useState(false);
  const swipeStartRef = useRef<{ active: boolean; startX: number }>({
    active: false,
    startX: 0,
  });

  const safeSlideIndex = slideCount > 0 ? activeSlide % slideCount : 0;

  // Auto-slide every 4.5 seconds (4-5s) when there are multiple images and user is not actively dragging
  useEffect(() => {
    if (slideCount <= 1 || isDraggingSlide) return;
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slideCount);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [slideCount, isDraggingSlide, safeSlideIndex]);

  const handleBannerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (slideCount <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    swipeStartRef.current = { active: true, startX: e.clientX };
    setIsDraggingSlide(true);
    setDragOffsetX(0);
  };

  const handleBannerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeStartRef.current.active || slideCount <= 1) return;
    setDragOffsetX(e.clientX - swipeStartRef.current.startX);
  };

  const handleBannerPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeStartRef.current.active) return;
    swipeStartRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    const delta = dragOffsetX;
    setDragOffsetX(0);
    setIsDraggingSlide(false);
    if (slideCount > 1) {
      if (delta < -35) {
        setActiveSlide((prev) => (prev + 1) % slideCount);
      } else if (delta > 35) {
        setActiveSlide((prev) => (prev - 1 + slideCount) % slideCount);
      }
    }
  };

  const handleOpenMenu = (
    path: string,
    permKey?: keyof typeof settings.permissions,
    label?: string
  ) => {
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
    navigate(path);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="space-y-3.5 pb-24 select-none">
      {/* Preview Banner — Auto-slides when user has custom images, or clean header card when empty */}
      {slideCount === 0 ? (
        <div className="w-full h-36 sm:h-44 md:h-52 shrink-0 rounded-2xl overflow-hidden shadow-2xs border border-sky-100/90 bg-gradient-to-br from-white via-sky-50/60 to-sky-100/40 p-4 sm:p-6 flex flex-col justify-between relative select-none">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-lg border border-sky-200/60">
              {settings.site_name || 'BOILER CHEMICAL'}
            </span>
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
              {settings.department_name || 'แผนกบอยเลอร์'}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
              ระบบคำนวณและบันทึกสารเคมีประจำวัน
            </p>
          </div>
        </div>
      ) : (
        <div
          onPointerDown={handleBannerPointerDown}
          onPointerMove={handleBannerPointerMove}
          onPointerUp={handleBannerPointerEnd}
          onPointerCancel={handleBannerPointerEnd}
          className={`w-full h-36 sm:h-44 md:h-52 shrink-0 rounded-2xl overflow-hidden shadow-xs border border-slate-200 bg-slate-900 relative select-none touch-pan-y ${
            slideCount > 1 ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
        >
          <div
            className={`flex w-full h-full ${
              isDraggingSlide ? '' : 'transition-transform duration-500 ease-out'
            }`}
            style={{
              transform: `translate3d(calc(-${safeSlideIndex * 100}% + ${dragOffsetX}px), 0, 0)`,
            }}
          >
            {bannerImages.map((imgSrc, idx) => (
              <div key={idx} className="w-full h-full shrink-0">
                <img
                  src={imgSrc}
                  alt={`Boiler Chemical Preview ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className="w-full h-full object-cover object-center pointer-events-none select-none"
                />
              </div>
            ))}
          </div>

          {slideCount > 1 && (
            <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1.5 z-10">
              {bannerImages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`ภาพพรีวิวที่ ${idx + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === safeSlideIndex
                      ? 'w-5 bg-white shadow-xs'
                      : 'w-1.5 bg-white/55 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section Title: "เมนู" */}
      <div className="px-1 pt-0.5 shrink-0">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">เมนู</h2>
      </div>

      {/* Responsive Menu Grid (2 cols on mobile, 4 cols on tablet/PC) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 select-none shrink-0" onContextMenu={(e) => e.preventDefault()}>
        {/* 1. คำนวณ */}
        <button
          type="button"
          onClick={() => handleOpenMenu('/calculation', 'allow_calculate', 'การคำนวณ')}
          onContextMenu={(e) => e.preventDefault()}
          className="group relative min-h-[120px] sm:min-h-[136px] p-3.5 sm:p-4 rounded-3xl border border-sky-100/90 dark:border-slate-800 bg-gradient-to-br from-white via-white to-sky-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 hover:to-sky-100/50 dark:hover:to-slate-800 hover:border-sky-300 dark:hover:border-slate-700 active:border-sky-400 active:bg-sky-100/60 dark:active:bg-slate-800 active:ring-2 active:ring-sky-200/80 active:scale-[0.98] shadow-2xs hover:shadow-md hover:shadow-sky-100/60 dark:hover:shadow-black/40 transition-all duration-150 flex flex-col items-start justify-between text-left cursor-pointer touch-manipulation select-none overflow-hidden"
        >
          {/* Top highlight specular sheen & soft light-blue glow */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-sky-300/60 dark:via-sky-500/40 to-transparent pointer-events-none" />
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-sky-200/35 dark:bg-sky-900/25 rounded-full blur-xl pointer-events-none group-hover:bg-sky-300/40 transition-colors" />

          {/* Thematic Watermark Silhouette Icon (ลายเงาเครื่องคิดเลข) */}
          <Calculator className="absolute -bottom-2 -right-2 w-20 h-20 sm:w-24 sm:h-24 text-sky-600/[0.07] dark:text-sky-400/[0.08] group-hover:text-sky-600/[0.12] transition-colors pointer-events-none transform -rotate-12 z-0" />

          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100/80 dark:from-slate-800 dark:to-slate-700 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-slate-600 shadow-2xs flex items-center justify-center group-hover:from-sky-600 group-hover:to-sky-700 group-hover:text-white group-active:from-sky-600 group-active:to-sky-700 group-active:text-white transition-all pointer-events-none z-10">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="w-full pt-2 pointer-events-none relative z-10">
            <strong className="block text-base font-extrabold text-slate-900 dark:text-slate-100 group-active:text-sky-700 dark:group-active:text-sky-300 transition-colors">คำนวณ</strong>
            <small className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              คำนวณและบันทึกสารเคมี
            </small>
          </div>
          <ChevronRight className="w-4 h-4 text-sky-300 dark:text-slate-600 group-hover:text-sky-500 dark:group-hover:text-sky-400 group-active:text-sky-600 absolute right-4 bottom-4 group-hover:translate-x-0.5 group-active:translate-x-1 transition-all pointer-events-none z-10" />
        </button>

        {/* 2. ประวัติ */}
        <button
          type="button"
          onClick={() => handleOpenMenu('/history', 'allow_history_view', 'การดูประวัติ')}
          onContextMenu={(e) => e.preventDefault()}
          className="group relative min-h-[120px] sm:min-h-[136px] p-3.5 sm:p-4 rounded-3xl border border-sky-100/90 dark:border-slate-800 bg-gradient-to-br from-white via-white to-sky-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 hover:to-sky-100/50 dark:hover:to-slate-800 hover:border-sky-300 dark:hover:border-slate-700 active:border-sky-400 active:bg-sky-100/60 dark:active:bg-slate-800 active:ring-2 active:ring-sky-200/80 active:scale-[0.98] shadow-2xs hover:shadow-md hover:shadow-sky-100/60 dark:hover:shadow-black/40 transition-all duration-150 flex flex-col items-start justify-between text-left cursor-pointer touch-manipulation select-none overflow-hidden"
        >
          {/* Top highlight specular sheen & soft light-blue glow */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-sky-300/60 dark:via-sky-500/40 to-transparent pointer-events-none" />
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-sky-200/35 dark:bg-sky-900/25 rounded-full blur-xl pointer-events-none group-hover:bg-sky-300/40 transition-colors" />

          {/* Thematic Watermark Silhouette Icon (ลายเงานาฬิกาประวัติ) */}
          <History className="absolute -bottom-2 -right-2 w-20 h-20 sm:w-24 sm:h-24 text-sky-600/[0.07] dark:text-sky-400/[0.08] group-hover:text-sky-600/[0.12] transition-colors pointer-events-none transform -rotate-12 z-0" />

          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100/80 dark:from-slate-800 dark:to-slate-700 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-slate-600 shadow-2xs flex items-center justify-center group-hover:from-sky-600 group-hover:to-sky-700 group-hover:text-white group-active:from-sky-600 group-active:to-sky-700 group-active:text-white transition-all pointer-events-none z-10">
            <History className="w-5 h-5" />
            {isHomeScreenApp && hasUnreadHistory && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </div>
          <div className="w-full pt-2 pointer-events-none relative z-10">
            <strong className="block text-base font-extrabold text-slate-900 dark:text-slate-100 group-active:text-sky-700 dark:group-active:text-sky-300 transition-colors">ประวัติ</strong>
            <small className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              ดูรายการที่บันทึกไว้
            </small>
          </div>
          <ChevronRight className="w-4 h-4 text-sky-300 dark:text-slate-600 group-hover:text-sky-500 dark:group-hover:text-sky-400 group-active:text-sky-600 absolute right-4 bottom-4 group-hover:translate-x-0.5 group-active:translate-x-1 transition-all pointer-events-none z-10" />
        </button>

        {/* 3. สารเคมี */}
        <button
          type="button"
          onClick={() => handleOpenMenu('/chemicals', 'allow_chemical_info', 'ข้อมูลสารเคมี')}
          onContextMenu={(e) => e.preventDefault()}
          className="group relative min-h-[120px] sm:min-h-[136px] p-3.5 sm:p-4 rounded-3xl border border-sky-100/90 dark:border-slate-800 bg-gradient-to-br from-white via-white to-sky-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 hover:to-sky-100/50 dark:hover:to-slate-800 hover:border-sky-300 dark:hover:border-slate-700 active:border-sky-400 active:bg-sky-100/60 dark:active:bg-slate-800 active:ring-2 active:ring-sky-200/80 active:scale-[0.98] shadow-2xs hover:shadow-md hover:shadow-sky-100/60 dark:hover:shadow-black/40 transition-all duration-150 flex flex-col items-start justify-between text-left cursor-pointer touch-manipulation select-none overflow-hidden"
        >
          {/* Top highlight specular sheen & soft light-blue glow */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-sky-300/60 dark:via-sky-500/40 to-transparent pointer-events-none" />
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-sky-200/35 dark:bg-sky-900/25 rounded-full blur-xl pointer-events-none group-hover:bg-sky-300/40 transition-colors" />

          {/* Thematic Watermark Silhouette Icon (ลายเงาขวดทดลองสารเคมี) */}
          <FlaskConical className="absolute -bottom-2 -right-2 w-20 h-20 sm:w-24 sm:h-24 text-sky-600/[0.07] dark:text-sky-400/[0.08] group-hover:text-sky-600/[0.12] transition-colors pointer-events-none transform -rotate-12 z-0" />

          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100/80 dark:from-slate-800 dark:to-slate-700 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-slate-600 shadow-2xs flex items-center justify-center group-hover:from-sky-600 group-hover:to-sky-700 group-hover:text-white group-active:from-sky-600 group-active:to-sky-700 group-active:text-white transition-all pointer-events-none z-10">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div className="w-full pt-2 pointer-events-none relative z-10">
            <strong className="block text-base font-extrabold text-slate-900 dark:text-slate-100 group-active:text-sky-700 dark:group-active:text-sky-300 transition-colors">สารเคมี</strong>
            <small className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              ข้อมูลและคุณสมบัติ
            </small>
          </div>
          <ChevronRight className="w-4 h-4 text-sky-300 dark:text-slate-600 group-hover:text-sky-500 dark:group-hover:text-sky-400 group-active:text-sky-600 absolute right-4 bottom-4 group-hover:translate-x-0.5 group-active:translate-x-1 transition-all pointer-events-none z-10" />
        </button>

        {/* 4. การตั้งค่า */}
        <button
          type="button"
          onClick={() => handleOpenMenu('/settings')}
          onContextMenu={(e) => e.preventDefault()}
          className="group relative min-h-[120px] sm:min-h-[136px] p-3.5 sm:p-4 rounded-3xl border border-sky-100/90 dark:border-slate-800 bg-gradient-to-br from-white via-white to-sky-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 hover:to-sky-100/50 dark:hover:to-slate-800 hover:border-sky-300 dark:hover:border-slate-700 active:border-sky-400 active:bg-sky-100/60 dark:active:bg-slate-800 active:ring-2 active:ring-sky-200/80 active:scale-[0.98] shadow-2xs hover:shadow-md hover:shadow-sky-100/60 dark:hover:shadow-black/40 transition-all duration-150 flex flex-col items-start justify-between text-left cursor-pointer touch-manipulation select-none overflow-hidden"
        >
          {/* Top highlight specular sheen & soft light-blue glow */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-sky-300/60 dark:via-sky-500/40 to-transparent pointer-events-none" />
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-sky-200/35 dark:bg-sky-900/25 rounded-full blur-xl pointer-events-none group-hover:bg-sky-300/40 transition-colors" />

          {/* Thematic Watermark Silhouette Icon (ลายเงาฟันเฟืองระบบ) */}
          <Settings className="absolute -bottom-2 -right-2 w-20 h-20 sm:w-24 sm:h-24 text-sky-600/[0.07] dark:text-sky-400/[0.08] group-hover:text-sky-600/[0.12] transition-colors pointer-events-none transform rotate-12 z-0" />

          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100/80 dark:from-slate-800 dark:to-slate-700 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-slate-600 shadow-2xs flex items-center justify-center group-hover:from-sky-600 group-hover:to-sky-700 group-hover:text-white group-active:from-sky-600 group-active:to-sky-700 group-active:text-white transition-all pointer-events-none z-10">
            <Settings className="w-5 h-5" />
          </div>
          <div className="w-full pt-2 pointer-events-none relative z-10">
            <strong className="block text-base font-extrabold text-slate-900 dark:text-slate-100 group-active:text-sky-700 dark:group-active:text-sky-300 transition-colors">การตั้งค่า</strong>
            <small className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              จัดการระบบและ Admin
            </small>
          </div>
          <ChevronRight className="w-4 h-4 text-sky-300 dark:text-slate-600 group-hover:text-sky-500 dark:group-hover:text-sky-400 group-active:text-sky-600 absolute right-4 bottom-4 group-hover:translate-x-0.5 group-active:translate-x-1 transition-all pointer-events-none z-10" />
        </button>
      </div>
    </div>
  );
};
