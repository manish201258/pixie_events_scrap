require("dotenv").config();
const cron = require("node-cron");
const { scrapeCityEvents } = require("./scraper");
const { upsertEvents } = require("./storage");
const config = require("./config");
const { normalizeEvent, cleanCellValue } = require("./normalize");

function extractCityFromVenue(venue) {
  if (!venue) return null;
  const v = venue.toLowerCase();
  
  if (v.includes("delhi/ncr") || v.includes("new delhi") || (v.includes("delhi") && !v.includes("gurugram"))) {
    return "delhi-ncr";
  }
  if (v.includes("gurugram")) return "gurugram";
  if (v.includes("noida")) return "noida";
  if (v.includes("jaipur")) return "jaipur";
  if (v.includes("mumbai")) return "mumbai";
  if (v.includes("bengaluru") || v.includes("bangalore")) return "bengaluru";
  if (v.includes("hyderabad")) return "hyderabad";
  
  return null;
}

async function runOnce() {
  const city = config.city;
  console.log(`\n[RUN] Starting scrape for city="${city}"`);

  const events = await scrapeCityEvents(city);
  const normalizedEvents = events
    .map((ev) => {
      const rawText = cleanCellValue(
        [ev.date, ev.event_name, ev.venue].filter(Boolean).join(" ")
      );
      const norm = normalizeEvent(rawText);
      const venue = norm.venue || cleanCellValue(ev.venue);
      const detectedCity = extractCityFromVenue(venue);
      
      return {
        event_name: norm.event_name || cleanCellValue(ev.event_name),
        date: norm.date || cleanCellValue(ev.date),
        venue: venue,
        city: detectedCity,
        category: norm.category || cleanCellValue(ev.category),
        url: cleanCellValue(ev.url)
      };
    })
    .filter((ev) => {
      if (!ev.city) {
        if (config.verbose) {
          console.log(`[FILTER] Event "${ev.event_name}" has no detected city, venue: "${ev.venue}"`);
        }
        return false;
      }
      const evCity = ev.city.toLowerCase();
      const targetCity = city.toLowerCase();
      
      if (evCity === targetCity) return true;
      
      if (targetCity === "delhi" && (evCity === "delhi-ncr" || evCity.includes("delhi"))) return true;
      if (targetCity === "delhi-ncr" && evCity.includes("delhi")) return true;
      
      if (config.verbose) {
        console.log(`[FILTER] Event "${ev.event_name}" city="${evCity}" doesn't match target="${targetCity}"`);
      }
      return false;
    });

  console.log(`[RUN] Scraped ${events.length} raw events, ${normalizedEvents.length} filtered for city="${city}". Updating Excel...`);

  const summary = upsertEvents(config.outputFile, config.sheetName, normalizedEvents, city);

  console.log(
    `[RUN] Excel update complete. total=${summary.total}, active=${summary.active}, expired=${summary.expired}`
  );
}

function startScheduler() {
  console.log(
    `[SCHEDULER] Starting with cron="${config.schedule}" for city="${config.city}". ` +
      `Excel file="${config.outputFile}".`
  );

  cron.schedule(config.schedule, () => {
    runOnce().catch((err) => {
      console.error("[SCHEDULER] Run failed:", err.message);
    });
  });
}

// CLI mode: if --once is passed, just run once and exit, else start scheduler
if (process.argv.includes("--once")) {
  runOnce().catch((err) => {
    console.error("[MAIN] Error in one-off run:", err);
    process.exit(1);
  });
} else {
  startScheduler();
}

