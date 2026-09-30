let isRunning = false;
let currentIndex = 0;
let csvData = [];
let scrapedData = [];
let delay = 3000;
let currentTabId = null;

// Restore state on startup
chrome.runtime.onStartup.addListener(async () => {
    const result = await chrome.storage.local.get(['isRunning', 'currentIndex', 'csvData', 'scrapedData', 'delay']);
    if (result.isRunning) {
        isRunning = true;
        currentIndex = result.currentIndex || 0;
        csvData = result.csvData || [];
        scrapedData = result.scrapedData || [];
        delay = result.delay || 3000;

        // Resume scraping
        continueScaping();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'startScraping') {
        csvData = message.data;
        delay = message.delay || 3000;
        currentIndex = 0;
        scrapedData = [];
        isRunning = true;

        chrome.storage.local.set({
            isRunning: true,
            currentIndex: 0,
            csvData,
            scrapedData,
            delay
        });

        startScraping();
    } else if (message.type === 'stopScraping') {
        isRunning = false;
        chrome.storage.local.set({ isRunning: false });

        if (currentTabId) {
            chrome.tabs.remove(currentTabId).catch(() => { });
        }
    } else if (message.type === 'scrapedData') {
        handleScrapedData(message.data);
    }
});

async function startScraping() {
    if (!isRunning || currentIndex >= csvData.length) {
        completeScraping();
        return;
    }

    const business = csvData[currentIndex];

    sendStatusUpdate(`Processing ${currentIndex + 1}/${csvData.length}: ${business.businessName}`);
    sendProgressUpdate(currentIndex + 1, csvData.length);

    try {
        // Create or update tab
        if (currentTabId) {
            try {
                await chrome.tabs.update(currentTabId, { url: business.url });
            } catch (err) {
                // Tab was closed, create new one
                const tab = await chrome.tabs.create({ url: business.url, active: false });
                currentTabId = tab.id;
            }
        } else {
            const tab = await chrome.tabs.create({ url: business.url, active: false });
            currentTabId = tab.id;
        }

        // Wait for page to load and content script to scrape
        // Content script will send data back

    } catch (err) {
        console.error('Error processing business:', err);
        scrapedData.push({
            businessName: business.businessName,
            rating: 'Error',
            address: 'Error',
            phone: 'Error',
            website: 'Error',
            originalUrl: business.url
        });

        moveToNext();
    }
}

function handleScrapedData(data) {
    scrapedData.push(data);

    chrome.storage.local.set({ scrapedData });

    sendDataUpdate(scrapedData);

    moveToNext();
}

async function moveToNext() {
    currentIndex++;
    await chrome.storage.local.set({ currentIndex });

    if (!isRunning) {
        return;
    }

    if (currentIndex >= csvData.length) {
        completeScraping();
        return;
    }

    // Wait before processing next
    setTimeout(() => {
        if (isRunning) {
            startScraping();
        }
    }, delay);
}

function completeScraping() {
    isRunning = false;
    chrome.storage.local.set({ isRunning: false });

    if (currentTabId) {
        chrome.tabs.remove(currentTabId).catch(() => { });
        currentTabId = null;
    }

    chrome.runtime.sendMessage({
        type: 'complete',
        data: scrapedData
    });
}

function sendStatusUpdate(status) {
    chrome.runtime.sendMessage({
        type: 'statusUpdate',
        status
    });
}

function sendProgressUpdate(current, total) {
    chrome.runtime.sendMessage({
        type: 'progressUpdate',
        current,
        total
    });
}

function sendDataUpdate(data) {
    chrome.runtime.sendMessage({
        type: 'dataUpdate',
        data
    });
}