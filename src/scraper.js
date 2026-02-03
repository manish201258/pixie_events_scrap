const axios = require("axios");
const cheerio = require("cheerio");
const { baseUrl, verbose } = require("./config");

function buildCityUrl(city) {
  return `${baseUrl}/events/`;
}

async function scrapeCityEvents(city) {
  const url = buildCityUrl(city);

  if (verbose) {
    console.log(`[SCRAPER] Fetching events for city="${city}" from ${url}`);
  }

  let html;
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
      },
      timeout: 15000
    });
    html = res.data;
  } catch (err) {
    console.error("[SCRAPER] Failed to fetch page:", err.message);
    return [];
  }

  const $ = cheerio.load(html);
  const events = [];

  const candidateCards = [];

  $(".event-card, .EventCard, [data-testid='event-card']").each((_, el) => {
    candidateCards.push(el);
  });

  $("a").each((_, el) => {
    const text = $(el).text();
    if (/book tickets/i.test(text)) {
      candidateCards.push(el);
    }
  });

  const seenUrls = new Set();

  candidateCards.forEach((el) => {
    let href = $(el).attr("href");
    if (!href) return;

    if (href.startsWith("/")) {
      href = baseUrl.replace(/\/$/, "") + href;
    }

    if (seenUrls.has(href)) {
      return;
    }
    seenUrls.add(href);

    const raw = $(el).text().replace(/\s+/g, " ").trim();
    if (!raw) return;

    let date = null;
    let eventName = null;
    let venue = null;

    // Extract price marker to help split
    const priceIdx = raw.indexOf("₹");
    const beforePrice = priceIdx > -1 ? raw.slice(0, priceIdx) : raw;

    // Try to split on "Book tickets" to remove trailing duplicate title
    const cleaned = beforePrice.split(/Book tickets/i)[0];

    // Simple heuristic: first comma-separated segment(s) = date, then title, then venue
    // We'll look for patterns like "Sat, 14 Mar" or time markers ("AM"/"PM")
    const timeMatch = cleaned.match(/\b(AM|PM)\b/i);
    if (timeMatch) {
      const timeEnd = timeMatch.index + timeMatch[0].length;
      date = cleaned.slice(0, timeEnd).trim();
      const rest = cleaned.slice(timeEnd).trim();

      // venue often ends with city markers like "Delhi/NCR", "Gurugram", "Noida"
      const cityMarkers = ["Delhi/NCR", "Gurugram", "Noida", "New Delhi", "Delhi"];
      let venueIdx = -1;
      let cityFound = null;
      for (const marker of cityMarkers) {
        const idx = rest.indexOf(marker);
        if (idx !== -1 && (venueIdx === -1 || idx < venueIdx)) {
          venueIdx = idx;
          cityFound = marker;
        }
      }

      if (venueIdx !== -1) {
        eventName = rest.slice(0, venueIdx).trim();
        venue = rest.slice(venueIdx).trim();
      } else {
        // Fallback: split by last pipe or dash
        const parts = rest.split("|");
        if (parts.length >= 2) {
          eventName = parts[0].trim();
          venue = parts[1].trim();
        } else {
          eventName = rest;
        }
      }
    } else {
      // Fallback: cannot confidently separate, treat entire string as name
      eventName = raw;
    }

    if (!eventName) return;

    events.push({
      event_name: eventName,
      date,
      venue,
      category: null,
      url: href
    });
  });

  if (verbose) {
    console.log(`[SCRAPER] Extracted ${events.length} events for city="${city}"`);
  }

  return events;
}

module.exports = {
  scrapeCityEvents
};

