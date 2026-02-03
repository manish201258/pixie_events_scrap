const city = process.env.SCRAPER_CITY;

if (!city) {
  throw new Error("Missing SCRAPER_CITY in .env file. Please set a city.");
}

module.exports = {
  city: city.trim(),

  outputFile: process.env.OUTPUT_FILE || "events.xlsx",

  sheetName: process.env.SHEET_NAME || "events",

  schedule: process.env.SCRAPER_CRON || "0 */6 * * *",

  baseUrl: process.env.BASE_URL || "https://www.district.in",

  verbose: process.env.VERBOSE === "true" || process.env.VERBOSE === "1"
};


