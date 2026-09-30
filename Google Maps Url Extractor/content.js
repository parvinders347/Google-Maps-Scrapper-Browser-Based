let isScrapingActive = false;
let businesses = [];
let runId = 0; // increments on every start/stop so old loops can exit safely
let scrollTimeout = 300000; // 5 minutes in milliseconds
let scrollInterval = 5000; // 5 seconds between scrolls

// Add visual indicator on the page
let statusIndicator = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startScraping') {
        startScraping();
        sendResponse({ status: 'started' });
    } else if (request.action === 'stopScraping') {
        isScrapingActive = false;
        runId++; // invalidate the running loop immediately
        extractBusinessData(); // save whatever is loaded right now
        updateIndicator(`⏹ Stopped. Saved ${businesses.length} businesses`, '#d93025');
        setTimeout(() => removeIndicator(), 3000);
        sendResponse({ status: 'stopped', count: businesses.length });
    } else if (request.action === 'exportData') {
        sendResponse({ data: businesses });
    } else if (request.action === 'getStatus') {
        sendResponse({
            isActive: isScrapingActive,
            count: businesses.length
        });
    }
    return true;
});

function createIndicator() {
    if (statusIndicator) return;

    statusIndicator = document.createElement('div');
    statusIndicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1a73e8;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    min-width: 200px;
  `;
    statusIndicator.innerHTML = `
    <div style="margin-bottom: 5px;">🗺️ Maps Scraper Active</div>
    <div id="scraper-count" style="font-size: 12px; opacity: 0.9;">Businesses found: 0</div>
  `;
    document.body.appendChild(statusIndicator);
}

function updateIndicator(message, color = '#1a73e8') {
    if (statusIndicator) {
        statusIndicator.style.background = color;
        statusIndicator.innerHTML = message;
    }
}

function updateCount(count) {
    if (statusIndicator) {
        const countElement = document.getElementById('scraper-count');
        if (countElement) {
            countElement.textContent = `Businesses found: ${count}`;
        }
    }
}

function removeIndicator() {
    if (statusIndicator) {
        statusIndicator.remove();
        statusIndicator = null;
    }
}

async function startScraping() {
    if (isScrapingActive) {
        console.log('Scraping already in progress');
        return;
    }

    const myRun = ++runId;
    const isCurrent = () => isScrapingActive && runId === myRun;

    isScrapingActive = true;
    businesses = [];

    createIndicator();

    try {
        // Wait for results to load
        await waitForElement('div[role="feed"]', 20000);

        const resultsContainer = document.querySelector('div[role="feed"]');

        if (!resultsContainer) {
            throw new Error('Results container not found');
        }

        console.log('Found results container, starting to scroll...');
        updateIndicator('🔄 Scrolling through results...<br><span id="scraper-count" style="font-size: 12px;">Businesses found: 0</span>');

        // Scroll and collect data
        await scrollAndCollect(resultsContainer, isCurrent);

        if (!isCurrent()) {
            return; // User stopped it manually (progress already saved)
        }

        // Extract final business data
        extractBusinessData();

        updateIndicator(`✅ Scraping Complete!<br>Found ${businesses.length} businesses`, '#34a853');
        setTimeout(() => removeIndicator(), 5000);

        // Notify popup if it's open
        chrome.runtime.sendMessage({
            action: 'scrapingComplete',
            count: businesses.length
        }).catch(() => {
            // Popup might be closed, that's okay
            console.log('Scraping complete, popup is closed');
        });

    } catch (error) {
        console.error('Scraping error:', error);

        if (runId === myRun) {
            // Keep whatever was collected so it can still be exported
            extractBusinessData();
            updateIndicator(`❌ Error: ${error.message}`, '#d93025');
            setTimeout(() => removeIndicator(), 5000);

            chrome.runtime.sendMessage({
                action: 'scrapingError',
                message: error.message
            }).catch(() => {
                // Popup might be closed
            });
        }
    } finally {
        // Only reset the flag if a newer run hasn't taken over
        if (runId === myRun) {
            isScrapingActive = false;
        }
    }
}

async function scrollAndCollect(container, isCurrent) {
    const startTime = Date.now();
    let reachedEnd = false;

    while (isCurrent() && !reachedEnd) {
        // Check timeout
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime >= scrollTimeout) {
            console.log(`Timeout reached after ${elapsedTime / 1000}s. Stopping scrolling.`);
            break;
        }

        // Get current scroll position
        const currentPosition = container.scrollTop;
        const containerHeight = container.clientHeight;

        // Scroll down by half a page
        const scrollStep = containerHeight / 2;
        const newPosition = currentPosition + scrollStep;

        container.scrollTo(0, newPosition);
        console.log(`Scrolled to position ${newPosition}`);

        // Wait 5 seconds
        await sleep(scrollInterval);

        // Stopped (or replaced by a newer run) while sleeping
        if (!isCurrent()) break;

        // Check for end message
        const endMessages = document.querySelectorAll('span.HlvSq');
        for (const element of endMessages) {
            if (element.textContent.includes("You've reached the end of the list")) {
                reachedEnd = true;
                console.log("Reached end of list");
                break;
            }
        }

        // Save progress on every pass so nothing is lost if stopped.
        // This also updates the on-page counter and notifies the popup.
        extractBusinessData();
    }
}

function extractBusinessData() {
    const businessElements = document.querySelectorAll('div.Nv2PK');

    const collected = [];

    businessElements.forEach((element) => {
        // Extract business name
        const nameElement = element.querySelector('.qBF1Pd');
        const name = nameElement ? nameElement.textContent.trim() : 'Unknown';

        // Get Google Maps link
        const linkElement = element.querySelector('a.hfpxzc');
        const mapsUrl = linkElement ? linkElement.href : '';

        if (name && mapsUrl) {
            collected.push({
                name: name,
                url: mapsUrl
            });
        }
    });

    businesses = collected;

    console.log(`Extracted ${businesses.length} businesses`);
    updateCount(businesses.length);

    // Try to notify popup if it's open
    chrome.runtime.sendMessage({
        action: 'updateCount',
        count: businesses.length
    }).catch(() => {
        // Popup is closed, that's fine
    });
}

// Helper functions
function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkExist = setInterval(() => {
            const element = document.querySelector(selector);

            if (element) {
                clearInterval(checkExist);
                resolve(element);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkExist);
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }
        }, 100);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
