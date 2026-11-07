import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, X, Share2 } from 'lucide-react';
import { useBoiler } from '../context/BoilerContext';
import {
  CalculationHistoryRecord,
  formatDosageDisplay,
  formatCalculationShareText,
} from '../types/boiler';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    settings,
    history,
    deleteHistoryRecord,
    markHistoryRead,
    adminUnlocked,
    showToast,
  } = useBoiler();

  const [deleteTarget, setDeleteTarget] = useState<CalculationHistoryRecord | null>(null);

  useEffect(() => {
    markHistoryRead();
  }, [markHistoryRead]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteHistoryRecord(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleShareHistoryItem = async (item: CalculationHistoryRecord) => {
    const reportText = formatCalculationShareText(item);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'รายงานสารเคมีประจำวัน',
          text: reportText,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    // Fallback: Copy to clipboard
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(reportText);
        showToast('คัดลอกรายงานสำเร็จ', 'พร้อมส่งเข้า LINE หรือแอปแชทได้ทันที', 'success');
        return;
      }
    } catch (_e) {}

    showToast('รายงานสารเคมี', reportText, 'info');
  };

  return (
    <div className="space-y-4 pb-28 select-none">
      {/* Top Bar: ล็อกตายตัวอยู่ด้านบน 100% นิ่งสนิท พื้นหลังทึบ ไม่เลื่อนตาม */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2.5 bg-[#f8f9fb] dark:bg-slate-950 border-b border-sky-100/90 dark:border-slate-800 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="กลับหน้าหลัก"
          className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-sky-100/90 dark:border-slate-800 text-sky-700 dark:text-sky-400 hover:bg-sky-50/70 dark:hover:bg-slate-800 active:bg-sky-100 dark:active:bg-slate-750 active:scale-95 flex items-center justify-center text-xl font-bold shadow-2xs transition-all cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-tight">ประวัติทั้งหมด</h2>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">รายการบันทึกการคำนวณสารเคมี</p>
        </div>
      </div>

      {/* History List View */}
      {history.length === 0 ? (
        <div className="rounded-3xl border border-sky-100/90 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 px-6 text-center shadow-2xs">
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500 tracking-wide select-none">ไม่มี</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {history.map((item) => {
            const canDelete = adminUnlocked || settings.permissions.allow_history_delete;
            return (
              <div
                key={item.id}
                className="rounded-3xl border border-sky-100/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-200 dark:hover:border-slate-700 active:border-sky-300 active:bg-sky-50/30 p-4 shadow-2xs space-y-2.5 transition-all"
              >
                <div className="flex items-center justify-between gap-2 border-b border-sky-100/80 dark:border-slate-800 pb-2">
                  <strong className="text-xs font-extrabold text-sky-700 dark:text-sky-400">
                    {item.boiler_name}
                  </strong>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 font-mono-num">
                    {new Date(item.calculated_at).toLocaleString('th-TH-u-ca-gregory')}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {(item.details || []).map((d, idx) => {
                    const disp = formatDosageDisplay(d);
                    return (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs bg-sky-50/35 dark:bg-slate-800/60 hover:bg-sky-50/70 dark:hover:bg-slate-800 active:bg-sky-100/60 px-3 py-2 rounded-xl border border-sky-100/90 dark:border-slate-750 transition-colors"
                      >
                        <span className="font-bold text-slate-700 dark:text-slate-200">{d.name}</span>
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            {disp.isRounded ? (
                              <>
                                <span className="text-slate-400 font-semibold text-[11px] font-mono-num">
                                  {disp.rawText}
                                </span>
                                <span className="text-sky-400 font-bold text-[11px]">➔</span>
                                <span className="px-1.5 py-0.2 rounded-md bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 font-black text-xs border border-sky-200 dark:border-sky-800 font-mono-num">
                                  {disp.roundedText} L
                                </span>
                              </>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded-md bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 font-black text-xs border border-sky-200 dark:border-sky-800 font-mono-num">
                                {disp.roundedText} L
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400 text-[9px] font-bold block mt-0.5">
                            เหลือ {d.curr} L
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(item.note || item.details?.find((d) => d.note)?.note) && (
                  <div className="px-3 py-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 text-xs">
                    <span className="text-amber-700 dark:text-amber-400 font-bold">หมายเหตุ: </span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold break-words">
                      {item.note || item.details?.find((d) => d.note)?.note}
                    </span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleShareHistoryItem(item)}
                    className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-slate-800 border border-sky-200 dark:border-slate-700 hover:bg-sky-100 dark:hover:bg-slate-700 active:bg-sky-200 active:scale-95 text-sky-700 dark:text-sky-300 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="แชร์ข้อมูลผลลัพธ์ (LINE/แชท)"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>แชร์</span>
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 active:bg-rose-200 active:scale-95 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบ</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/50 dark:bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-sky-100 dark:border-slate-800 shadow-2xl max-w-xs w-full p-5 text-center relative">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">ยืนยันการลบรายการ</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              ต้องการลบประวัติของ {deleteTarget.boiler_name} ใช่หรือไม่?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
