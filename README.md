## Pixie Event Discovery & Tracking Tool (Node.js Prototype)

This is an **Option B–style working prototype** that you can use as the core of your assignment.
It focuses on **BookMyShow-style scraping for one city**, **Excel storage**, and a **cron-like scheduler**.

### 1. Tech Stack & Setup

- **Backend**: Node.js (Axios + Cheerio for scraping, node-cron for scheduling)
- **Storage**: Local Excel file using the `xlsx` library
- **Scheduling**: `node-cron` with a configurable cron expression

#### Install & Run

```bash
npm install

# One-off scrape for the default city (mumbai)
node src/index.js --once

# Or start the scheduler (runs in the background according to cron)
node src/index.js
```

Environment variables (optional):

- `SCRAPER_CITY` – e.g. `delhi`, `pune`, etc. (default: `mumbai`)
- `SCRAPER_CRON` – cron expression, e.g. `0 */6 * * *` to run every 6 hours

### 2. Functional Requirements Mapping

- **Data extraction**
  - Platform: `BookMyShow`-style public event listing (HTML scraping via Axios + Cheerio).
  - Fields collected: `event_name`, `date`, `venue`, `city`, `category`, `url`, `status`, `last_seen_at`.
- **City selection logic**
  - City is read from `SCRAPER_CITY` environment variable or falls back to `"mumbai"`.
  - URL pattern is built as `https://in.bookmyshow.com/explore/events-{city}` (adjustable in `config.js`).
- **Data storage**
  - Excel file: `events.xlsx`.
  - Sheet: `events`, with columns:
    - `id`, `event_name`, `date`, `venue`, `city`, `category`, `url`, `status`, `last_seen_at`.
  - **Deduplication**: `url` is treated as a unique key. If the same URL is seen again:
    - The existing row is updated instead of inserting a new one.
  - **Expiry handling**:
    - On each run, events for that city that are **not** seen anymore are marked as `status = "expired"`.
    - New or still-visible events are marked `status = "active"` with updated `last_seen_at`.
- **Automation & scheduling**
  - `node-cron` is used with a cron expression from `SCRAPER_CRON`.
  - Each scheduled run:
    1. Scrapes events for the configured city.
    2. Upserts into the Excel sheet (add new, update existing, mark expired).
- **Scalability & reliability**
  - **Handling site changes**:
    - Scraper selectors in `scraper.js` are centralized and documented, so if BookMyShow changes HTML, only that file needs updates.
  - **Error handling**:
    - Network/HTTP errors are caught and logged; the script returns an empty list instead of crashing.
    - Scheduler catches run errors and logs them without stopping future scheduled executions.

### 3. Files Overview

- `src/config.js`
  - Central configuration for city, Excel file name, sheet name, cron expression, and base URL.
- `src/scraper.js`
  - Uses Axios to fetch the HTML and Cheerio to parse event cards.
  - Extracts event fields defensively with multiple selectors.
- `src/storage.js`
  - Handles Excel read/write, deduplication by URL, and expiry logic.
- `src/index.js`
  - Entry point. Supports:
    - `--once` for a single run.
    - Default mode for starting the cron scheduler.

### 4. How to Present in Your Assignment PDF

In your 2-page PDF, you can briefly describe:

- **Mandatory Question**: State which of web scraping, cron, Excel, APIs you have used, and mention this tool as your example.
- **Architecture**:
  - One diagram or bullet list: *Scraper (Axios + Cheerio) → Processor (dedup + expiry) → Excel (xlsx) → Cron (node-cron)*.
- **Tradeoffs**:
  - Scraping vs. official APIs (BookMyShow does not provide a public API; scraping is brittle but practical).
  - Local Excel vs. Google Sheets (Excel is simple for a prototype; Google Sheets would need OAuth/API setup).
- **Scalability ideas**:
  - Add multiple cities via a loop over a city list.
  - Switch storage to a database (e.g., Postgres) or Google Sheets API.
  - Containerize with Docker and run via a cloud scheduler.

