const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { cleanCellValue } = require("./normalize");

function ensureWorkbook(filePath, sheetName) {
  let workbook;

  if (fs.existsSync(filePath)) {
    workbook = XLSX.readFile(filePath);
  } else {
    workbook = XLSX.utils.book_new();
  }

  let worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    const headers = [
      "id",
      "event_name",
      "date",
      "venue",
      "city",
      "category",
      "url",
      "status",
      "last_seen_at"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    worksheet = ws;
  }

  return { workbook, worksheet };
}

function readRows(worksheet) {
  const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  return json;
}

function writeRows(workbook, sheetName, rows, filePath) {
  const ws = XLSX.utils.json_to_sheet(rows);
  workbook.Sheets[sheetName] = ws;
  if (!workbook.SheetNames.includes(sheetName)) {
    workbook.SheetNames.push(sheetName);
  }
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      XLSX.writeFile(workbook, filePath);
      return;
    } catch (err) {
      const code = err && err.code;
      if (code !== "EBUSY" || attempt === maxAttempts) {
        throw err;
      }
      const waitMs = 400 * attempt;
      const end = Date.now() + waitMs;
      while (Date.now() < end) {
      }
    }
  }
}

function buildDedupKey(ev) {
  const name = cleanCellValue(ev.event_name).toLowerCase();
  const date = cleanCellValue(ev.date).toLowerCase();
  const venue = cleanCellValue(ev.venue).toLowerCase();
  const city = cleanCellValue(ev.city).toLowerCase();
  return `${city}||${name}||${date}||${venue}`;
}

function isPastEvent(dateValue) {
  const d = cleanCellValue(dateValue);
  if (!d) return false;

  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.getTime() < Date.now();
}

function upsertEvents(filePath, sheetName, scrapedEvents, city) {
  const absPath = path.resolve(filePath);
  const { workbook, worksheet } = ensureWorkbook(absPath, sheetName);
  const existingRows = readRows(worksheet);

  const nowIso = new Date().toISOString();

  const byKey = new Map();
  for (const row of existingRows) {
    const key = buildDedupKey(row);
    if (key !== "||||" && !byKey.has(key)) {
      byKey.set(key, row);
    }
  }

  const seenKeys = new Set();

  for (const ev of scrapedEvents) {
    const cleanEvent = {
      event_name: cleanCellValue(ev.event_name),
      date: cleanCellValue(ev.date),
      venue: cleanCellValue(ev.venue),
      city: cleanCellValue(ev.city || city),
      category: cleanCellValue(ev.category) || "Other",
      url: cleanCellValue(ev.url),
      status: "active",
      last_seen_at: nowIso
    };

    const key = buildDedupKey(cleanEvent);
    if (key === "||||") continue;
    seenKeys.add(key);

    if (byKey.has(key)) {
      const existing = byKey.get(key);
      existing.event_name = cleanEvent.event_name;
      existing.date = cleanEvent.date;
      existing.venue = cleanEvent.venue;
      existing.city = cleanEvent.city;
      existing.category = cleanEvent.category;
      existing.url = cleanEvent.url || existing.url;
      existing.last_seen_at = nowIso;
      existing.status = isPastEvent(existing.date) ? "expired" : "active";
    } else {
      const newRow = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ...cleanEvent
      };
      newRow.status = isPastEvent(newRow.date) ? "expired" : "active";
      existingRows.push(newRow);
      byKey.set(key, newRow);
    }
  }

  for (const row of existingRows) {
    const rowCity = cleanCellValue(row.city);
    const key = buildDedupKey(row);

    const shouldExpireByNotSeen =
      rowCity === city && key !== "||||" && !seenKeys.has(key);

    const shouldExpireByPastDate = isPastEvent(row.date);

    row.status = (shouldExpireByNotSeen || shouldExpireByPastDate) ? "expired" : "active";

    row.event_name = cleanCellValue(row.event_name);
    row.date = cleanCellValue(row.date);
    row.venue = cleanCellValue(row.venue);
    row.city = cleanCellValue(row.city);
    row.category = cleanCellValue(row.category);
    row.url = cleanCellValue(row.url);
    row.last_seen_at = cleanCellValue(row.last_seen_at);
  }

  writeRows(workbook, sheetName, existingRows, absPath);
  return {
    total: existingRows.length,
    active: existingRows.filter((r) => r.status === "active").length,
    expired: existingRows.filter((r) => r.status === "expired").length
  };
}

module.exports = {
  upsertEvents
};

