import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Share2 } from 'lucide-react';
import { useBoiler } from '../context/BoilerContext';
import {
  CalculationDetailItem,
  CalculationHistoryRecord,
  roundPlantChemicalDosage,
  formatDosageDisplay,
  formatCalculationShareText,
} from '../types/boiler';

interface ChemInputPair {
  prev: string;
  curr: string;
}

export const CalculationPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    settings,
    boilers,
    chemicals,
    getLatestLevelForBoiler,
    submitCalculation,
    showToast,
  } = useBoiler();

  const activeBoilers = useMemo(() => boilers.filter((b) => b.active), [boilers]);
  const activeChemicals = useMemo(() => chemicals.filter((c) => c.active), [chemicals]);

  const [selectedBoilerName, setSelectedBoilerName] = useState<string>('');
  const [inputs, setInputs] = useState<Record<string, ChemInputPair>>({});
  const [note, setNote] = useState<string>('');
  const [touchedChems, setTouchedChems] = useState<Record<string, boolean>>({});
  const [resultModalRecord, setResultModalRecord] = useState<CalculationHistoryRecord | null>(null);
  const lastSelectedBoilerRef = useRef<string>('');

  // Auto-load "ล่าสุด (L)" only when selecting/changing Boiler, without resetting inputs on background sync
  useEffect(() => {
    const boilerChanged = lastSelectedBoilerRef.current !== selectedBoilerName;
    lastSelectedBoilerRef.current = selectedBoilerName;

    if (!selectedBoilerName) {
      if (boilerChanged) {
        setInputs({});
        setTouchedChems({});
      }
      return;
    }

    if (boilerChanged) {
      setTouchedChems({});
      const nextInputs: Record<string, ChemInputPair> = {};
      for (const chem of activeChemicals) {
        const latestCurr = getLatestLevelForBoiler(selectedBoilerName, chem.name);
        nextInputs[chem.id] = {
          prev: latestCurr !== null ? String(latestCurr) : '',
          curr: '',
        };
      }
      setInputs(nextInputs);
      return;
    }

    // Preserve all current user inputs during background polling/sync; only populate uninitialized fields
    setInputs((prevInputs) => {
      let changed = false;
      const merged: Record<string, ChemInputPair> = { ...prevInputs };
      for (const chem of activeChemicals) {
        const existing = merged[chem.id];
        if (!existing) {
          const latestCurr = getLatestLevelForBoiler(selectedBoilerName, chem.name);
          merged[chem.id] = {
            prev: latestCurr !== null ? String(latestCurr) : '',
            curr: '',
          };
          changed = true;
        } else if (
          !touchedChems[chem.id] &&
          existing.prev === '' &&
          existing.curr === ''
        ) {
          const latestCurr = getLatestLevelForBoiler(selectedBoilerName, chem.name);
          if (latestCurr !== null) {
            merged[chem.id] = {
              prev: String(latestCurr),
              curr: '',
            };
            changed = true;
          }
        }
      }
      return changed ? merged : prevInputs;
    });
  }, [selectedBoilerName, activeChemicals, getLatestLevelForBoiler, touchedChems]);

  const handleInputChange = (chemId: string, field: keyof ChemInputPair, value: string) => {
    setTouchedChems((prev) => ({ ...prev, [chemId]: true }));
    setInputs((prev) => ({
      ...prev,
      [chemId]: {
        ...(prev[chemId] || { prev: '', curr: '' }),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!settings.permissions.allow_calculate) {
      showToast('ฟังก์ชันถูกปิดไว้', 'ผู้ดูแลระบบปิดสิทธิ์การคำนวณไว้ใน Permission Center', 'error');
      return;
    }
    if (!settings.permissions.allow_save) {
      showToast('การบันทึกถูกปิดไว้', 'ผู้ดูแลระบบปิดสิทธิ์การบันทึกไว้ใน Permission Center', 'error');
      return;
    }
    if (!selectedBoilerName) {
      showToast('ยังไม่ได้เลือก Boiler', 'กรุณาเลือก Boiler ก่อนทำการคำนวณและบันทึกข้อมูล', 'error');
      return;
    }

    const details: CalculationDetailItem[] = [];
    for (const chem of activeChemicals) {
      const pair = inputs[chem.id] || { prev: '', curr: '' };
      const prevRaw = pair.prev.trim();
      const currRaw = pair.curr.trim();

      if (prevRaw === '' && currRaw === '') continue;

      if (prevRaw === '' && currRaw !== '') {
        showToast(
          'กรอกข้อมูลไม่ครบ',
          `กรุณากรอกค่า ${chem.name} ให้ครบทั้งช่อง ล่าสุด และ ปัจจุบัน`,
          'error'
        );
        return;
      }

      if (prevRaw !== '' && currRaw === '') {
        showToast(
          'กรอกข้อมูลไม่ครบ',
          `กรุณากรอกค่า ${chem.name} ช่อง ปัจจุบัน ด้วย`,
          'error'
        );
        return;
      }

      const prevNum = parseFloat(prevRaw);
      const currNum = parseFloat(currRaw);

      if (isNaN(prevNum) || isNaN(currNum)) {
        showToast(
          'ค่าตัวเลขไม่ถูกต้อง',
          `กรุณาระบุตัวเลขที่ถูกต้องสำหรับ ${chem.name}`,
          'error'
        );
        return;
      }

      if (prevNum < 0 || currNum < 0) {
        showToast(
          'ค่าตัวเลขไม่ถูกต้อง',
          `ค่าของ ${chem.name} ต้องไม่ติดลบ`,
          'error'
        );
        return;
      }

      if (currNum > prevNum) {
        showToast(
          'ข้อมูลผิดพลาด',
          `ค่าปัจจุบัน (${currNum}) ของ ${chem.name} ต้องไม่มากกว่าค่าล่าสุด (${prevNum})`,
          'error'
        );
        return;
      }

      const diff = prevNum - currNum;
      const divisor = chem.divisor || 1;
      const dosageRaw = diff / divisor;
      const dosageObj = roundPlantChemicalDosage(dosageRaw);

      details.push({
        name: chem.name,
        prev: prevNum,
        curr: currNum,
        divisor: chem.divisor,
        report: dosageObj.roundedText,
        raw_report: dosageObj.rawText,
        rounded_report: dosageObj.roundedText,
      });
    }

    if (details.length === 0) {
      showToast('ไม่มีข้อมูล', 'กรุณากรอกข้อมูลสารเคมีอย่างน้อย 1 รายการเพื่อคำนวณ', 'error');
      return;
    }

    const boilerRow = activeBoilers.find(
      (b) => b.name.replace(/\s+/g, '').toLowerCase() === selectedBoilerName.replace(/\s+/g, '').toLowerCase()
    );

    const cleanNote = note.trim();
    const response = await submitCalculation({
      boiler_id: boilerRow?.id || null,
      boiler_name: selectedBoilerName,
      recorder_name: 'แผนกบอยเลอร์',
      ...(cleanNote ? { note: cleanNote } : {}),
      details,
    });

    if (response.ok && response.record) {
      setResultModalRecord(response.record);
      setTouchedChems({});
      setNote('');
      const updatedInputs: Record<string, ChemInputPair> = {};
      for (const chem of activeChemicals) {
        const savedDetail = details.find((d) => d.name === chem.name);
        const fallbackLatest = getLatestLevelForBoiler(selectedBoilerName, chem.name);
        updatedInputs[chem.id] = {
          prev:
            savedDetail !== undefined
              ? String(savedDetail.curr)
              : fallbackLatest !== null
              ? String(fallbackLatest)
              : '',
          curr: '',
        };
      }
      setInputs(updatedInputs);
    }
  };

  const handleShareRecord = async (record: CalculationHistoryRecord) => {
    const reportText = formatCalculationShareText(record);
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
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-tight">คำนวณสารเคมี</h2>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">ระบบคำนวณและบันทึกสารเคมีประจำวัน</p>
        </div>
      </div>

      {/* กรอบที่ 1: เลือก Boiler (กล่องไฮไลท์ไล่เฉดขาว-ฟ้าอ่อน อยู่เดี่ยวๆ ด้านบนอย่างสบายตา) */}
      <div className="relative rounded-3xl border border-sky-100/90 dark:border-slate-800 bg-gradient-to-br from-white via-white to-sky-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-850 hover:to-sky-100/50 dark:hover:to-slate-800 hover:border-sky-300 dark:hover:border-slate-700 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-200/80 p-4 shadow-2xs hover:shadow-md hover:shadow-sky-100/60 dark:hover:shadow-black/40 transition-all duration-150 overflow-hidden">
        {/* Top highlight specular sheen & soft light-blue glow */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-sky-300/60 dark:via-sky-500/40 to-transparent pointer-events-none" />
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-sky-200/35 dark:bg-sky-900/25 rounded-full blur-xl pointer-events-none" />

        <label
          htmlFor="boilerSelect"
          className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-2 relative z-10"
        >
          📍 เลือก Boiler
        </label>
        <select
          id="boilerSelect"
          value={selectedBoilerName}
          onChange={(e) => setSelectedBoilerName(e.target.value)}
          className="relative z-10 w-full rounded-2xl border border-sky-100/90 dark:border-slate-700 bg-white/90 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 hover:border-sky-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-sky-200 focus:border-sky-400 active:bg-sky-50/70 outline-none shadow-2xs transition-all cursor-pointer"
        >
          <option value="">-- กรุณาเลือก --</option>
          {activeBoilers.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* กรอบที่ 2: รายการสารเคมี + ช่องหมายเหตุ รวมอยู่ในกรอบเดียวกันอย่างกระชับ ไม่กินพื้นที่ */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative rounded-3xl border border-sky-100/90 dark:border-slate-800 bg-gradient-to-br from-white via-white to-sky-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-850 hover:to-sky-100/50 dark:hover:to-slate-800 hover:border-sky-300 dark:hover:border-slate-700 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:shadow-sky-100/60 dark:hover:shadow-black/40 transition-all duration-150 overflow-hidden space-y-3.5">
          {/* Top highlight specular sheen & soft light-blue glow */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-sky-300/60 dark:via-sky-500/40 to-transparent pointer-events-none" />
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-sky-200/35 dark:bg-sky-900/25 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between relative z-10">
            <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
              🧪 รายการสารเคมี
            </label>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-lg border border-sky-100 dark:border-sky-800 font-bold">
              {activeChemicals.length} รายการ
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10">
            {activeChemicals.map((chem) => {
              const pair = inputs[chem.id] || { prev: '', curr: '' };
              const isDisabled = !selectedBoilerName;

              return (
                <div
                  key={chem.id}
                  className="relative flex flex-col justify-between bg-white/95 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-sky-300 dark:focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-sky-200/80 p-3.5 rounded-2xl border border-sky-100/90 dark:border-slate-800 shadow-2xs hover:shadow-sm transition-all overflow-hidden"
                >
                  {/* Subtle card top sheen */}
                  <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-sky-300/40 dark:via-sky-500/30 to-transparent pointer-events-none" />

                  <div className="flex justify-between items-center mb-2.5">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">{chem.name}</span>
                    <span className="text-[10px] text-sky-700 dark:text-sky-400 font-bold bg-sky-50 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-sky-200/80 dark:border-slate-700">
                      ÷ {chem.divisor}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1 ml-0.5">
                        ล่าสุด ({chem.unit || 'L'})
                      </label>
                      <input
                        type="number"
                        step="any"
                        disabled={isDisabled}
                        value={pair.prev}
                        onChange={(e) => handleInputChange(chem.id, 'prev', e.target.value)}
                        placeholder={isDisabled ? 'เลือก Boiler' : 'กรอกค่า'}
                        className="w-full rounded-xl border border-sky-100/90 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-bold hover:border-sky-200 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-sky-200 focus:border-sky-400 outline-none transition-all placeholder:font-normal disabled:bg-slate-50 dark:disabled:bg-slate-850 disabled:border-slate-200/70 dark:disabled:border-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-600 dark:text-slate-400 font-bold mb-1 ml-0.5">
                        ปัจจุบัน ({chem.unit || 'L'})
                      </label>
                      <input
                        type="number"
                        step="any"
                        disabled={isDisabled}
                        value={pair.curr}
                        onChange={(e) => handleInputChange(chem.id, 'curr', e.target.value)}
                        placeholder={isDisabled ? 'เลือก Boiler' : 'กรอกค่า'}
                        className="w-full rounded-xl border border-sky-100/90 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold hover:border-sky-200 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-sky-200 focus:border-sky-400 outline-none transition-all placeholder:font-normal disabled:bg-slate-50 dark:disabled:bg-slate-850 disabled:border-slate-200/70 dark:disabled:border-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ช่องหมายเหตุรวมอยู่ด้านในกรอบเดียวกับรายการสารเคมี */}
          <div className="pt-3 border-t border-sky-100/90 dark:border-slate-800 relative z-10">
            <label
              htmlFor="calculationNote"
              className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1.5"
            >
              📝 หมายเหตุ
            </label>
            <input
              id="calculationNote"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="(ถ้ามี)..."
              className="w-full rounded-2xl border border-sky-100/90 dark:border-slate-700 bg-white/95 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 hover:border-sky-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-sky-200 focus:border-sky-400 outline-none shadow-2xs transition-all placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 active:scale-[0.99] text-white font-extrabold text-sm shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>ดำเนินการ</span>
        </button>
      </form>

      {/* Result Modal */}
      {resultModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 dark:bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-5 relative">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mb-3">ผลการคำนวณสารเคมี</h3>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-750 p-3.5 text-xs">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2 mb-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Boiler:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{resultModalRecord.boiler_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">เวลา:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono-num">
                    {new Date(resultModalRecord.calculated_at).toLocaleString('th-TH-u-ca-gregory')}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 mt-2">
                {resultModalRecord.details.map((d, idx) => {
                  const disp = formatDosageDisplay(d);
                  return (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs"
                    >
                      <span className="font-bold text-slate-800 dark:text-slate-200">{d.name}</span>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          {disp.isRounded ? (
                            <>
                              <span className="text-slate-400 font-semibold text-xs font-mono-num">
                                {disp.rawText}
                              </span>
                              <span className="text-sky-400 font-bold text-xs">➔</span>
                              <span className="px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 font-black text-sm border border-sky-200 dark:border-sky-800 shadow-2xs font-mono-num">
                                {disp.roundedText} L
                              </span>
                            </>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 font-black text-sm border border-sky-200 dark:border-sky-800 shadow-2xs font-mono-num">
                              {disp.roundedText} L
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 text-[9px] uppercase tracking-wider block mt-0.5 font-bold">
                          เหลือ {d.curr} L
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(resultModalRecord.note || resultModalRecord.details?.find((d) => d.note)?.note) && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">หมายเหตุ: </span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold break-words">
                    {resultModalRecord.note || resultModalRecord.details?.find((d) => d.note)?.note}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={() => handleShareRecord(resultModalRecord)}
                className="py-3 rounded-2xl bg-sky-50 dark:bg-slate-800 border border-sky-200 dark:border-slate-700 hover:bg-sky-100 dark:hover:bg-slate-700 active:bg-sky-200 text-sky-700 dark:text-sky-300 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>แชร์</span>
              </button>
              <button
                type="button"
                onClick={() => setResultModalRecord(null)}
                className="py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
              >
                สำเร็จ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
