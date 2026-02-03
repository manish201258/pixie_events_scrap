const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

function cleanCellValue(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return s.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseDateToIso(dateDisplay) {
  const display = cleanCellValue(dateDisplay);
  if (!display) return { display: "", iso: "" };

  const firstPart = display.split("–")[0].trim();

  const m = firstPart.match(
    /^(?:[A-Za-z]{3,9},\s*)?(\d{1,2})\s+([A-Za-z]{3,9})(?:,\s*(\d{1,2}):(\d{2})\s*(AM|PM))?/i
  );
  if (!m) return { display, iso: "" };

  const day = Number(m[1]);
  const monKey = m[2].toLowerCase();
  const month = MONTHS[monKey];
  if (month === undefined || Number.isNaN(day)) return { display, iso: "" };

  let hours = 0;
  let minutes = 0;
  if (m[3] && m[4] && m[5]) {
    hours = Number(m[3]);
    minutes = Number(m[4]);
    const ampm = m[5].toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
  }

  const now = new Date();
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), month, day, hours, minutes, 0));
  const sixMonthsMs = 1000 * 60 * 60 * 24 * 183;
  if (now.getTime() - candidate.getTime() > sixMonthsMs) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  }

  return { display, iso: candidate.toISOString() };
}

function inferCategory(text) {
  const t = cleanCellValue(text).toLowerCase();
  if (!t) return "Other";

  if (/(music|concert|gig|live)/i.test(t)) return "Music";
  if (/(comedy|standup|stand-up)/i.test(t)) return "Comedy";
  if (/(workshop|class|training)/i.test(t)) return "Workshop";
  if (/(festival)/i.test(t)) return "Festival";
  return "Other";
}

function normalizeEvent(rawText) {
  const raw = cleanCellValue(rawText);
  if (!raw) {
    return {
      event_name: "",
      date: "",
      venue: "",
      category: "Other"
    };
  }

  const withoutPrice = raw.split("₹")[0];
  const withoutBookTickets = withoutPrice.replace(/book tickets/gi, "").trim();

  const datePrefixMatch = withoutBookTickets.match(
    /^(?:[A-Za-z]{3,9},\s*)?\d{1,2}\s+[A-Za-z]{3,9}(?:\s*[–-]\s*(?:[A-Za-z]{3,9},\s*)?\d{1,2}\s+[A-Za-z]{3,9})?(?:,\s*\d{1,2}:\d{2}\s*(?:AM|PM))?/i
  );

  let dateDisplay = "";
  let rest = withoutBookTickets;
  if (datePrefixMatch) {
    dateDisplay = cleanCellValue(datePrefixMatch[0]);
    rest = cleanCellValue(withoutBookTickets.slice(datePrefixMatch[0].length));
  }

  const { iso: dateIso } = parseDateToIso(dateDisplay);
  const date = dateIso || dateDisplay;
  let venue = "";

  const venueKeywordMatch = rest.match(/\bVenue\b\s*(.*)$/i);
  if (venueKeywordMatch && venueKeywordMatch[1]) {
    venue = cleanCellValue(venueKeywordMatch[1]);
  } else {
    const regionMarkers = ["Delhi/NCR", "Gurugram", "Noida", "Jaipur", "Mumbai", "Bengaluru", "Hyderabad"];
    const lowerRest = rest.toLowerCase();
    let bestIdx = -1;
    for (const marker of regionMarkers) {
      const idx = lowerRest.indexOf(marker.toLowerCase());
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
    }

    if (bestIdx !== -1) {
      venue = cleanCellValue(rest.slice(bestIdx));
      rest = cleanCellValue(rest.slice(0, bestIdx));
    } else {
      const lastComma = rest.lastIndexOf(",");
      if (lastComma !== -1) {
        venue = cleanCellValue(rest.slice(lastComma + 1));
        rest = cleanCellValue(rest.slice(0, lastComma));
      }
    }
  }

  let event_name = cleanCellValue(rest);
  if (venue && event_name.toLowerCase().includes(venue.toLowerCase())) {
    event_name = cleanCellValue(event_name.replace(new RegExp(venue, "i"), ""));
  }

  // Remove leading separators
  event_name = cleanCellValue(event_name.replace(/^[\-\|\:]+/, ""));

  const category = inferCategory(event_name);

  return {
    event_name,
    date,
    venue,
    category
  };
}

module.exports = {
  normalizeEvent,
  cleanCellValue
};

