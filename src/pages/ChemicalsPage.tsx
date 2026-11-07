import React, { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  FlaskConical,
  CheckCircle2,
  Cpu,
  Gauge,
  Droplets,
  Calculator,
} from 'lucide-react';
import { useBoiler } from '../context/BoilerContext';
import { CHEMICAL_KNOWLEDGE_BASE, ChemicalKnowledgeCard } from '../types/boiler';

let paperAudioCtx: AudioContext | null = null;

function playPaperTurnSound(direction: number): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!paperAudioCtx) {
      paperAudioCtx = new AudioCtx();
    }
    const ctx = paperAudioCtx;

    const triggerPaperSound = () => {
      const now = ctx.currentTime;
      const duration = 0.28;
      const sampleRate = ctx.sampleRate;
      const frameCount = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);

      // Generate textured pink-ish noise for realistic paper fiber friction
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < frameCount; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        const t = i / frameCount;
        // Envelope: crisp paper lift -> airy flip swoosh -> soft page settle
        const env =
          Math.pow(Math.sin(Math.PI * t), 1.35) *
          (1 - 0.35 * t) *
          (1 + 0.18 * Math.sin(t * 28));
        data[i] = (b0 + b1 + b2 + white * 0.18) * env * 0.9;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;

      // Formant bandpass filter sweeping like a bending paper sheet
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.Q.setValueAtTime(1.8, now);
      if (direction >= 0) {
        bandpass.frequency.setValueAtTime(520, now);
        bandpass.frequency.exponentialRampToValueAtTime(2200, now + 0.11);
        bandpass.frequency.exponentialRampToValueAtTime(780, now + duration);
      } else {
        bandpass.frequency.setValueAtTime(680, now);
        bandpass.frequency.exponentialRampToValueAtTime(1950, now + 0.1);
        bandpass.frequency.exponentialRampToValueAtTime(620, now + duration);
      }

      // High-shelf crispness for paper edge rustle
      const highShelf = ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.setValueAtTime(2800, now);
      highShelf.gain.setValueAtTime(4.5, now);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.linearRampToValueAtTime(0.38, now + 0.025);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(bandpass);
      bandpass.connect(highShelf);
      highShelf.connect(masterGain);
      masterGain.connect(ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + duration);
    };

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(triggerPaperSound)
        .catch(() => {});
    } else {
      triggerPaperSound();
    }
  } catch (_e) {
    // Ignore if browser blocks audio
  }
}

export const ChemicalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { chemicals } = useBoiler();

  // Build notebook pages directly from active chemicals so adding/deleting/updating in Admin is reflected immediately
  const bookPages = useMemo<ChemicalKnowledgeCard[]>(() => {
    const activeChems = chemicals.filter((c) => c.active);
    const sourceList = activeChems.length > 0 ? activeChems : CHEMICAL_KNOWLEDGE_BASE;

    return sourceList.map((c) => {
      const kbMatch = CHEMICAL_KNOWLEDGE_BASE.find(
        (k) => k.name.toLowerCase() === c.name.toLowerCase()
      );
      if (kbMatch) {
        return {
          ...kbMatch,
          name: c.name,
          divisor: c.divisor,
          unit: c.unit || kbMatch.unit || 'L',
          badge: `ตัวหาร ÷ ${c.divisor}`,
          specs: {
            ...kbMatch.specs,
            formulaText: `(ค่าล่าสุด - ค่าปัจจุบัน) ÷ ${c.divisor}`,
          },
        };
      }
      const desc = 'description' in c && c.description ? c.description : '';
      return {
        name: c.name,
        code: c.code || c.name,
        divisor: c.divisor,
        unit: c.unit || 'L',
        badge: `ตัวหาร ÷ ${c.divisor}`,
        summary:
          desc ||
          `สารเคมีบำบัดน้ำหม้อต้มไอน้ำ (${c.name}) คำนวณปริมาณโดยหารด้วย ${c.divisor}`,
        specs: {
          category: 'Boiler Water Treatment Chemical (สารเคมีบำบัดน้ำหม้อไอน้ำ)',
          appearance: `สารละลายเคมีเหลว (หน่วยวัด ${c.unit || 'L'})`,
          controlTarget: 'ควบคุมคุณภาพน้ำป้อนและน้ำในหม้อต้มตามเกณฑ์มาตรฐาน',
          dosingMethod: `เติมตามปริมาณที่คำนวณได้จากระดับถังเคมีหารด้วย ${c.divisor}`,
          formulaText: `(ค่าล่าสุด - ค่าปัจจุบัน) ÷ ${c.divisor}`,
        },
        topics: [
          {
            title: 'อัตราส่วนและสูตรการคำนวณมาตรฐาน',
            body: `นำผลต่างของระดับน้ำยาล่าสุดและระดับน้ำยาปัจจุบัน มาหารด้วย ${c.divisor} เพื่อหาปริมาณการใช้งานจริงในหน่วย ${c.unit || 'L'}`,
          },
          {
            title: 'การควบคุมคุณภาพน้ำในหม้อต้ม (Boiler Water Control)',
            body: 'ช่วยรักษาคุณภาพน้ำในระบบบอยเลอร์ให้คงที่ ลดความเสี่ยงการเกิดตะกรันและการกัดกร่อนในท่อไอน้ำ',
          },
        ],
      };
    });
  }, [chemicals]);

  const [[pageIndex, direction], setPage] = useState<[number, number]>([0, 0]);
  const [innerTab, setInnerTab] = useState<'PROPERTIES' | 'TECHNICAL'>('PROPERTIES');

  const currentPage = bookPages[pageIndex] || bookPages[0];

  const turnPage = (newDirection: number) => {
    const nextIndex = pageIndex + newDirection;
    if (nextIndex < 0 || nextIndex >= bookPages.length) return;
    playPaperTurnSound(newDirection);
    setPage([nextIndex, newDirection]);
  };

  const selectDirectPage = (targetIndex: number) => {
    if (targetIndex === pageIndex) return;
    const dir = targetIndex > pageIndex ? 1 : -1;
    playPaperTurnSound(dir);
    setPage([targetIndex, dir]);
  };

  // Horizontal touch swipe to flip notebook pages smoothly without needing buttons
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartXRef.current;
    const diffY = e.changedTouches[0].clientY - touchStartYRef.current;
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0 && pageIndex < bookPages.length - 1) {
        turnPage(1);
      } else if (diffX > 0 && pageIndex > 0) {
        turnPage(-1);
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // True 3D notebook page flip hinged on the left spiral spine (transformOrigin: '0% 50%')
  const pageSheetVariants = {
    enter: (dir: number) =>
      dir >= 0
        ? {
            rotateY: 18,
            rotateZ: 0.6,
            scale: 0.985,
            opacity: 0.6,
            zIndex: 1,
            boxShadow: 'inset 28px 0 36px -12px rgba(2, 132, 199, 0.18)',
          }
        : {
            rotateY: -115,
            rotateZ: -1.8,
            scale: 1.01,
            opacity: 0.95,
            zIndex: 15,
            boxShadow: '26px 0 42px rgba(15, 23, 42, 0.22)',
          },
    center: {
      rotateY: 0,
      rotateZ: 0,
      scale: 1,
      opacity: 1,
      zIndex: 10,
      boxShadow: '0 0 0 rgba(15, 23, 42, 0)',
    },
    exit: (dir: number) =>
      dir >= 0
        ? {
            rotateY: -118,
            rotateZ: -1.8,
            scale: 1.01,
            opacity: 0,
            zIndex: 15,
            boxShadow: '28px 0 48px rgba(15, 23, 42, 0.25)',
          }
        : {
            rotateY: 14,
            rotateZ: 0.5,
            scale: 0.985,
            opacity: 0,
            zIndex: 1,
            boxShadow: 'inset 28px 0 36px -12px rgba(2, 132, 199, 0.18)',
          },
  };

  return (
    <div className="space-y-4 pb-28 select-none">
      {/* Top Bar: ล็อกตายตัวอยู่ด้านบน 100% นิ่งสนิท พื้นหลังทึบ ไม่เลื่อนตาม */}
      <div className="sticky top-0 z-35 -mx-4 px-4 py-2.5 bg-[#f8f9fb]/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-sky-100/90 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="กลับหน้าหลัก"
            className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-sky-100/90 dark:border-slate-800 text-sky-700 dark:text-sky-400 hover:bg-sky-50/70 dark:hover:bg-slate-800 hover:border-sky-300 active:bg-sky-100 active:border-sky-400 active:scale-95 flex items-center justify-center text-xl font-bold shadow-2xs transition-all cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">คุณสมบัติสารเคมี</h2>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-400">
              แตะเลือกสารเคมี หรือปัดซ้าย-ขวาเพื่อเปิดหน้าสมุด
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-xl bg-sky-50 dark:bg-slate-800/80 border border-sky-100/90 dark:border-slate-700 text-sky-700 dark:text-sky-300 text-xs font-extrabold shrink-0">
          หน้า {pageIndex + 1} / {bookPages.length}
        </span>
      </div>

      {/* Chemical Bookmark Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-2.5 px-1 -mx-1 no-scrollbar">
        {bookPages.map((chem, idx) => {
          const isSelected = idx === pageIndex;
          return (
            <button
              key={chem.code + idx}
              type="button"
              onClick={() => selectDirectPage(idx)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                isSelected
                  ? 'bg-sky-600 text-white border border-sky-600 shadow-md shadow-sky-500/25 ring-2 ring-sky-300/40 dark:ring-sky-500/40'
                  : 'bg-white dark:bg-slate-900 border border-sky-100/90 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-sky-50/60 dark:hover:bg-slate-800 hover:border-sky-300 active:bg-sky-100/80 active:border-sky-400 active:scale-95'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>{chem.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-sky-50 dark:bg-slate-800 text-sky-700 dark:text-sky-300'
                }`}
              >
                ÷{chem.divisor}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3D Interactive Notebook / Flipbook Stage (Touch swipe left/right enabled) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative touch-pan-y isolate z-10"
      >
        {/* Layered Book Pages Underneath */}
        <div className="absolute inset-x-2.5 -bottom-2.5 h-full rounded-[28px] bg-sky-100/60 dark:bg-slate-800/60 border border-sky-200/60 dark:border-slate-700/60 -z-10" />
        <div className="absolute inset-x-1 -bottom-1.5 h-full rounded-[28px] bg-sky-50/90 dark:bg-slate-800/90 border border-sky-100 dark:border-slate-700 -z-10" />

        <div className="relative rounded-[28px] bg-white dark:bg-slate-900 border border-sky-100/90 dark:border-slate-800 hover:border-sky-200 dark:hover:border-slate-700 active:border-sky-300 shadow-xl overflow-hidden flex min-h-[470px]">
          {/* Fixed Left Notebook Spiral Rings & Spine Shadow */}
          <div className="w-9 sm:w-11 bg-gradient-to-r from-sky-100 via-sky-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 border-r border-sky-200/80 dark:border-slate-800 flex flex-col items-center justify-evenly py-6 shrink-0 select-none z-20">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((ring) => (
              <div key={ring} className="flex items-center">
                <div className="w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-sky-300 dark:border-sky-600 shadow-inner" />
                <div className="w-2.5 h-1 bg-sky-400 dark:bg-sky-500 -ml-1 rounded-r-full" />
              </div>
            ))}
          </div>

          {/* 3D Hinged Paper Sheet Container */}
          <div
            className="relative flex-1 flex overflow-hidden bg-[#f8fafc] dark:bg-slate-950"
            style={{ perspective: '1800px' }}
          >
            <AnimatePresence initial={false} mode="popLayout" custom={direction}>
              <motion.div
                key={pageIndex}
                custom={direction}
                variants={pageSheetVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  duration: 0.48,
                  ease: [0.22, 1, 0.36, 1],
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_e, info) => {
                  if (info.offset.x < -35 && pageIndex < bookPages.length - 1) {
                    turnPage(1);
                  } else if (info.offset.x > 35 && pageIndex > 0) {
                    turnPage(-1);
                  }
                }}
                style={{
                  transformOrigin: '0% 50%',
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                }}
                className="w-full flex-1 p-4 sm:p-5 flex flex-col justify-between bg-white dark:bg-slate-900 bg-[linear-gradient(to_bottom,transparent_31px,#f0f9ff_32px)] dark:bg-[linear-gradient(to_bottom,transparent_31px,#1e293b_32px)] bg-[size:100%_32px] cursor-grab active:cursor-grabbing relative"
              >
                {/* Subtle Spine Crease & Page Curl Highlight */}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-sky-900/[0.06] via-sky-900/[0.02] to-transparent dark:from-black/20" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-sky-900/[0.04] to-transparent dark:from-black/15" />
              <div>
                {/* Notebook Page Top Header */}
                <div className="flex items-start justify-between gap-2 border-b-2 border-sky-500/20 dark:border-sky-500/30 pb-3 mb-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>NOTEBOOK PAGE 0{pageIndex + 1}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                      {currentPage.name}
                    </h3>
                  </div>

                  <span className="px-3 py-1 rounded-xl bg-sky-600 text-white text-xs font-black shadow-2xs shrink-0">
                    {currentPage.badge}
                  </span>
                </div>

                {/* Inner Sub-View Toggle: คุณสมบัติหลัก vs ข้อมูลทางเทคนิค */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-sky-50 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-700 mb-3.5">
                  <button
                    type="button"
                    onClick={() => setInnerTab('PROPERTIES')}
                    className={`py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                      innerTab === 'PROPERTIES'
                        ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-300'
                    }`}
                  >
                    คุณสมบัติและการทำงาน
                  </button>
                  <button
                    type="button"
                    onClick={() => setInnerTab('TECHNICAL')}
                    className={`py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                      innerTab === 'TECHNICAL'
                        ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-300'
                    }`}
                  >
                    ข้อมูลทางเทคนิค & สูตร
                  </button>
                </div>

                {innerTab === 'PROPERTIES' ? (
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-sky-900 dark:text-sky-200 bg-sky-50/90 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/50 rounded-2xl p-3">
                      {currentPage.summary}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {currentPage.topics.map((topic, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-white/95 dark:bg-slate-800/80 border border-sky-100 dark:border-slate-700 shadow-2xs space-y-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                            <strong className="text-xs font-extrabold text-slate-900 dark:text-white">
                              {topic.title}
                            </strong>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed pl-5">
                            {topic.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-xs md:col-span-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-100 uppercase tracking-wider">
                        <Calculator className="w-3.5 h-3.5" />
                        <span>สูตรคำนวณมาตรฐานประจำกะ</span>
                      </div>
                      <p className="text-sm font-black mt-1">
                        {currentPage.specs.formulaText}
                      </p>
                      <p className="text-[11px] text-sky-100 mt-0.5">
                        หน่วยวัดผลลัพธ์: ปริมาณน้ำยาที่ใช้จริง ({currentPage.unit})
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/95 dark:bg-slate-800/80 border border-sky-100 dark:border-slate-700 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        <Cpu className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        <span>ประเภทสารเคมี (Classification)</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 pl-5">
                        {currentPage.specs.category}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/95 dark:bg-slate-800/80 border border-sky-100 dark:border-slate-700 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        <Gauge className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        <span>เป้าหมายการควบคุม (Control Target)</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 pl-5">
                        {currentPage.specs.controlTarget}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/95 dark:bg-slate-800/80 border border-sky-100 dark:border-slate-700 space-y-1 md:col-span-2">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        <Droplets className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        <span>ลักษณะทางกายภาพและการจ่ายยา</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 pl-5">
                        {currentPage.specs.appearance} • {currentPage.specs.dosingMethod}
                      </p>
                    </div>
                  </div>
                )}
              </div>

                {/* Bottom Notebook Page Footer */}
                <div className="mt-4 pt-3 border-t border-sky-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
                  <span>ปัดซ้าย-ขวาเพื่อเปิดหน้ากระดาษ</span>
                  <span className="text-sky-600 dark:text-sky-400 font-bold">
                    หน้า {pageIndex + 1} / {bookPages.length}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Subtle indicator dots */}
      <div className="flex justify-center items-center gap-1.5 py-1 select-none">
        {bookPages.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => selectDirectPage(idx)}
            aria-label={`ไปหน้าที่ ${idx + 1}`}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              idx === pageIndex ? 'w-5 bg-sky-600' : 'w-1.5 bg-sky-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
