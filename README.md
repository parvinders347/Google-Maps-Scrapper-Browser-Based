# Google Maps Business Scraper (Chrome Extensions)

Two small Chrome extensions that work together to collect business data from Google Maps.

| Step | Extension | What it does | Output |
|------|-----------|--------------|--------|
| 1 | **URL Extractor** | Scrolls through Google Maps search results and collects every business name + Maps link | CSV: `Business Name, Google Maps URL` |
| 2 | **Details Scraper** | Reads that CSV, opens each link one by one, and collects the details | CSV: `Business Name, Total Review Rating, Address, Phone Number, Website, Original URL` |

> Both extensions have files with the same names (`popup.js`, `content.js`, ...), so each one **must live in its own folder**.

---

## Folder structure

```
Google-Maps-Scrapper-Browser-Based/
├── maps-url-extractor/       ← Extension 1
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── content.js
│   ├── background.js
│   └── icon16.png, icon48.png, icon128.png
├── maps-detail-scraper/      ← Extension 2
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── content.js
│   ├── background.js
│   └── icon16.png, icon48.png, icon128.png
├── .gitignore
└── README.md
```

The manifest of each extension lists icon files (`icon16.png`, `icon48.png`, `icon128.png`). Make sure these exist in each folder, or Chrome will refuse to load the extension.

---

## Installation (do this once for each extension)

1. Download or clone this repository:
   ```bash
   git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   ```
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the `maps-url-extractor` folder.
6. Click **Load unpacked** again and select the `maps-detail-scraper` folder.
7. (Optional) Click the puzzle-piece icon in Chrome's toolbar and pin both extensions.

> After you edit any code, click the refresh icon on the extension's card in `chrome://extensions`, then **refresh the Google Maps tab** too.

---

## Step 1: Collect business links (URL Extractor)

1. Go to [Google Maps](https://www.google.com/maps) and search for businesses, for example `restaurants in Delhi`.
2. Make sure the list of results is showing on the left side.
3. Click the **Maps Scraper** extension icon.
4. Click **Start Scraping**. You can close the popup, and a blue box on the page shows progress.
5. The extension scrolls the results list automatically. It stops when it reaches "You've reached the end of the list", or after 5 minutes.
6. Click **Export to CSV** and save the file (`google_maps_businesses_XXXX.csv`).

**Want to stop early?** Click **Stop Scraping**. Everything collected so far is kept, and **Export to CSV** becomes available.

---

## Step 2: Collect business details (Details Scraper)

1. Click the **Maps Business Scraper** extension icon.
2. Click **Choose file** and upload the CSV from Step 1.
3. (Optional) Change **Delay between pages**. The default is 3000 ms (3 seconds). Use a higher value if your internet is slow or pages don't finish loading.
4. Click **Start Scraping**.
5. The extension opens each link in a background tab, reads the details, and moves to the next one. A progress bar shows how far along it is.
6. Click **Download Results** to get the final CSV (`scraped_businesses_XXXX.csv`).

**Data collected:** business name, rating, address, phone number, website, and the original Maps URL.

You can click **Stop Scraping** at any time, and results collected so far can still be downloaded.

---

## Tips and known limitations

- **Turn off the Details Scraper while doing Step 1.** Its content script runs on every Google Maps page, so leaving it enabled while you browse Maps can make it try to scrape pages you didn't intend it to. Disable it on `chrome://extensions` until Step 2.
- **Google changes its page layout often.** These extensions read Google Maps' internal class names (like `Nv2PK`, `hfpxzc`, `Io6YTe`). If a field comes back empty or the scraper stops working, those class names probably changed and the selectors in `content.js` need updating.
- **Fields can be empty.** Not every business lists a phone number or website. That's normal.
- **Keep Chrome open** while scraping. Closing the browser interrupts the run.
- **Don't go too fast.** Very short delays can trigger Google's bot checks (CAPTCHAs).
- **Use responsibly.** Automated scraping may violate Google's Terms of Service. Use this project for learning and personal use, and check Google's terms and the laws that apply to you before using collected data commercially.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Please open Google Maps first" | Make sure the active tab is on `google.com/maps` |
| "Error starting scraper. Please refresh the page." | Refresh the Google Maps tab, then try again |
| Extension won't load | Check that the icon files exist and the folder you picked contains `manifest.json` |
| Export button is greyed out | Nothing has been collected yet. Start scraping, or reopen the popup |
| CSV upload says "No data found" | Use the CSV exported from Step 1 without editing its format |
| Details are all empty or "Error" | Increase the delay, and check that the links open normally in Chrome |

---

## Files explained

| File | Purpose |
|------|---------|
| `manifest.json` | Extension settings and permissions |
| `popup.html` / `popup.js` | The small window that opens when you click the extension icon |
| `content.js` | Runs inside the Google Maps page and reads the data |
| `background.js` | (Details Scraper) Opens each link in turn and saves the results |
