export interface BoilerOption {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export interface ChemicalConfig {
  id: string;
  code: string;
  name: string;
  divisor: number;
  unit: string;
  active: boolean;
  sort_order: number;
  description?: string;
}

export interface CalculationDetailItem {
  name: string;
  prev?: number;
  curr: number;
  divisor?: number;
  report: string; // The finalized rounded dosage recorded to sheets & tables (e.g. "3", "3.5", "4")
  raw_report?: string; // The raw unrounded dosage (e.g. "3.25", "3.50", "3.75")
  rounded_report?: string; // The rounded dosage (e.g. "3", "3.5", "4")
  note?: string;
}

/**
 * Plant On-Site Rounding Rule:
 * Fractions around .25 (<= 0.35) -> round down to whole number (e.g. 3.25 -> 3, 9.25 -> 9)
 * Fractions around .50 (0.35 - 0.65) -> keep as half .5 (e.g. 3.50 -> 3.5)
 * Fractions around .75 (>= 0.65) -> round up to next whole number (e.g. 3.75 -> 4)
 */
export function roundPlantChemicalDosage(rawVal: number): {
  raw: number;
  rounded: number;
  rawText: string;
  roundedText: string;
} {
  const raw = Math.max(0, Number(rawVal) || 0);
  const intPart = Math.floor(raw);
  const fraction = Math.round((raw - intPart) * 100) / 100;

  let roundedFraction = 0;
  if (fraction <= 0.35) {
    roundedFraction = 0;
  } else if (fraction < 0.65) {
    roundedFraction = 0.5;
  } else {
    roundedFraction = 1;
  }

  const rounded = intPart + roundedFraction;
  const rawText = raw.toFixed(2);
  const roundedText = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);

  return { raw, rounded, rawText, roundedText };
}

export function formatDosageDisplay(detail: {
  report: string;
  raw_report?: string;
  rounded_report?: string;
}): {
  rawText: string;
  roundedText: string;
  isRounded: boolean;
} {
  const rawNum = detail.raw_report ? Number(detail.raw_report) : Number(detail.report);

  if (Number.isFinite(rawNum)) {
    const r = roundPlantChemicalDosage(rawNum);
    // If it's an exact whole integer (e.g. 3), no arrow is needed
    const isWholeInteger = rawNum % 1 === 0;
    return {
      rawText: isWholeInteger ? r.roundedText : r.rawText,
      roundedText: r.roundedText,
      isRounded: !isWholeInteger,
    };
  }

  return {
    rawText: detail.report,
    roundedText: detail.report,
    isRounded: false,
  };
}

/**
 * Format calculation record into structured Thai text for LINE / chat sharing
 */
export function formatCalculationShareText(record: CalculationHistoryRecord): string {
  const dateObj = new Date(record.calculated_at);
  const daysOfWeek = [
    'วันอาทิตย์',
    'วันจันทร์',
    'วันอังคาร',
    'วันพุธ',
    'วันพฤหัสบดี',
    'วันศุกร์',
    'วันเสาร์',
  ];
  const dayName = daysOfWeek[dateObj.getDay()] || 'วันนี้';

  const dateFormatted = dateObj.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeFormatted = dateObj.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines: string[] = [];
  lines.push('📋 รายงานสารเคมีประจำวัน');
  lines.push(`📅 ${dayName} ที่ ${dateFormatted} (เวลา ${timeFormatted} น.)`);
  lines.push(`📍 หม้อน้ำ: ${record.boiler_name}`);
  lines.push('');
  lines.push('⚗️ ปริมาณสารเคมีที่ต้องเติม:');

  if (record.details && record.details.length > 0) {
    for (const d of record.details) {
      const disp = formatDosageDisplay(d);
      lines.push(`• ${d.name}: ${disp.roundedText} ลิตร (คงเหลือ ${d.curr} ลิตร)`);
    }
  }

  const noteText = record.note || record.details?.find((d) => d.note)?.note;
  if (noteText && noteText.trim()) {
    lines.push('');
    lines.push(`📝 หมายเหตุ: ${noteText.trim()}`);
  }

  return lines.join('\n');
}

export interface CalculationHistoryRecord {
  id: string;
  client_record_id: string;
  boiler_id: string | null;
  boiler_name: string;
  recorder_name: string;
  shift?: string;
  note?: string;
  calculated_at: string;
  details: CalculationDetailItem[];
  synced_supabase?: boolean;
}

export interface AppPermissions {
  allow_calculate: boolean;
  allow_save: boolean;
  allow_history_view: boolean;
  allow_history_delete: boolean;
  allow_share: boolean;
  allow_chemical_info: boolean;
  allow_sheet_sync?: boolean;
}

export interface AppSettings {
  site_name: string;
  app_version: string;
  developer_name: string;
  copyright_name: string;
  department_name: string;
  announcement: string;
  preview_image_url?: string;
  gas_webapp_url: string;
  db_mode: 'HYBRID_SUPABASE' | 'SUPABASE_ONLY' | 'LOCAL_GAS';
  permissions: AppPermissions;
  app_enabled?: boolean;
  bg_enabled?: boolean;
  bg_image_url?: string;
  bg_opacity?: number;
  pin_initialized?: boolean;
  pin_length?: number;
  facebook_url?: string;
  line_url?: string;
  updated_at: string;
}

export function parsePreviewImages(raw?: string): string[] {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      // Fallback to single image string
    }
  }
  return [trimmed];
}

export function serializePreviewImages(images: string[]): string {
  const clean = (images || []).map((img) => String(img || '').trim()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  return JSON.stringify(clean);
}

export interface AuditLogItem {
  id: string;
  action: string;
  details: string;
  created_at: string;
}

export interface ToastNotice {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export interface ChemicalTechnicalSpec {
  category: string;
  appearance: string;
  controlTarget: string;
  dosingMethod: string;
  formulaText: string;
}

export interface ChemicalKnowledgeCard {
  name: string;
  code: string;
  divisor: number;
  unit: string;
  badge: string;
  summary: string;
  specs: ChemicalTechnicalSpec;
  topics: Array<{
    title: string;
    body: string;
  }>;
}

export const CHEMICAL_KNOWLEDGE_BASE: ChemicalKnowledgeCard[] = [
  {
    name: 'PolyTreat-SRB',
    code: 'POLY-SRB',
    divisor: 4,
    unit: 'L',
    badge: 'ตัวหาร ÷ 4',
    summary: 'สารควบคุมแบคทีเรีย SRB ลดการกัดกร่อนจากจุลชีพ (MIC) และกำจัดกลิ่นในระบบน้ำบอยเลอร์',
    specs: {
      category: 'Microbiocide & Biofilm Control (สารควบคุมจุลชีพและเมือกแบคทีเรีย)',
      appearance: 'สารละลายเคมีเหลวความเข้มข้นสูง สำหรับระบบน้ำอุตสาหกรรม',
      controlTarget: 'ควบคุมเชื้อ Sulfate-Reducing Bacteria (SRB) ไม่ให้เกิดก๊าซ H₂S',
      dosingMethod: 'ฟีดเข้าสู่ระบบน้ำป้อนตามปริมาณที่คำนวณได้จากระดับถังเคมี',
      formulaText: '(ค่าล่าสุด - ค่าปัจจุบัน) ÷ 4',
    },
    topics: [
      {
        title: 'ทำลายและควบคุม SRB',
        body: 'ยับยั้งกลุ่มแบคทีเรียที่ไม่ใช้ออกซิเจน (Anaerobic Bacteria) ซึ่งเป็นต้นเหตุในการเปลี่ยนซัลเฟตให้กลายเป็นแก๊สไข่เน่า หรือไฮโดรเจนซัลไฟด์ (H₂S)',
      },
      {
        title: 'ลดการกัดกร่อนจากจุลชีพ (MIC)',
        body: 'ป้องกันการเกิดคราบเมือกและสนิมขุมกัดกร่อนลึกใต้ชั้นจุลินทรีย์ (Under-deposit corrosion) ซึ่งมักเกิดขึ้นในจุดที่น้ำไหลเวียนช้าหรือจุดอับในระบบท่อ',
      },
      {
        title: 'กำจัดกลิ่นเหม็น',
        body: 'ช่วยลดกลิ่นแก๊สไข่เน่าระเหยที่เกิดจากกระบวนการย่อยสลายของแบคทีเรีย',
      },
      {
        title: 'ช่วยเพิ่มประสิทธิภาพการถ่ายเทความร้อน',
        body: 'เมื่อไม่มีเมือกแบคทีเรีย (Biofilm) มาเกาะเคลือบผิวท่อแลกเปลี่ยนความร้อน ระบบจะทำงานได้เต็มประสิทธิภาพและประหยัดพลังงานมากขึ้น',
      },
    ],
  },
  {
    name: 'MCC-N',
    code: 'MCC-N',
    divisor: 4,
    unit: 'L',
    badge: 'ตัวหาร ÷ 4',
    summary: 'สารปรับสภาพน้ำป้องกันตะกรัน ป้องกันการกัดกร่อน และชะลอการเอ่อล้นของน้ำในหม้อต้ม',
    specs: {
      category: 'Multi-Function Scale & Corrosion Inhibitor (สารป้องกันตะกรันและสนิมรวม)',
      appearance: 'สารละลายโพลีเมอร์และสารปรับสภาพด่างสำหรับหม้อไอน้ำ',
      controlTarget: 'รักษาค่า pH 10.5 – 11.8 และป้องกันการตกผลึกแคลเซียม/แมกนีเซียม',
      dosingMethod: 'เติมต่อเนื่องผ่านชุดปั๊มโดสสารเคมีเข้าสู่ถังน้ำป้อนหรือหม้อต้ม',
      formulaText: '(ค่าล่าสุด - ค่าปัจจุบัน) ÷ 4',
    },
    topics: [
      {
        title: 'ป้องกันตะกรัน (Antiscalant)',
        body: 'ช่วยระงับและขัดขวางการตกผลึกของเกลือแร่ (เช่น แคลเซียม และแมกนีเซียม) ไม่ให้จับตัวเป็นหินปูนหรือตะกรันหนาตามผิวท่อและผนังหม้อต้ม',
      },
      {
        title: 'ป้องกันการกัดกร่อน (Corrosion Inhibitor)',
        body: 'สร้างชั้นฟิล์มบางๆ เคลือบผิวโลหะ เพื่อป้องกันไม่ให้เนื้อเหล็กสัมผัสกับออกซิเจนหรือสารเคมีกัดกร่อนโดยตรง',
      },
      {
        title: 'ป้องกันฟองและชะลอการเอ่อล้น (Antifoam / Carry-over Control)',
        body: 'ควบคุมการเกิดฟองบริเวณผิวน้ำในหม้อต้ม ช่วยลดความเสี่ยงที่น้ำที่มีสารละลายสูงจะหลุดลอยปนไปกับไอน้ำ (Steam) ซึ่งจะสร้างความเสียหายให้แก่ระบบท่อส่ง',
      },
    ],
  },
  {
    name: 'TCE-2138',
    code: 'TCE-2138',
    divisor: 8,
    unit: 'L',
    badge: 'ตัวหาร ÷ 8',
    summary: 'สารเคมีหลักสำหรับป้องกันตะกรัน สนิม และการกัดกร่อนในหม้อต้มไอน้ำ (Steam Boiler)',
    specs: {
      category: 'High-Performance Boiler Water Treatment (สารบำบัดน้ำหม้อไอน้ำประสิทธิภาพสูง)',
      appearance: 'สารละลายเคมีเข้มข้นสำหรับหม้อไอน้ำแรงดันต่ำถึงปานกลาง',
      controlTarget: 'ป้องกันหินปูนเกาะผนังท่อไฟ รักษาการถ่ายเทความร้อนและควบคุมฟอง',
      dosingMethod: 'ฟีดเข้าสู่ระบบน้ำหม้อต้มตามอัตราส่วนหาร 8 จากปริมาณน้ำยาที่ใช้จริง',
      formulaText: '(ค่าล่าสุด - ค่าปัจจุบัน) ÷ 8',
    },
    topics: [
      {
        title: 'ป้องกันการเกิดตะกรัน (Antiscalant)',
        body: 'ขัดขวางกระบวนการตกผลึกของแร่ธาตุในน้ำ เช่น แคลเซียม และแมกนีเซียม ไม่ให้จับตัวเป็นหินปูนเกาะหนาตามผนังท่อส่งความร้อน',
      },
      {
        title: 'คงประสิทธิภาพการส่งผ่านความร้อน (Heat Transfer)',
        body: 'เมื่อไม่มีคราบตะกรันหรือเมือกจุลชีพมาขัดขวาง อุณหภูมิในหม้อต้มจะส่งผ่านน้ำได้เต็มที่ ช่วยประหยัดเชื้อเพลิงและยืดอายุการใช้งานของระบบ',
      },
      {
        title: 'ป้องกันสนิมและการกัดกร่อน (Corrosion Inhibitor)',
        body: 'สร้างฟิล์มเคมีบางๆ เคลือบผิวโลหะ เพื่อกั้นระหว่างผิวเหล็กกับสารละลายหรือก๊าซที่กัดกร่อน',
      },
      {
        title: 'ควบคุมฟองและการเอ่อล้น (Antifoam / Carry-over Control)',
        body: 'ปรับสภาพผิวน้ำในหม้อต้มไม่ให้เกิดฟองปุดรุนแรง ป้องกันไม่ให้น้ำที่มีสารละลายสูงหลุดลอยปนไปกับไอน้ำที่ส่งออกไปใช้งาน',
      },
    ],
  },
];

export const PERMISSION_DEFINITIONS: Array<{
  key: keyof AppPermissions;
  label: string;
  description: string;
}> = [
  { key: 'allow_calculate', label: 'คำนวณ', description: 'อนุญาตให้ผู้ใช้คำนวณข้อมูล' },
  { key: 'allow_save', label: 'บันทึก', description: 'อนุญาตให้ผู้ใช้บันทึกประวัติ' },
  { key: 'allow_history_view', label: 'ดูประวัติ', description: 'อนุญาตให้ผู้ใช้เปิดประวัติ' },
  { key: 'allow_history_delete', label: 'ลบประวัติ', description: 'อนุญาตให้ผู้ใช้ลบรายการประวัติ' },
  {
    key: 'allow_sheet_sync',
    label: 'ส่งข้อมูลลงตาราง Sheet / Excel',
    description: 'เปิด-ปิดการส่งผลลัพธ์และวันที่ลงตารางชีตอัตโนมัติเมื่อคำนวณเสร็จ',
  },
];
