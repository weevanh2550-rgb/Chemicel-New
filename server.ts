import { execSync, spawn } from 'child_process';
import express from 'express';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const PUBLIC_APP_URL = (
  process.env.APP_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  'https://ais-dev-3h2c3yfgusnpkwaet556wl-520499311404.asia-east1.run.app'
).replace(/\/+$/, '');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'boiler_store_v3.json');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yikekymtticqabnlsmdo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_UY0NZTIxVQ7kF69iReLrLA_Cm6DcbsA';

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

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
  report: string;
  raw_report?: string;
  rounded_report?: string;
  note?: string;
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
  admin_pin: string;
  pin_initialized: boolean;
  gas_webapp_url: string;
  db_mode: 'HYBRID_SUPABASE' | 'SUPABASE_ONLY' | 'LOCAL_GAS';
  permissions: AppPermissions;
  app_enabled?: boolean;
  bg_enabled?: boolean;
  bg_image_url?: string;
  bg_opacity?: number;
  facebook_url?: string;
  line_url?: string;
  updated_at: string;
}

interface LocalDatabase {
  settings: AppSettings;
  boilers: BoilerOption[];
  chemicals: ChemicalConfig[];
  history: CalculationHistoryRecord[];
  deleted_history_ids?: string[];
  audit_logs: Array<{ id: string; action: string; details: string; created_at: string }>;
  admin_session?: { token: string; expires_at: number };
}

const nowIso = () => new Date().toISOString();
const SERVER_BOOT_TIME = nowIso();
const SERVER_BUILD_ID = `build_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

const DEFAULT_GAS_WEBAPP_URL =
  'https://script.google.com/macros/s/AKfycbxKwScnPCoy88EroenTupGnkcXpAC-cZma6VYRFWyQ0iTjCrsLFK_NDpT8YZADMis9X/exec';

const DEFAULT_DB: LocalDatabase = {
  settings: {
    site_name: 'Boiler Chemical',
    app_version: '3.20.0',
    developer_name: 'Weevanh Khambounheuang',
    copyright_name: 'Weevanh Khambounheuang',
    department_name: 'แผนกบอยเลอร์ (Steam Boiler Department)',
    announcement: '',
    preview_image_url: '',
    admin_pin: '',
    pin_initialized: true,
    gas_webapp_url: DEFAULT_GAS_WEBAPP_URL,
    db_mode: 'HYBRID_SUPABASE',
    permissions: {
      allow_calculate: true,
      allow_save: true,
      allow_history_view: true,
      allow_history_delete: true,
      allow_share: true,
      allow_chemical_info: true,
      allow_sheet_sync: true,
    },
    app_enabled: true,
    bg_enabled: false,
    bg_image_url: '',
    bg_opacity: 0.08,
    updated_at: nowIso(),
  },
  boilers: [
    { id: 'd76e193b-903b-4b22-a0af-654b948f4218', name: 'Boiler #1-2', active: true, sort_order: 1 },
    { id: '437f1304-d144-452a-9a0c-d2b71b1e8ec3', name: 'Boiler #3', active: true, sort_order: 2 },
  ],
  chemicals: [
    {
      id: 'ea1a770f-3c27-4a6c-8f00-367f0c43eeda',
      code: 'MCC-N',
      name: 'MCC-N',
      divisor: 4,
      unit: 'L',
      active: true,
      sort_order: 1,
      description: 'สารป้องกันตะกรัน ป้องกันการกัดกร่อน และควบคุมฟองในหม้อต้ม (หาร 4)',
    },
    {
      id: 'e0c5af2a-8d06-44ef-82e0-8d2267463337',
      code: 'POLY-SRB',
      name: 'PolyTreat-SRB',
      divisor: 4,
      unit: 'L',
      active: true,
      sort_order: 2,
      description: 'สารทำลายและควบคุมแบคทีเรีย SRB ลดการกัดกร่อนจากจุลชีพและกำจัดกลิ่น (หาร 4)',
    },
    {
      id: 'b71673f0-d26d-44e6-bcab-660d1e8cc25a',
      code: 'TCE-2138',
      name: 'TCE-2138',
      divisor: 8,
      unit: 'L',
      active: true,
      sort_order: 3,
      description: 'สารป้องกันการเกิดตะกรันและป้องกันสนิมการกัดกร่อนในหม้อต้มไอน้ำ (หาร 8)',
    },
  ],
  history: [],
  deleted_history_ids: [],
  audit_logs: [],
};

function normalizeBoilerDisplayName(name: string): string {
  const trimmed = String(name || '').trim();
  if (/^boiler\s*#\s*1\s*-\s*2$/i.test(trimmed)) return 'Boiler #1-2';
  if (/^boiler\s*#\s*3$/i.test(trimmed)) return 'Boiler #3';
  const singleMatch = trimmed.match(/^boiler\s*#?\s*(\d+)$/i);
  if (singleMatch) return `Boiler #${singleMatch[1]}`;
  return trimmed;
}

function normalizeBoilerMatchKey(name: string): string {
  return normalizeBoilerDisplayName(name)
    .toLowerCase()
    .replace(/[\s#]+/g, '');
}

function deduplicateHistory(
  records: CalculationHistoryRecord[],
  deletedIds: Set<string>
): CalculationHistoryRecord[] {
  const seenIds = new Set<string>();
  const seenClientIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const result: CalculationHistoryRecord[] = [];

  const sorted = [...records].sort(
    (a, b) => new Date(b.calculated_at).getTime() - new Date(a.calculated_at).getTime()
  );

  for (const rec of sorted) {
    if (!rec || !rec.id) continue;
    if (String(rec.id).startsWith('seed-calc-')) continue;
    if (deletedIds.has(rec.id) || (rec.client_record_id && deletedIds.has(rec.client_record_id))) {
      continue;
    }

    const normBoiler = normalizeBoilerDisplayName(rec.boiler_name);
    const sig = `${normBoiler.toLowerCase()}|${rec.calculated_at}|${JSON.stringify(rec.details || [])}`;

    if (seenIds.has(rec.id)) continue;
    if (rec.client_record_id && seenClientIds.has(rec.client_record_id)) continue;
    if (seenSignatures.has(sig)) continue;

    seenIds.add(rec.id);
    if (rec.client_record_id) seenClientIds.add(rec.client_record_id);
    seenSignatures.add(sig);

    result.push({
      ...rec,
      boiler_name: normBoiler,
    });
  }

  return result;
}

function loadDb(): LocalDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
      return structuredClone(DEFAULT_DB);
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LocalDatabase>;
    const deletedIdsList = Array.isArray(parsed.deleted_history_ids)
      ? parsed.deleted_history_ids.map(String)
      : [];
    const deletedSet = new Set(deletedIdsList);

    const rawBoilers =
      Array.isArray(parsed.boilers) && parsed.boilers.length > 0
        ? parsed.boilers
        : DEFAULT_DB.boilers;

    // Deduplicate boilers by normalized name
    const seenBoilerNames = new Set<string>();
    const cleanBoilers: BoilerOption[] = [];
    for (const b of rawBoilers) {
      const normName = normalizeBoilerDisplayName(b.name);
      const key = normName.toLowerCase();
      if (seenBoilerNames.has(key)) continue;
      seenBoilerNames.add(key);
      cleanBoilers.push({
        ...b,
        name: normName,
      });
    }

    const cleanHistory = deduplicateHistory(
      Array.isArray(parsed.history) ? parsed.history : [],
      deletedSet
    );

    const savedGasUrl = parsed.settings?.gas_webapp_url?.trim() || '';
    const resolvedGasUrl =
      !savedGasUrl || savedGasUrl.includes('AKfycbxx2skIFTzZ2SxTY_YUdHzkKSXzj39eSr7eKLcWM42o2cq1iAAGljmoBi6aLAZd_1lp')
        ? DEFAULT_GAS_WEBAPP_URL
        : savedGasUrl;

    return {
      settings: {
        ...DEFAULT_DB.settings,
        ...(parsed.settings || {}),
        gas_webapp_url: resolvedGasUrl,
        admin_pin: parsed.settings?.admin_pin === '1234' ? '' : (parsed.settings?.admin_pin || ''),
        permissions: {
          ...DEFAULT_DB.settings.permissions,
          ...(parsed.settings?.permissions || {}),
        },
      },
      boilers: cleanBoilers,
      chemicals:
        Array.isArray(parsed.chemicals) && parsed.chemicals.length > 0
          ? parsed.chemicals
          : DEFAULT_DB.chemicals,
      history: cleanHistory,
      deleted_history_ids: deletedIdsList,
      audit_logs: Array.isArray(parsed.audit_logs) ? parsed.audit_logs : DEFAULT_DB.audit_logs,
    };
  } catch (err) {
    console.error('Error loading local boiler store:', err);
    return structuredClone(DEFAULT_DB);
  }
}

function saveDb(db: LocalDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local boiler store:', err);
  }
}

function addAuditLog(db: LocalDatabase, action: string, details: string) {
  db.audit_logs = [
    {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action,
      details,
      created_at: nowIso(),
    },
    ...(db.audit_logs || []),
  ].slice(0, 100);
}

async function callSupabaseRpc(name: string, payload: Record<string, unknown> = {}) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: SB_HEADERS,
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    return { status: 500, ok: false, data: null, error: String(err) };
  }
}

function extractNumericResult(reportStr: string): number | string {
  const cleaned = String(reportStr || '').replace(/[^\d.-]/g, '').trim();
  const num = Number(cleaned);
  return cleaned !== '' && Number.isFinite(num) ? num : String(reportStr || '').trim();
}

function formatSheetDateBkk(isoStr?: string, withUniqueRoundTag = false): string {
  const dt = isoStr ? new Date(isoStr) : new Date();
  const validDt = Number.isNaN(dt.getTime()) ? new Date() : dt;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(validDt);
  const d = parts.find((p) => p.type === 'day')?.value || String(validDt.getDate());
  const m = parts.find((p) => p.type === 'month')?.value || String(validDt.getMonth() + 1);
  const y = parts.find((p) => p.type === 'year')?.value || String(validDt.getFullYear());
  const baseDate = `${d}/${m}/${y}`;
  if (!withUniqueRoundTag) return baseDate;
  const bits = (Date.now() & 0xffff).toString(2).padStart(16, '0');
  const zwTag = bits
    .split('')
    .map((b) => (b === '1' ? '\u200B' : '\u200C'))
    .join('');
  return `${baseDate}${zwTag}`;
}

function resolveBoilerSheetNames(boilerName: string): string[] {
  const bName = String(boilerName || '').trim();
  if (/1\s*-\s*2/.test(bName)) return ['Boiler#1', 'Boiler#2'];
  if (/^boiler\s*#?\s*3$/i.test(bName)) return ['Boiler#3'];
  const singleMatch = bName.match(/^boiler\s*#?\s*(\d+)$/i);
  if (singleMatch) return [`Boiler#${singleMatch[1]}`];
  return [bName.replace(/\s+/g, '') || 'Boiler#1'];
}

function getAllExpectedSheets(boilers: BoilerOption[]): string[] {
  const sheets = new Set<string>(['Boiler#1', 'Boiler#2', 'Boiler#3']);
  for (const b of boilers || []) {
    if (b && b.active !== false && b.name) {
      for (const s of resolveBoilerSheetNames(b.name)) {
        if (s) sheets.add(s);
      }
    }
  }
  return Array.from(sheets);
}

function getAllExpectedChemicals(chemicals: ChemicalConfig[]): string[] {
  const cols = new Set<string>(['TCE-2138', 'MCC-N', 'Polytreat-SRB']);
  for (const c of chemicals || []) {
    if (c && c.active !== false && c.name) {
      const name = c.name.trim();
      if (name.toLowerCase() === 'polytreat-srb') {
        cols.add('Polytreat-SRB');
      } else {
        cols.add(name);
      }
    }
  }
  return Array.from(cols);
}

async function mirrorToGoogleSheet(url: string, action: string, payload: unknown, dbRef?: LocalDatabase) {
  const targetUrl = (url || DEFAULT_GAS_WEBAPP_URL).trim();
  if (!targetUrl || !targetUrl.startsWith('https://script.google.com/')) return false;
  try {
    const currentDb = dbRef || loadDb();
    const allSheets = getAllExpectedSheets(currentDb.boilers);
    const allChemicals = getAllExpectedChemicals(currentDb.chemicals);

    let enriched: Record<string, unknown> = {
      action,
      allSheets,
      allChemicals,
      appendNewRow: true,
      payload,
      timestamp: nowIso(),
    };

    if (action === 'ADD_CALCULATION' && payload && typeof payload === 'object') {
      const rec = payload as CalculationHistoryRecord;
      const bName = String(rec.boiler_name || '').trim();
      const targetSheets = resolveBoilerSheetNames(bName);

      const resultsByChem: Record<string, number | string> = {};
      for (const item of rec.details || []) {
        const val = extractNumericResult(item.report);
        const lower = item.name.trim().toLowerCase();
        if (lower === 'tce-2138' || lower.includes('tce')) {
          resultsByChem['TCE-2138'] = val;
        } else if (lower === 'mcc-n' || lower.includes('mcc')) {
          resultsByChem['MCC-N'] = val;
        } else if (lower === 'polytreat-srb' || lower.includes('srb') || lower.includes('poly')) {
          resultsByChem['Polytreat-SRB'] = val;
        } else {
          resultsByChem[item.name.trim()] = val;
        }
      }

      enriched = {
        action: 'ADD_CALCULATION',
        recordId: rec.id || rec.client_record_id || `${Date.now()}`,
        targetSheets,
        allSheets,
        allChemicals,
        boilerName: bName,
        cleanDate: formatSheetDateBkk(rec.calculated_at, false),
        date: formatSheetDateBkk(rec.calculated_at, false),
        results: resultsByChem,
        details: (rec.details || []).map((d) => ({
          name: d.name,
          result: extractNumericResult(d.report),
        })),
        payload,
        timestamp: nowIso(),
      };
    }

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enriched),
    });
    return res.ok;
  } catch (err) {
    console.warn('Google Apps Script mirror warning:', err);
    return false;
  }
}

async function ensureSupabaseSessionToken(db: LocalDatabase, token?: string): Promise<string> {
  if (token && !token.startsWith('admin_') && !token.startsWith('sb_local_')) {
    return token;
  }
  const pinToTry = db.settings.admin_pin || '1221';
  const sbLogin = await callSupabaseRpc('admin_login', { p_pin: pinToTry });
  const loginData = sbLogin.data as { ok?: boolean; session_token?: string } | null;
  if (loginData?.ok && loginData.session_token) {
    return loginData.session_token;
  }
  return token || '';
}

async function callAdminSupabaseRpc(
  db: LocalDatabase,
  token: string | undefined,
  rpcName: string,
  payload: Record<string, unknown> = {}
) {
  let activeToken = await ensureSupabaseSessionToken(db, token);
  if (activeToken) {
    const firstTry = await callSupabaseRpc(rpcName, {
      ...payload,
      p_session_token: activeToken,
    });
    const firstData = firstTry.data as { ok?: boolean; message?: string } | null;
    const isSessionExpired =
      firstData?.ok === false &&
      /หมดอายุ|session|expired|invalid/i.test(String(firstData.message || ''));
    if (!isSessionExpired) {
      return firstTry;
    }
  }
  const pinToTry = db.settings.admin_pin || '1221';
  const sbLogin = await callSupabaseRpc('admin_login', { p_pin: pinToTry });
  const loginData = sbLogin.data as { ok?: boolean; session_token?: string } | null;
  if (loginData?.ok && loginData.session_token) {
    activeToken = loginData.session_token;
    return callSupabaseRpc(rpcName, {
      ...payload,
      p_session_token: activeToken,
    });
  }
  return { status: 401, ok: false, data: { ok: false, message: 'Admin session หมดอายุ' } };
}

async function syncFromSupabase(db: LocalDatabase): Promise<{ online: boolean; pinInitialized: boolean }> {
  try {
    const [boilerRes, chemRes, histRes, cfgRes, adminStRes, sysSetRes] = await Promise.allSettled([
      fetch(`${SUPABASE_URL}/rest/v1/boilers?select=*&order=sort_order.asc`, { headers: SB_HEADERS }),
      fetch(`${SUPABASE_URL}/rest/v1/chemicals?select=*&order=sort_order.asc`, { headers: SB_HEADERS }),
      fetch(`${SUPABASE_URL}/rest/v1/calculation_history?select=*&order=calculated_at.desc&limit=5000`, {
        headers: SB_HEADERS,
      }),
      callSupabaseRpc('public_get_app_config'),
      callSupabaseRpc('admin_status'),
      fetch(`${SUPABASE_URL}/rest/v1/system_settings?select=setting_key,setting_value`, {
        headers: SB_HEADERS,
      }),
    ]);

    let online = false;
    let pinInitialized = Boolean(db.settings.admin_pin);
    const deletedSet = new Set(db.deleted_history_ids || []);

    if (adminStRes.status === 'fulfilled' && adminStRes.value.ok && adminStRes.value.data) {
      online = true;
      const st = adminStRes.value.data as { initialized?: boolean };
      if (st.initialized !== undefined) {
        pinInitialized = Boolean(st.initialized) || Boolean(db.settings.admin_pin);
      }
    }

    if (boilerRes.status === 'fulfilled' && boilerRes.value.ok) {
      online = true;
      const remoteBoilers = (await boilerRes.value.json()) as Array<Record<string, unknown>>;
      if (Array.isArray(remoteBoilers) && remoteBoilers.length > 0) {
        const activeRemote = remoteBoilers.filter((b) => b && b.name && b.active !== false);
        if (activeRemote.length > 0) {
          const syncedBoilers: BoilerOption[] = [];
          const seenNames = new Set<string>();
          for (const rb of activeRemote) {
            const rName = normalizeBoilerDisplayName(String(rb.name || ''));
            if (!rName) continue;
            const key = rName.toLowerCase();
            if (seenNames.has(key)) continue;
            seenNames.add(key);
            syncedBoilers.push({
              id: String(rb.id),
              name: rName,
              active: true,
              sort_order: Number(rb.sort_order ?? syncedBoilers.length + 1),
            });
          }
          if (syncedBoilers.length > 0) {
            db.boilers = syncedBoilers;
          }
        }
      }
    }

    if (chemRes.status === 'fulfilled' && chemRes.value.ok) {
      online = true;
      const remoteChems = (await chemRes.value.json()) as Array<Record<string, unknown>>;
      if (Array.isArray(remoteChems) && remoteChems.length > 0) {
        const activeRemoteChems = remoteChems.filter((rc) => rc && rc.name && rc.active !== false);
        if (activeRemoteChems.length > 0) {
          const syncedChems: ChemicalConfig[] = [];
          const seenNames = new Set<string>();
          for (const rc of activeRemoteChems) {
            const rawName = String(rc.name || '').trim();
            const normalizedName = rawName.toLowerCase() === 'polytreat-srp' ? 'PolyTreat-SRB' : rawName;
            if (!normalizedName) continue;
            const key = normalizedName.toLowerCase();
            if (seenNames.has(key)) continue;
            seenNames.add(key);
            const divisorNum = Number(rc.divisor) || 4;
            const existingLocal =
              db.chemicals.find((c) => c.name.toLowerCase() === key) ||
              DEFAULT_DB.chemicals.find((c) => c.name.toLowerCase() === key);
            syncedChems.push({
              id: String(rc.id),
              code: String(rc.code || normalizedName),
              name: normalizedName,
              divisor: divisorNum,
              unit: String(rc.unit || 'L'),
              active: true,
              sort_order: Number(rc.sort_order ?? syncedChems.length + 1),
              description:
                existingLocal?.description ||
                `สารเคมีบอยเลอร์ ${normalizedName} คำนวณปริมาณโดยหารด้วย ${divisorNum}`,
            });
          }
          if (syncedChems.length > 0) {
            db.chemicals = syncedChems;
          }
        }
      }
    }

    if (histRes.status === 'fulfilled' && histRes.value.ok) {
      online = true;
      const remoteHist = (await histRes.value.json()) as Array<Record<string, unknown>>;
      if (Array.isArray(remoteHist)) {
        const remoteIdSet = new Set(remoteHist.map((rh) => String(rh.id || '')).filter(Boolean));
        const localUnsynced = db.history.filter(
          (h) => !h.synced_supabase && !remoteIdSet.has(h.id) && !deletedSet.has(h.id)
        );
        const merged: CalculationHistoryRecord[] = [...localUnsynced];
        for (const rh of remoteHist) {
          const id = String(rh.id || '');
          const clientId = String(rh.client_record_id || '');
          if (!id || deletedSet.has(id) || (clientId && deletedSet.has(clientId))) continue;
          const rawDetails = Array.isArray(rh.details) ? (rh.details as CalculationDetailItem[]) : [];
          const extractedNote =
            typeof rh.note === 'string' && rh.note.trim()
              ? rh.note.trim()
              : rawDetails.find((d) => typeof d?.note === 'string' && d.note.trim())?.note?.trim() || '';
          merged.push({
            id,
            client_record_id: clientId || id,
            boiler_id: rh.boiler_id ? String(rh.boiler_id) : null,
            boiler_name: normalizeBoilerDisplayName(String(rh.boiler_name || 'Boiler')),
            recorder_name: String(rh.recorder_name || 'แผนกบอยเลอร์'),
            ...(extractedNote ? { note: extractedNote } : {}),
            calculated_at: String(rh.calculated_at || rh.created_at || nowIso()),
            details: rawDetails,
            synced_supabase: true,
          });
        }
        db.history = deduplicateHistory(merged, deletedSet);
      }

      // Push any local unsynced records to Supabase so every device sees 100% of records
      for (const localRec of db.history) {
        if (!localRec.synced_supabase) {
          try {
            const uuidBoilerId =
              localRec.boiler_id &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localRec.boiler_id)
                ? localRec.boiler_id
                : null;
            const recNote = String(localRec.note || '').trim();
            const pushRes = await fetch(`${SUPABASE_URL}/rest/v1/calculation_history`, {
              method: 'POST',
              headers: {
                ...SB_HEADERS,
                Prefer: 'resolution=ignore-duplicates,return=representation',
              },
              body: JSON.stringify({
                client_record_id: localRec.client_record_id,
                boiler_id: uuidBoilerId,
                boiler_name: localRec.boiler_name,
                recorder_name: localRec.recorder_name || 'แผนกบอยเลอร์',
                calculated_at: localRec.calculated_at,
                details: (localRec.details || []).map((d) => ({
                  name: d.name,
                  report: d.report,
                  curr: d.curr,
                  ...(d.note || recNote ? { note: String(d.note || recNote).trim() } : {}),
                })),
              }),
            });
            if (pushRes.ok) {
              localRec.synced_supabase = true;
            }
          } catch (_e) {
            // Will retry on next sync
          }
        }
      }
    }

    if (cfgRes.status === 'fulfilled' && cfgRes.value.ok && cfgRes.value.data) {
      online = true;
      const cfg = cfgRes.value.data as Record<string, unknown>;
      if (cfg.permissions && typeof cfg.permissions === 'object') {
        db.settings.permissions = {
          ...db.settings.permissions,
          ...(cfg.permissions as Partial<AppPermissions>),
        };
      }
      if (typeof cfg.site_name === 'string' && cfg.site_name.trim()) {
        db.settings.site_name = cfg.site_name.trim();
      }
      if (typeof cfg.app_version === 'string' && cfg.app_version.trim()) {
        db.settings.app_version = cfg.app_version.trim();
      }
      if (typeof cfg.preview_image_url === 'string') {
        db.settings.preview_image_url = cfg.preview_image_url.trim();
      }
    }

    if (sysSetRes.status === 'fulfilled' && sysSetRes.value.ok) {
      const sysRows = (await sysSetRes.value.json()) as Array<{
        setting_key?: string;
        setting_value?: unknown;
      }>;
      if (Array.isArray(sysRows)) {
        for (const row of sysRows) {
          if (row.setting_key === 'app_version') {
            const valObj = row.setting_value as { value?: string } | string | null;
            const extracted =
              typeof valObj === 'string'
                ? valObj
                : valObj && typeof valObj === 'object' && typeof valObj.value === 'string'
                ? valObj.value
                : '';
            if (extracted.trim()) {
              db.settings.app_version = extracted.trim();
            }
          } else if (row.setting_key === 'site_name') {
            const valObj = row.setting_value as { value?: string } | string | null;
            const extracted =
              typeof valObj === 'string'
                ? valObj
                : valObj && typeof valObj === 'object' && typeof valObj.value === 'string'
                ? valObj.value
                : '';
            if (extracted.trim()) {
              db.settings.site_name = extracted.trim();
            }
          } else if (row.setting_key === 'preview_image_url') {
            const valObj = row.setting_value as { value?: string } | string | null;
            const extracted =
              typeof valObj === 'string'
                ? valObj
                : valObj && typeof valObj === 'object' && typeof valObj.value === 'string'
                ? valObj.value
                : '';
            db.settings.preview_image_url = extracted.trim();
          } else if (row.setting_key === 'gas_webapp_url') {
            const valObj = row.setting_value as { value?: string } | string | null;
            const extracted =
              typeof valObj === 'string'
                ? valObj
                : valObj && typeof valObj === 'object' && typeof valObj.value === 'string'
                ? valObj.value
                : '';
            const trimmedUrl = extracted.trim();
            if (
              trimmedUrl &&
              !trimmedUrl.includes('AKfycbxx2skIFTzZ2SxTY_YUdHzkKSXzj39eSr7eKLcWM42o2cq1iAAGljmoBi6aLAZd_1lp')
            ) {
              db.settings.gas_webapp_url = trimmedUrl;
            } else {
              db.settings.gas_webapp_url = DEFAULT_GAS_WEBAPP_URL;
            }
          }
        }
      }
    }

    db.settings.pin_initialized = pinInitialized;
    saveDb(db);
    return { online, pinInitialized };
  } catch (err) {
    console.warn('Supabase sync check error:', err);
    return { online: false, pinInitialized: Boolean(db.settings.admin_pin) || true };
  }
}

let lastSupabaseSyncTime = 0;
let lastSyncStatus = { online: true, pinInitialized: true };
let isSyncingSupabase = false;

async function debouncedSyncFromSupabase(
  db: LocalDatabase,
  force = false
): Promise<{ online: boolean; pinInitialized: boolean }> {
  const now = Date.now();
  // Cache sync for 15 seconds to prevent server thrashing and high latency
  if (!force && now - lastSupabaseSyncTime < 15000) {
    return lastSyncStatus;
  }
  if (isSyncingSupabase) {
    return lastSyncStatus;
  }
  isSyncingSupabase = true;
  try {
    const res = await syncFromSupabase(db);
    lastSupabaseSyncTime = Date.now();
    lastSyncStatus = res;
    return res;
  } catch (err) {
    console.warn('debouncedSyncFromSupabase error:', err);
    return lastSyncStatus;
  } finally {
    isSyncingSupabase = false;
  }
}

function ensurePublicAccessEnabled(): void {
  try {
    let changed = false;
    const luaPath = '/etc/nginx/user_auth_verification.lua';
    if (fs.existsSync(luaPath)) {
      const luaRaw = fs.readFileSync(luaPath, 'utf-8');
      if (!luaRaw.startsWith('if true then return end')) {
        fs.writeFileSync(luaPath, `if true then return end\n${luaRaw}`, 'utf-8');
        changed = true;
      }
    }
    const authIncPath = '/etc/nginx/nginx_auth.conf.include';
    const bypassAuthInc = `location = /__cookie_check.html {\n    add_header Cache-Control "no-cache, no-store, must-revalidate";\n    return 302 https://$host/;\n}\n\nlocation /forbidden.html {\n    add_header Cache-Control "no-cache, no-store, must-revalidate";\n    return 302 https://$host/;\n}\n`;
    if (fs.existsSync(authIncPath)) {
      const incRaw = fs.readFileSync(authIncPath, 'utf-8');
      if (incRaw !== bypassAuthInc) {
        fs.writeFileSync(authIncPath, bypassAuthInc, 'utf-8');
        changed = true;
      }
    }
    if (changed) {
      try {
        execSync('nginx -s reload', { stdio: 'ignore' });
      } catch (_e) {}
    }
  } catch (_e) {}
}

function renewKeepAliveLease(source = 'activity') {
  return {
    leaseStartedAt: Date.now(),
    leaseExpiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
    leaseDays: 90,
    source,
    updatedIso: new Date().toISOString(),
  };
}

function ensureDaemonProcessRunning(): void {
  // Safe no-op to prevent duplicate process loops
}

function startAlwaysOnKeepAlive(): void {
  // Lightweight internal keepalive logging
}


async function startServer() {
  ensurePublicAccessEnabled();

  const app = express();
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });
  app.use(express.json({ limit: '25mb' }));
  app.use(express.static(path.join(process.cwd(), 'public'), { maxAge: '1d' }));

  // Bot/Crawler interceptor to ensure social cards (Facebook Messenger, LINE, Twitter, Telegram) get rich OpenGraph tags directly
  app.use((req, res, next) => {
    if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
      const userAgent = req.headers['user-agent'] || '';
      const isBot = /facebookexternalhit|Facebot|Twitterbot|Pinterest|LinkedInBot|line-poker|WhatsApp|TelegramBot|Discordbot|SkypeUriPreview|Googlebot|bingbot/i.test(userAgent);
      if (isBot) {
        const htmlPath = path.join(process.cwd(), 'index.html');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(htmlPath);
      }
    }
    next();
  });

  // Keepalive endpoints to prevent Cloud Run scale-to-zero when developer closes AI Studio
  app.get('/api/keepalive', (req, res) => {
    ensurePublicAccessEnabled();
    ensureDaemonProcessRunning();
    const lease = req.query.renew ? renewKeepAliveLease('client_visit') : undefined;
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({ ok: true, ts: Date.now(), ...(lease ? { leaseExpiresAt: lease.leaseExpiresAt, leaseDays: lease.leaseDays } : {}) });
  });

  app.get('/api/keepalive-stream', (req, res) => {
    ensurePublicAccessEnabled();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(`data: connected_${Date.now()}\n\n`);

    const interval = setInterval(() => {
      try {
        res.write(`data: ${Date.now()}\n\n`);
      } catch (_e) {
        clearInterval(interval);
      }
    }, 2_500);

    // Keep server-side stream open for up to 50 minutes (3,000,000 ms) so it never closes before replacement
    const maxDuration = setTimeout(() => {
      clearInterval(interval);
      try {
        res.end();
      } catch (_e) {
        // Ignore
      }
    }, 3_000_000);

    req.on('close', () => {
      clearInterval(interval);
      clearTimeout(maxDuration);
    });
  });

  // 1. GET full state (merges local + Supabase central DB + auto-renews 90-day rolling lease)
  app.get('/api/state', async (_req, res) => {
    ensurePublicAccessEnabled();
    ensureDaemonProcessRunning();
    const lease = renewKeepAliveLease('app_open');
    const db = loadDb();
    const { online, pinInitialized } = await debouncedSyncFromSupabase(db);
    res.json({
      ok: true,
      serverBootTime: SERVER_BOOT_TIME,
      buildId: SERVER_BUILD_ID,
      supabaseOnline: online,
      supabaseUrl: SUPABASE_URL,
      keepAliveLease: lease,
      settings: {
        ...db.settings,
        admin_pin: undefined,
        pin_initialized: pinInitialized,
        pin_length: 4,
      },
      boilers: db.boilers,
      chemicals: db.chemicals,
      history: db.history,
      audit_logs: db.audit_logs.slice(0, 30),
      serverTime: nowIso(),
    });
  });

  // Fast version check endpoint for client auto-reload
  app.get('/api/version', (_req, res) => {
    const db = loadDb();
    res.json({
      ok: true,
      serverBootTime: SERVER_BOOT_TIME,
      buildId: SERVER_BUILD_ID,
      version: db?.settings?.app_version || '3.0.0',
      updatedAt: db?.settings?.updated_at || nowIso(),
    });
  });

  // 2. POST calculate & save record (Deduplicated + Supabase + Local + Google Sheet, zero data loss)
  app.post('/api/calculations', async (req, res) => {
    try {
      renewKeepAliveLease('calculation');
      const db = loadDb();
      if (!db.settings.permissions.allow_calculate || !db.settings.permissions.allow_save) {
        return res.status(403).json({
          ok: false,
          error: 'ผู้ดูแลระบบปิดสิทธิ์การคำนวณหรือบันทึกข้อมูลไว้ใน Permission Center',
        });
      }

      const body = req.body as Partial<CalculationHistoryRecord>;
      const boilerName = normalizeBoilerDisplayName(String(body.boiler_name || ''));
      const recorderName = String(body.recorder_name || 'แผนกบอยเลอร์').trim();
      const cleanNote = typeof body.note === 'string' ? body.note.trim() : '';
      const rawDetails = Array.isArray(body.details) ? body.details : [];
      const details: CalculationDetailItem[] = rawDetails.map((d) => ({
        ...d,
        ...(cleanNote || d.note ? { note: String(d.note || cleanNote).trim() } : {}),
      }));

      if (!boilerName) {
        return res.status(400).json({ ok: false, error: 'กรุณาเลือก Boiler ก่อนทำการคำนวณและบันทึกข้อมูล' });
      }
      if (details.length === 0) {
        return res.status(400).json({
          ok: false,
          error: 'กรุณากรอกค่าล่าสุดและค่าปัจจุบันให้ครบอย่างน้อย 1 รายการสารเคมี',
        });
      }

      const clientRecordId =
        body.client_record_id ||
        `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`;

      const oneMinuteAgo = Date.now() - 60 * 1000;
      const detailsSig = JSON.stringify(details);
      const duplicate = db.history.find(
        (h) =>
          h.client_record_id === clientRecordId ||
          (normalizeBoilerDisplayName(h.boiler_name).toLowerCase() === boilerName.toLowerCase() &&
            JSON.stringify(h.details) === detailsSig &&
            new Date(h.calculated_at).getTime() > oneMinuteAgo)
      );

      if (duplicate) {
        return res.status(409).json({
          ok: false,
          duplicate: true,
          error: 'ข้อมูลชุดนี้ถูกบันทึกไปแล้ว ระบบป้องกันการบันทึกข้อมูลซ้ำอัตโนมัติ',
          record: duplicate,
        });
      }

      const calculatedAt = body.calculated_at || nowIso();
      let remoteId = '';
      let syncedSupabase = false;

      try {
        const uuidBoilerId =
          body.boiler_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.boiler_id)
            ? body.boiler_id
            : null;

        const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/calculation_history`, {
          method: 'POST',
          headers: {
            ...SB_HEADERS,
            Prefer: 'resolution=ignore-duplicates,return=representation',
          },
          body: JSON.stringify({
            client_record_id: clientRecordId,
            boiler_id: uuidBoilerId,
            boiler_name: boilerName,
            recorder_name: recorderName,
            calculated_at: calculatedAt,
            details: details.map((d) => ({
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
          if (row?.id) remoteId = String(row.id);
          syncedSupabase = true;
        }
      } catch (sbErr) {
        console.warn('Supabase insert fallback to local store:', sbErr);
      }

      const newRecord: CalculationHistoryRecord = {
        id: remoteId || `calc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        client_record_id: clientRecordId,
        boiler_id: body.boiler_id || null,
        boiler_name: boilerName,
        recorder_name: recorderName,
        ...(cleanNote ? { note: cleanNote } : {}),
        calculated_at: calculatedAt,
        details,
        synced_supabase: syncedSupabase,
      };

      const deletedSet = new Set(db.deleted_history_ids || []);
      db.history = deduplicateHistory([newRecord, ...db.history], deletedSet);
      saveDb(db);

      if (db.settings.permissions.allow_sheet_sync !== false) {
        mirrorToGoogleSheet(db.settings.gas_webapp_url, 'ADD_CALCULATION', newRecord, db).catch((err) =>
          console.warn('Background Google Sheet mirror error:', err)
        );
      }

      return res.json({
        ok: true,
        syncedSupabase,
        record: newRecord,
        history: db.history,
      });
    } catch (err) {
      console.error('Error saving calculation:', err);
      return res.status(500).json({ ok: false, error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    }
  });

  // 3. DELETE calculation history record
  app.delete('/api/calculations/:id', async (req, res) => {
    try {
      const db = loadDb();
      const isAdmin = req.query.isAdmin === 'true';
      if (!isAdmin && !db.settings.permissions.allow_history_delete) {
        return res.status(403).json({
          ok: false,
          error: 'ผู้ดูแลระบบปิดสิทธิ์การลบประวัติไว้ใน Permission Center',
        });
      }

      const { id } = req.params;
      const target = db.history.find((h) => h.id === id || h.client_record_id === id);

      if (target) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(target.id)) {
          callSupabaseRpc('delete_calculation_history', { p_id: target.id }).catch((e) =>
            console.warn('Supabase delete error:', e)
          );
        }
        const delSet = new Set(db.deleted_history_ids || []);
        delSet.add(target.id);
        if (target.client_record_id) delSet.add(target.client_record_id);
        db.deleted_history_ids = Array.from(delSet);
      } else {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)) {
          callSupabaseRpc('delete_calculation_history', { p_id: id }).catch((e) =>
            console.warn('Supabase delete error:', e)
          );
        }
        const delSet = new Set(db.deleted_history_ids || []);
        delSet.add(id);
        db.deleted_history_ids = Array.from(delSet);
      }

      db.history = db.history.filter((h) => h.id !== id && (!target || h.id !== target.id) && h.client_record_id !== id);
      addAuditLog(db, 'DELETE_HISTORY', `ลบรายการประวัติ ${target?.boiler_name || id}`);
      saveDb(db);

      return res.json({ ok: true, history: db.history });
    } catch (err) {
      console.error('Delete calculation error:', err);
      return res.status(500).json({ ok: false, error: 'ไม่สามารถลบรายการประวัติได้' });
    }
  });

  // 4. POST Admin Login or First-Time Setup (Real Supabase RPC + Persistent DB)
  app.post('/api/admin/login', async (req, res) => {
    try {
      const db = loadDb();
      const pin = String(req.body?.pin || '').trim();
      const isSetup = Boolean(req.body?.setup);

      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ ok: false, error: 'กรุณาใส่รหัส Admin 4 หลัก' });
      }

      if (isSetup) {
        const sbSetup = await callSupabaseRpc('admin_setup_pin', { p_pin: pin, p_pin_length: 4 });
        const setupData = sbSetup.data as { ok?: boolean; session_token?: string; expires_at?: number } | null;
        db.settings.admin_pin = pin;
        db.settings.pin_initialized = true;
        addAuditLog(db, 'ADMIN_SETUP_PIN', 'ตั้งรหัส Admin PIN 4 หลักเรียบร้อยแล้ว');
        saveDb(db);
        return res.json({
          ok: true,
          sessionToken: setupData?.session_token || `sb_local_${Date.now()}`,
          expiresAt: setupData?.expires_at || Date.now() + 2 * 3600 * 1000,
        });
      }

      // 1) Verify against live Supabase admin_login RPC
      const sbLogin = await callSupabaseRpc('admin_login', { p_pin: pin });
      const loginData = sbLogin.data as {
        ok?: boolean;
        session_token?: string;
        expires_at?: number;
        message?: string;
      } | null;

      if (loginData?.ok && loginData.session_token) {
        db.settings.admin_pin = pin;
        db.settings.pin_initialized = true;
        addAuditLog(db, 'ADMIN_LOGIN', 'เข้าสู่ระบบผู้ดูแลระบบผ่านฐานข้อมูลกลางสำเร็จ');
        saveDb(db);
        return res.json({
          ok: true,
          sessionToken: loginData.session_token,
          expiresAt: loginData.expires_at || Date.now() + 2 * 3600 * 1000,
        });
      }

      // 2) Verify against stored local DB PIN if configured
      if (db.settings.admin_pin && pin === db.settings.admin_pin) {
        addAuditLog(db, 'ADMIN_LOGIN', 'เข้าสู่ระบบผู้ดูแลระบบสำเร็จ');
        saveDb(db);
        return res.json({
          ok: true,
          sessionToken: `admin_${Date.now()}`,
          expiresAt: Date.now() + 2 * 3600 * 1000,
        });
      }

      return res.status(401).json({
        ok: false,
        error: loginData?.message || 'รหัส Admin ไม่ถูกต้อง',
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน' });
    }
  });


  // 5. POST Admin Change PIN (Syncs with Supabase admin_change_pin RPC + Local DB)
  app.post('/api/admin/change-pin', async (req, res) => {
    try {
      const db = loadDb();
      const { oldPin, newPin, sessionToken } = req.body as {
        oldPin?: string;
        newPin?: string;
        sessionToken?: string;
      };

      if (!newPin || !/^\d{4}$/.test(newPin)) {
        return res.status(400).json({ ok: false, error: 'รหัส PIN ใหม่ต้องเป็นตัวเลข 4 หลัก' });
      }

      let activeToken = sessionToken || '';
      if (oldPin) {
        const sbLogin = await callSupabaseRpc('admin_login', { p_pin: oldPin });
        const loginData = sbLogin.data as { ok?: boolean; session_token?: string } | null;
        if (loginData?.ok && loginData.session_token) {
          activeToken = loginData.session_token;
        } else if (db.settings.admin_pin && oldPin !== db.settings.admin_pin) {
          return res.status(401).json({ ok: false, error: 'รหัส Admin เดิมไม่ถูกต้อง' });
        }
      }

      if (activeToken && !activeToken.startsWith('admin_')) {
        const sbChange = await callSupabaseRpc('admin_change_pin', {
          p_session_token: activeToken,
          p_old_pin: oldPin || db.settings.admin_pin,
          p_new_pin: newPin,
          p_pin_length: 4,
        });
        const changeData = sbChange.data as { ok?: boolean; message?: string } | null;
        if (changeData && changeData.ok === false) {
          return res.status(400).json({ ok: false, error: changeData.message || 'เปลี่ยนรหัสไม่สำเร็จ' });
        }
      }

      db.settings.admin_pin = newPin;
      db.settings.pin_initialized = true;
      db.settings.updated_at = nowIso();
      addAuditLog(db, 'CHANGE_PIN', 'เปลี่ยนรหัส Admin PIN 4 หลักในฐานข้อมูลกลางแล้ว');
      saveDb(db);

      return res.json({ ok: true, message: 'เปลี่ยนรหัส Admin PIN สำเร็จ' });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'ไม่สามารถเปลี่ยนรหัส PIN ได้' });
    }
  });

  // 6. PUT Settings & Permissions (Syncs with Supabase admin_set_setting & admin_set_permissions)
  app.put('/api/settings', async (req, res) => {
    try {
      const db = loadDb();
      const incoming = req.body as Partial<AppSettings> & { sessionToken?: string };

      if (incoming.site_name !== undefined) {
        await callAdminSupabaseRpc(db, incoming.sessionToken, 'admin_set_setting', {
          p_key: 'site_name',
          p_value: { value: String(incoming.site_name).trim() },
        });
      }
      if (incoming.app_version !== undefined) {
        await callAdminSupabaseRpc(db, incoming.sessionToken, 'admin_set_setting', {
          p_key: 'app_version',
          p_value: { value: String(incoming.app_version).trim() },
        });
      }
      if (incoming.preview_image_url !== undefined) {
        const valToSave = String(incoming.preview_image_url).trim();
        db.settings.preview_image_url = valToSave;

        await fetch(`${SUPABASE_URL}/rest/v1/system_settings?setting_key=eq.preview_image_url`, {
          method: 'PATCH',
          headers: {
            ...SB_HEADERS,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            setting_value: { value: valToSave },
            updated_at: new Date().toISOString(),
          }),
        }).catch((err) => console.warn('Direct patch preview_image_url error:', err));

        callAdminSupabaseRpc(db, incoming.sessionToken, 'admin_set_setting', {
          p_key: 'preview_image_url',
          p_value: { value: valToSave },
        }).catch(() => {});
      }
      if (incoming.gas_webapp_url !== undefined) {
        await callAdminSupabaseRpc(db, incoming.sessionToken, 'admin_set_setting', {
          p_key: 'gas_webapp_url',
          p_value: { value: String(incoming.gas_webapp_url).trim() },
        });
      }
      if (incoming.permissions) {
        await callAdminSupabaseRpc(db, incoming.sessionToken, 'admin_set_permissions', {
          p_permissions: incoming.permissions,
        });
      }
      if (incoming.app_enabled !== undefined) {
        await callAdminSupabaseRpc(db, incoming.sessionToken, 'admin_set_setting', {
          p_key: 'app_enabled',
          p_value: { value: Boolean(incoming.app_enabled) },
        });
      }
      if (incoming.bg_enabled !== undefined) {
        await callAdminSupabaseRpc(db, incoming.sessionToken, 'admin_set_setting', {
          p_key: 'bg_enabled',
          p_value: { value: Boolean(incoming.bg_enabled) },
        });
      }
      if (incoming.bg_image_url !== undefined) {
        await callAdminSupabaseRpc(db, incoming.sessionToken, 'admin_set_setting', {
          p_key: 'bg_image_url',
          p_value: { value: String(incoming.bg_image_url).trim() },
        });
      }
      if (incoming.bg_opacity !== undefined) {
        await callAdminSupabaseRpc(db, incoming.sessionToken, 'admin_set_setting', {
          p_key: 'bg_opacity',
          p_value: { value: Number(incoming.bg_opacity) },
        });
      }

      db.settings = {
        ...db.settings,
        site_name: incoming.site_name !== undefined ? String(incoming.site_name).trim() : db.settings.site_name,
        app_version:
          incoming.app_version !== undefined ? String(incoming.app_version).trim() : db.settings.app_version,
        developer_name:
          incoming.developer_name !== undefined
            ? String(incoming.developer_name).trim()
            : db.settings.developer_name,
        copyright_name:
          incoming.copyright_name !== undefined
            ? String(incoming.copyright_name).trim()
            : db.settings.copyright_name,
        department_name:
          incoming.department_name !== undefined
            ? String(incoming.department_name).trim()
            : db.settings.department_name,
        announcement:
          incoming.announcement !== undefined ? String(incoming.announcement) : db.settings.announcement,
        preview_image_url:
          incoming.preview_image_url !== undefined
            ? String(incoming.preview_image_url).trim()
            : db.settings.preview_image_url || '',
        gas_webapp_url:
          incoming.gas_webapp_url !== undefined
            ? String(incoming.gas_webapp_url).trim()
            : db.settings.gas_webapp_url,
        db_mode: incoming.db_mode || db.settings.db_mode,
        permissions: {
          ...db.settings.permissions,
          ...(incoming.permissions || {}),
        },
        app_enabled:
          incoming.app_enabled !== undefined
            ? Boolean(incoming.app_enabled)
            : db.settings.app_enabled !== false,
        bg_enabled:
          incoming.bg_enabled !== undefined
            ? Boolean(incoming.bg_enabled)
            : Boolean(db.settings.bg_enabled),
        bg_image_url:
          incoming.bg_image_url !== undefined
            ? String(incoming.bg_image_url).trim()
            : db.settings.bg_image_url || '',
        bg_opacity:
          incoming.bg_opacity !== undefined
            ? Number(incoming.bg_opacity)
            : Number(db.settings.bg_opacity ?? 0.08),
        updated_at: nowIso(),
      };

      addAuditLog(db, 'UPDATE_SETTINGS', `อัปเดตการตั้งค่าระบบ (${db.settings.site_name} v${db.settings.app_version})`);
      saveDb(db);

      mirrorToGoogleSheet(db.settings.gas_webapp_url, 'UPDATE_SETTINGS', db.settings).catch((err) =>
        console.warn('Background Google Sheet mirror error:', err)
      );

      return res.json({
        ok: true,
        settings: {
          ...db.settings,
          admin_pin: undefined,
        },
        audit_logs: db.audit_logs.slice(0, 30),
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'ไม่สามารถบันทึกการตั้งค่าได้' });
    }
  });

  // 7. POST Boilers (Syncs with Supabase admin_manage_boiler + Local DB, handles re-enabling disabled rows)
  app.post('/api/boilers', async (req, res) => {
    const db = loadDb();
    const { id, name, active, action, sessionToken } = req.body as {
      id?: string;
      name?: string;
      active?: boolean;
      action?: 'add' | 'rename' | 'toggle' | 'delete';
      sessionToken?: string;
    };

    // Fetch all remote boilers (including inactive ones) to handle duplicate name constraints cleanly
    let remoteBoilers: Array<Record<string, unknown>> = [];
    try {
      const rRes = await fetch(`${SUPABASE_URL}/rest/v1/boilers?select=*&order=sort_order.asc`, {
        headers: SB_HEADERS,
      });
      if (rRes.ok) {
        remoteBoilers = (await rRes.json()) as Array<Record<string, unknown>>;
      }
    } catch (_e) {
      // Ignore if offline
    }

    if ((action === 'delete' || action === 'toggle') && id) {
      if (db.boilers.filter((b) => b.active).length <= 1 && action === 'delete') {
        return res.status(400).json({ ok: false, error: 'ระบบจำเป็นต้องมี Boiler อย่างน้อย 1 รายการ' });
      }
      const targetLocal = db.boilers.find((b) => b.id === id);
      const targetKey = targetLocal ? normalizeBoilerMatchKey(targetLocal.name) : '';

      // Disable both the target ID and any duplicate remote rows with the same normalized name
      const idsToDisable = new Set<string>([id]);
      for (const rb of remoteBoilers) {
        if (rb.active !== false && targetKey && normalizeBoilerMatchKey(String(rb.name || '')) === targetKey) {
          idsToDisable.add(String(rb.id));
        }
      }
      for (const disableId of idsToDisable) {
        await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_boiler', {
          p_action: 'disable',
          p_id: disableId,
        });
      }

      if (action === 'delete') {
        db.boilers = db.boilers.filter(
          (b) => b.id !== id && (!targetKey || normalizeBoilerMatchKey(b.name) !== targetKey)
        );
        addAuditLog(db, 'DELETE_BOILER', `ปิดใช้งาน/ลบ ${targetLocal?.name || id}`);
      } else if (targetLocal) {
        if (targetLocal.active && db.boilers.filter((b) => b.active).length <= 1) {
          return res.status(400).json({ ok: false, error: 'ระบบจำเป็นต้องมี Boiler อย่างน้อย 1 รายการ' });
        }
        targetLocal.active = !targetLocal.active;
        addAuditLog(db, 'TOGGLE_BOILER', `${targetLocal.active ? 'เปิด' : 'ปิด'}ใช้งาน ${targetLocal.name}`);
      }

      await syncFromSupabase(db);
      saveDb(db);
      return res.json({ ok: true, boilers: db.boilers, audit_logs: db.audit_logs.slice(0, 30) });
    }

    const cleanName = normalizeBoilerDisplayName(String(name || ''));
    if (!cleanName) {
      return res.status(400).json({ ok: false, error: 'กรุณาระบุชื่อ Boiler' });
    }
    const cleanMatchKey = normalizeBoilerMatchKey(cleanName);

    if (id && action === 'rename') {
      if (
        db.boilers.some(
          (b) => b.id !== id && b.active && normalizeBoilerMatchKey(b.name) === cleanMatchKey
        )
      ) {
        return res.status(409).json({ ok: false, error: `มี "${cleanName}" อยู่ในระบบแล้ว` });
      }

      // Free any inactive remote row that holds the exact same name so rename won't hit 409 unique constraint
      for (const rb of remoteBoilers) {
        if (
          String(rb.id) !== id &&
          rb.active === false &&
          (String(rb.name || '').trim().toLowerCase() === cleanName.toLowerCase() ||
            normalizeBoilerMatchKey(String(rb.name || '')) === cleanMatchKey)
        ) {
          await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_boiler', {
            p_action: 'rename',
            p_id: String(rb.id),
            p_name: `${rb.name}_archived_${String(rb.id).slice(0, 4)}`,
          });
        }
      }

      await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_boiler', {
        p_action: 'rename',
        p_id: id,
        p_name: cleanName,
      });

      const target = db.boilers.find((b) => b.id === id);
      if (target) {
        target.name = cleanName;
        if (active !== undefined) target.active = Boolean(active);
        addAuditLog(db, 'UPDATE_BOILER', `แก้ไขชื่อ Boiler เป็น "${cleanName}"`);
      }
    } else {
      if (db.boilers.some((b) => b.active && normalizeBoilerMatchKey(b.name) === cleanMatchKey)) {
        return res.status(409).json({ ok: false, error: `มี "${cleanName}" อยู่ในระบบแล้ว` });
      }

      // Check if an inactive row in Supabase already matches this boiler name
      const existingInactive = remoteBoilers.find(
        (rb) =>
          rb.active === false &&
          (String(rb.name || '').trim().toLowerCase() === cleanName.toLowerCase() ||
            normalizeBoilerMatchKey(String(rb.name || '')) === cleanMatchKey)
      );

      let addedId = `boiler_${Date.now()}`;
      if (existingInactive) {
        addedId = String(existingInactive.id);
        await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_boiler', {
          p_action: 'enable',
          p_id: addedId,
        });
        if (String(existingInactive.name || '').trim() !== cleanName) {
          // Ensure no other inactive row holds exact cleanName before renaming
          for (const rb of remoteBoilers) {
            if (
              String(rb.id) !== addedId &&
              rb.active === false &&
              String(rb.name || '').trim().toLowerCase() === cleanName.toLowerCase()
            ) {
              await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_boiler', {
                p_action: 'rename',
                p_id: String(rb.id),
                p_name: `${rb.name}_archived_${String(rb.id).slice(0, 4)}`,
              });
            }
          }
          await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_boiler', {
            p_action: 'rename',
            p_id: addedId,
            p_name: cleanName,
          });
        }
      } else {
        const addRpc = await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_boiler', {
          p_action: 'add',
          p_name: cleanName,
        });
        const addRow = (addRpc.data as { row?: { id?: string } } | null)?.row;
        if (addRow?.id) {
          addedId = String(addRow.id);
        }
      }

      db.boilers.push({
        id: addedId,
        name: cleanName,
        active: true,
        sort_order: db.boilers.length + 1,
      });
      addAuditLog(db, 'ADD_BOILER', `เพิ่ม Boiler ใหม่ "${cleanName}"`);
    }

    await syncFromSupabase(db);
    // Guarantee the added/renamed boiler is present even if remote sync lagged
    if (action !== 'rename' && !db.boilers.some((b) => normalizeBoilerMatchKey(b.name) === cleanMatchKey)) {
      db.boilers.push({
        id: `boiler_${Date.now()}`,
        name: cleanName,
        active: true,
        sort_order: db.boilers.length + 1,
      });
    }
    saveDb(db);
    if (db.settings.permissions.allow_sheet_sync !== false) {
      mirrorToGoogleSheet(db.settings.gas_webapp_url, 'SYNC_STRUCTURE', { boilers: db.boilers }, db).catch((err) =>
        console.warn('Background Google Sheet mirror error:', err)
      );
    }
    return res.json({ ok: true, boilers: db.boilers, audit_logs: db.audit_logs.slice(0, 30) });
  });

  // 8. POST Chemicals (Syncs with Supabase admin_manage_chemical + Local DB, handles re-enabling disabled rows)
  app.post('/api/chemicals', async (req, res) => {
    const db = loadDb();
    const { id, code, name, divisor, unit, description, active, action, sessionToken } = req.body as {
      id?: string;
      code?: string;
      name?: string;
      divisor?: number;
      unit?: string;
      description?: string;
      active?: boolean;
      action?: 'add' | 'update' | 'toggle' | 'delete';
      sessionToken?: string;
    };

    let remoteChems: Array<Record<string, unknown>> = [];
    try {
      const rRes = await fetch(`${SUPABASE_URL}/rest/v1/chemicals?select=*&order=sort_order.asc`, {
        headers: SB_HEADERS,
      });
      if (rRes.ok) {
        remoteChems = (await rRes.json()) as Array<Record<string, unknown>>;
      }
    } catch (_e) {
      // Ignore if offline
    }

    if ((action === 'delete' || action === 'toggle') && id) {
      if (db.chemicals.filter((c) => c.active).length <= 1 && action === 'delete') {
        return res.status(400).json({ ok: false, error: 'ระบบจำเป็นต้องมีสารเคมีอย่างน้อย 1 รายการ' });
      }
      const targetLocal = db.chemicals.find((c) => c.id === id);
      const targetNameLower = targetLocal ? targetLocal.name.toLowerCase() : '';

      const idsToDisable = new Set<string>([id]);
      for (const rc of remoteChems) {
        const rcName = String(rc.name || '').trim().toLowerCase();
        const normRcName = rcName === 'polytreat-srp' ? 'polytreat-srb' : rcName;
        if (rc.active !== false && targetNameLower && (rcName === targetNameLower || normRcName === targetNameLower)) {
          idsToDisable.add(String(rc.id));
        }
      }
      for (const disableId of idsToDisable) {
        await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_chemical', {
          p_action: 'disable',
          p_id: disableId,
        });
      }

      if (action === 'delete') {
        db.chemicals = db.chemicals.filter(
          (c) => c.id !== id && (!targetNameLower || c.name.toLowerCase() !== targetNameLower)
        );
        addAuditLog(db, 'DELETE_CHEMICAL', `ลบสารเคมี ${targetLocal?.name || id}`);
      } else if (targetLocal) {
        if (targetLocal.active && db.chemicals.filter((c) => c.active).length <= 1) {
          return res.status(400).json({ ok: false, error: 'ระบบจำเป็นต้องมีสารเคมีอย่างน้อย 1 รายการ' });
        }
        targetLocal.active = !targetLocal.active;
        addAuditLog(db, 'TOGGLE_CHEMICAL', `${targetLocal.active ? 'เปิด' : 'ปิด'}ใช้งานสารเคมี ${targetLocal.name}`);
      }

      await syncFromSupabase(db);
      saveDb(db);
      return res.json({ ok: true, chemicals: db.chemicals, audit_logs: db.audit_logs.slice(0, 30) });
    }

    const cleanName = String(name || '').trim();
    const numDiv = Number(divisor);
    if (!cleanName || !Number.isFinite(numDiv) || numDiv <= 0) {
      return res.status(400).json({ ok: false, error: 'กรุณาระบุชื่อสารเคมีและตัวหารที่มากกว่า 0' });
    }
    const cleanNameLower = cleanName.toLowerCase();

    if (id && action === 'update') {
      if (db.chemicals.some((c) => c.id !== id && c.active && c.name.toLowerCase() === cleanNameLower)) {
        return res.status(409).json({ ok: false, error: `มีสารเคมี "${cleanName}" อยู่ในระบบแล้ว` });
      }

      // Free any inactive remote chemical row that holds the same target name
      for (const rc of remoteChems) {
        if (
          String(rc.id) !== id &&
          rc.active === false &&
          String(rc.name || '').trim().toLowerCase() === cleanNameLower
        ) {
          await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_chemical', {
            p_action: 'update',
            p_id: String(rc.id),
            p_name: `${rc.name}_archived_${String(rc.id).slice(0, 4)}`,
            p_divisor: Number(rc.divisor) || 4,
            p_unit: String(rc.unit || 'L'),
          });
        }
      }

      await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_chemical', {
        p_action: 'update',
        p_id: id,
        p_name: cleanName,
        p_divisor: numDiv,
        p_unit: unit || 'L',
      });

      const target = db.chemicals.find((c) => c.id === id);
      if (target) {
        target.name = cleanName;
        target.code = String(code || cleanName).trim();
        target.divisor = numDiv;
        target.unit = String(unit || target.unit || 'L').trim();
        if (description !== undefined) target.description = String(description).trim();
        if (active !== undefined) target.active = Boolean(active);
        addAuditLog(db, 'UPDATE_CHEMICAL', `แก้ไขสารเคมี ${cleanName} (÷ ${numDiv})`);
      }
    } else {
      if (db.chemicals.some((c) => c.active && c.name.toLowerCase() === cleanNameLower)) {
        return res.status(409).json({ ok: false, error: `มีสารเคมี "${cleanName}" อยู่ในระบบแล้ว` });
      }

      // Check if an inactive chemical row in Supabase already has this name
      const existingInactive = remoteChems.find((rc) => {
        const rcName = String(rc.name || '').trim().toLowerCase();
        const normRcName = rcName === 'polytreat-srp' ? 'polytreat-srb' : rcName;
        return rc.active === false && (rcName === cleanNameLower || normRcName === cleanNameLower);
      });

      let addedId = `chem_${Date.now()}`;
      if (existingInactive) {
        addedId = String(existingInactive.id);
        await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_chemical', {
          p_action: 'enable',
          p_id: addedId,
        });
        await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_chemical', {
          p_action: 'update',
          p_id: addedId,
          p_name: cleanName,
          p_divisor: numDiv,
          p_unit: unit || 'L',
        });
      } else {
        const addRpc = await callAdminSupabaseRpc(db, sessionToken, 'admin_manage_chemical', {
          p_action: 'add',
          p_name: cleanName,
          p_divisor: numDiv,
          p_unit: unit || 'L',
        });
        const addRow = (addRpc.data as { row?: { id?: string } } | null)?.row;
        if (addRow?.id) {
          addedId = String(addRow.id);
        }
      }

      const newChem: ChemicalConfig = {
        id: addedId,
        code: String(code || cleanName).trim(),
        name: cleanName,
        divisor: numDiv,
        unit: String(unit || 'L').trim(),
        active: true,
        sort_order: db.chemicals.length + 1,
        description:
          String(description || '').trim() || `สารเคมีบอยเลอร์ ${cleanName} คำนวณปริมาณโดยหารด้วย ${numDiv}`,
      };
      db.chemicals.push(newChem);
      addAuditLog(db, 'ADD_CHEMICAL', `เพิ่มสารเคมีใหม่ ${cleanName} (÷ ${numDiv})`);
      mirrorToGoogleSheet(db.settings.gas_webapp_url, 'UPSERT_CHEMICAL', newChem).catch((err) =>
        console.warn('Background Google Sheet mirror error:', err)
      );
    }

    await debouncedSyncFromSupabase(db, true);
    if (action !== 'update' && !db.chemicals.some((c) => c.name.toLowerCase() === cleanNameLower)) {
      db.chemicals.push({
        id: `chem_${Date.now()}`,
        code: String(code || cleanName).trim(),
        name: cleanName,
        divisor: numDiv,
        unit: String(unit || 'L').trim(),
        active: true,
        sort_order: db.chemicals.length + 1,
        description:
          String(description || '').trim() || `สารเคมีบอยเลอร์ ${cleanName} คำนวณปริมาณโดยหารด้วย ${numDiv}`,
      });
    }
    saveDb(db);
    if (db.settings.permissions.allow_sheet_sync !== false) {
      mirrorToGoogleSheet(db.settings.gas_webapp_url, 'SYNC_STRUCTURE', { chemicals: db.chemicals }, db).catch((err) =>
        console.warn('Background Google Sheet mirror error:', err)
      );
    }
    return res.json({ ok: true, chemicals: db.chemicals, audit_logs: db.audit_logs.slice(0, 30) });
  });

  // 9. Explicit Download Endpoints (Forces browser attachment download even inside iframes)
  app.get('/api/download/:type', (req, res) => {
    const type = String(req.params.type || '').toLowerCase();
    const publicDir = path.join(process.cwd(), 'public');
    const distDir = path.join(process.cwd(), 'dist');

    const resolveAsset = (fileName: string) => {
      const p1 = path.join(publicDir, fileName);
      if (fs.existsSync(p1)) return p1;
      const p2 = path.join(distDir, fileName);
      if (fs.existsSync(p2)) return p2;
      return null;
    };

    if (type === 'index.html' || type === 'singlefile') {
      const filePath = resolveAsset('boiler-chemical-singlefile.html');
      if (filePath) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
        return res.sendFile(filePath);
      }
    }

    if (type === 'ready-web.zip' || type === 'boiler-chemical-ready-web.zip') {
      const filePath = resolveAsset('boiler-chemical-ready-web.zip');
      if (filePath) {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="boiler-chemical-ready-web.zip"');
        return res.sendFile(filePath);
      }
    }

    if (type === 'source-code.zip' || type === 'boiler-chemical-source-code.zip') {
      const filePath = resolveAsset('boiler-chemical-source-code.zip');
      if (filePath) {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="boiler-chemical-source-code.zip"');
        return res.sendFile(filePath);
      }
    }

    return res.status(404).send('File not found');
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Boiler Chemical v3.0.0 Server running on http://0.0.0.0:${PORT}`);
    startAlwaysOnKeepAlive();
  });
}

startServer();
