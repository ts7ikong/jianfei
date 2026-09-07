// IndexedDB layer for 30-day reset system
const DB_NAME = "reset30";
const DB_VER  = 2;

const STORES = {
  RECORDS:  "daily_records",
  PLANS:    "plan_versions",
  AI_HIST:  "ai_history",
};

let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORES.RECORDS)) {
        const s = db.createObjectStore(STORES.RECORDS, { keyPath: "date" });
        s.createIndex("day", "day");
      }
      if (!db.objectStoreNames.contains(STORES.PLANS)) {
        db.createObjectStore(STORES.PLANS, { keyPath: "version" });
      }
      if (!db.objectStoreNames.contains(STORES.AI_HIST)) {
        const s = db.createObjectStore(STORES.AI_HIST, { keyPath: "id", autoIncrement: true });
        s.createIndex("day", "day");
      }
    };

    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

function tx(storeName, mode = "readonly") {
  return _db.transaction(storeName, mode).objectStore(storeName);
}

function wrap(req) {
  return new Promise((res, rej) => {
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

// ── daily records ─────────────────────────────────────────────
async function getRecord(date) {
  await openDB();
  return wrap(tx(STORES.RECORDS).get(date));
}

async function saveRecord(record) {
  await openDB();
  return wrap(tx(STORES.RECORDS, "readwrite").put(record));
}

async function getAllRecords() {
  await openDB();
  return wrap(tx(STORES.RECORDS).getAll());
}

async function getOrCreateRecord(date, day) {
  const existing = await getRecord(date);
  if (existing) return existing;
  const fresh = emptyDayRecord(date, day);
  await saveRecord(fresh);
  return fresh;
}

// ── plan versions ─────────────────────────────────────────────
async function savePlanVersion(pv) {
  await openDB();
  return wrap(tx(STORES.PLANS, "readwrite").put(pv));
}

async function getAllPlanVersions() {
  await openDB();
  const all = await wrap(tx(STORES.PLANS).getAll());
  return all.sort((a, b) => a.version.localeCompare(b.version));
}

async function getLatestPlanVersion() {
  const all = await getAllPlanVersions();
  return all.length ? all[all.length - 1] : null;
}

// ── AI history ────────────────────────────────────────────────
async function saveAIHistory(entry) {
  await openDB();
  return wrap(tx(STORES.AI_HIST, "readwrite").add(entry));
}

async function getAllAIHistory() {
  await openDB();
  const all = await wrap(tx(STORES.AI_HIST).getAll());
  return all.sort((a, b) => b.id - a.id);
}

// ── trend helpers ─────────────────────────────────────────────
async function getTrendData() {
  const records = await getAllRecords();
  records.sort((a, b) => a.date.localeCompare(b.date));

  const days      = records.map(r => r.day);
  const weight    = records.map(r => r.body?.weight_kg);
  const waist     = records.map(r => r.body?.waist_cm);
  const sleep_h   = records.map(r => r.sleep?.duration_hours);
  const face_oil  = records.map(r => r.skin?.face_oiliness);
  const scalp_oil = records.map(r => r.scalp?.oiliness);
  const hair      = records.map(r => r.scalp?.hair_shedding);
  const dry_mouth = records.map(r => r.other?.dry_mouth);
  const scrotal   = records.map(r => r.other?.scrotal_moisture);
  const exercise  = records.map(r => r.exercise?.actual_minutes);
  const completion= records.map(r => completionRate(r));

  return { days, weight, waist, sleep_h, face_oil, scalp_oil, hair,
           dry_mouth, scrotal, exercise, completion, records };
}

async function get7DayAvgs() {
  const { records } = await getTrendData();
  if (!records.length) return null;
  const last7 = records.slice(-7);
  const avg = key => {
    const vals = last7.map(r => key(r)).filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
  };
  return {
    weight:   avg(r => r.body?.weight_kg),
    waist:    avg(r => r.body?.waist_cm),
    sleep:    avg(r => r.sleep?.duration_hours),
    face_oil: avg(r => r.skin?.face_oiliness),
    scalp:    avg(r => r.scalp?.oiliness),
    completion: Math.round(last7.map(r => completionRate(r)).reduce((a,b) => a+b, 0) / last7.length),
  };
}

// ── export helpers ────────────────────────────────────────────
async function exportAllJSON() {
  const records = await getAllRecords();
  const plans   = await getAllPlanVersions();
  const ai      = await getAllAIHistory();
  return JSON.stringify({ baseline: PLAN.baseline, records, plans, ai }, null, 2);
}
