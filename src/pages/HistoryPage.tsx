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
    <div className="flex flex-col h-[calc(100dvh-8rem)] -mx-4 -mt-4 px-4 overflow-hidden">
      {/* Top Bar: ล็อกตายตัวอยู่ด้านบน 100% นิ่งสนิท พื้นหลังทึบ ไม่เลื่อนตาม */}
      <div className="shrink-0 pt-3 pb-3 bg-[#f8f9fb] border-b border-sky-100/90 z-20 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="กลับหน้าหลัก"
          className="w-10 h-10 rounded-2xl bg-white border border-sky-100/90 text-sky-700 hover:bg-sky-50/70 hover:border-sky-300 active:bg-sky-100 active:border-sky-400 active:scale-95 flex items-center justify-center text-xl font-bold shadow-2xs transition-all cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">ประวัติทั้งหมด</h2>
          <p className="text-[11px] font-semibold text-slate-400">รายการบันทึกการคำนวณสารเคมี</p>
        </div>
      </div>

      {/* Scrollable Content Area: เลื่อนสไลด์เฉพาะส่วนนี้เท่านั้น! */}
      <div
        className="flex-1 overflow-y-auto space-y-4 pt-3 pb-20 no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
      >

      {/* History List View */}
      {history.length === 0 ? (
        <div className="rounded-3xl border border-sky-100/90 bg-white py-16 px-6 text-center shadow-2xs">
          <p className="text-sm font-medium text-slate-400 tracking-wide select-none">ไม่มี</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {history.map((item) => {
            const canDelete = adminUnlocked || settings.permissions.allow_history_delete;
            return (
              <div
                key={item.id}
                className="rounded-3xl border border-sky-100/90 bg-white hover:border-sky-200 active:border-sky-300 active:bg-sky-50/30 p-4 shadow-2xs space-y-2.5 transition-all"
              >
                <div className="flex items-center justify-between gap-2 border-b border-sky-100/80 pb-2">
                  <strong className="text-xs font-extrabold text-sky-700">
                    {item.boiler_name}
                  </strong>
                  <span className="text-[10px] font-semibold text-slate-400 font-mono-num">
                    {new Date(item.calculated_at).toLocaleString('th-TH-u-ca-gregory')}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {(item.details || []).map((d, idx) => {
                    const disp = formatDosageDisplay(d);
                    return (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs bg-sky-50/35 hover:bg-sky-50/70 active:bg-sky-100/60 px-3 py-2 rounded-xl border border-sky-100/90 transition-colors"
                      >
                        <span className="font-bold text-slate-700">{d.name}</span>
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            {disp.isRounded ? (
                              <>
                                <span className="text-slate-400 font-semibold text-[11px] font-mono-num">
                                  {disp.rawText}
                                </span>
                                <span className="text-sky-400 font-bold text-[11px]">➔</span>
                                <span className="px-1.5 py-0.2 rounded-md bg-sky-100 text-sky-800 font-black text-xs border border-sky-200 font-mono-num">
                                  {disp.roundedText} L
                                </span>
                              </>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 font-black text-xs border border-sky-200 font-mono-num">
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
                  <div className="px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-100 text-xs">
                    <span className="text-amber-700 font-bold">หมายเหตุ: </span>
                    <span className="text-slate-700 font-semibold break-words">
                      {item.note || item.details?.find((d) => d.note)?.note}
                    </span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleShareHistoryItem(item)}
                    className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 hover:bg-sky-100 active:bg-sky-200 active:scale-95 text-sky-700 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="แชร์ข้อมูลผลลัพธ์ (LINE/แชท)"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>แชร์</span>
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-100 hover:bg-rose-100 active:bg-rose-200 active:scale-95 text-rose-600 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
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
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-sky-100 shadow-2xl max-w-xs w-full p-5 text-center relative">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-900">ยืนยันการลบรายการ</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              ต้องการลบประวัติของ {deleteTarget.boiler_name} ใช่หรือไม่?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs"
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
