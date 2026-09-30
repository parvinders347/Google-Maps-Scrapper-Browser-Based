let csvData = [];
let scrapedData = [];
let isRunning = false;

const csvFileInput = document.getElementById('csvFile');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusDiv = document.getElementById('status');
const delayInput = document.getElementById('delay');

// Load saved state
chrome.storage.local.get(['scrapedData', 'isRunning', 'csvData'], (result) => {
    if (result.scrapedData) {
        scrapedData = result.scrapedData;
        downloadBtn.disabled = false;
    }
    if (result.isRunning) {
        isRunning = true;
        updateUIForRunning();
    }
    if (result.csvData) {
        csvData = result.csvData;
        startBtn.disabled = false;
    }
});

// Listen for updates from background
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'statusUpdate') {
        updateStatus(message.status);
    } else if (message.type === 'progressUpdate') {
        updateProgress(message.current, message.total);
    } else if (message.type === 'dataUpdate') {
        scrapedData = message.data;
        chrome.storage.local.set({ scrapedData });
        downloadBtn.disabled = false;
    } else if (message.type === 'complete') {
        isRunning = false;
        updateUIForStopped();
        updateStatus('✅ Scraping completed!');
    } else if (message.type === 'error') {
        updateStatus('❌ Error: ' + message.error);
    }
});

csvFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        csvData = parseCSV(text);

        if (csvData.length === 0) {
            updateStatus('❌ No data found in CSV');
            return;
        }

        await chrome.storage.local.set({ csvData });
        startBtn.disabled = false;
        updateStatus(`✅ Loaded ${csvData.length} businesses`);
    } catch (err) {
        updateStatus('❌ Error reading file: ' + err.message);
    }
});

startBtn.addEventListener('click', async () => {
    if (csvData.length === 0) {
        updateStatus('❌ Please upload a CSV file first');
        return;
    }

    const delay = parseInt(delayInput.value) || 3000;

    isRunning = true;
    scrapedData = [];

    await chrome.storage.local.set({
        isRunning: true,
        scrapedData: [],
        delay
    });

    updateUIForRunning();
    updateStatus('🚀 Starting scraping...');

    chrome.runtime.sendMessage({
        type: 'startScraping',
        data: csvData,
        delay
    });
});

stopBtn.addEventListener('click', async () => {
    isRunning = false;
    await chrome.storage.local.set({ isRunning: false });

    chrome.runtime.sendMessage({ type: 'stopScraping' });

    updateUIForStopped();
    updateStatus('⏸️ Scraping stopped by user');
});

downloadBtn.addEventListener('click', () => {
    if (scrapedData.length === 0) {
        updateStatus('❌ No data to download');
        return;
    }

    const csv = convertToCSV(scrapedData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scraped_businesses_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    updateStatus(`✅ Downloaded ${scrapedData.length} records`);
});

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Find the last occurrence of "https://" to split business name and URL
        const httpsIndex = line.lastIndexOf('https://');

        if (httpsIndex > 0) {
            let businessName = line.substring(0, httpsIndex).trim();
            let url = line.substring(httpsIndex).trim();

            // Remove trailing comma from business name if exists
            if (businessName.endsWith(',')) {
                businessName = businessName.slice(0, -1).trim();
            }

            data.push({
                businessName: businessName,
                url: url
            });
        }
    }

    return data;
}

function convertToCSV(data) {
    const headers = ['Business Name', 'Total Review Rating', 'Address', 'Phone Number', 'Website', 'Original URL'];
    const rows = data.map(row => [
        escapeCsvValue(row.businessName || ''),
        escapeCsvValue(row.rating || ''),
        escapeCsvValue(row.address || ''),
        escapeCsvValue(row.phone || ''),
        escapeCsvValue(row.website || ''),
        escapeCsvValue(row.originalUrl || '')
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function escapeCsvValue(value) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function updateStatus(status) {
    const statusText = statusDiv.querySelector('div:first-child');
    statusText.textContent = 'Status: ' + status;
}

function updateProgress(current, total) {
    const progressDiv = statusDiv.querySelector('.progress');
    const progressFill = statusDiv.querySelector('.progress-fill');

    progressDiv.style.display = 'block';
    const percent = Math.round((current / total) * 100);
    progressFill.style.width = percent + '%';
    progressFill.textContent = `${current}/${total} (${percent}%)`;
}

function updateUIForRunning() {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    csvFileInput.disabled = true;
    delayInput.disabled = true;
}

function updateUIForStopped() {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    csvFileInput.disabled = false;
    delayInput.disabled = false;
}