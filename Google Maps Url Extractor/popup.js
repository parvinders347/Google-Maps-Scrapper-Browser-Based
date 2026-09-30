document.addEventListener('DOMContentLoaded', checkStatus);
document.getElementById('startBtn').addEventListener('click', startScraping);
document.getElementById('stopBtn').addEventListener('click', stopScraping);
document.getElementById('exportBtn').addEventListener('click', exportToCSV);

let isScrapingActive = false;

// Check current status when popup opens
async function checkStatus() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('google.com/maps')) {
        updateStatus('Please open Google Maps first', 'error');
        return;
    }

    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });

        if (response && response.isActive) {
            // Scraping is already in progress
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('stopBtn').style.display = 'block';
            document.getElementById('exportBtn').disabled = true;
            document.getElementById('count').textContent = `Businesses found: ${response.count}`;
            updateStatus('Scraping in progress...', 'info');
        } else if (response && response.count > 0) {
            // Scraping finished or was stopped, data available
            document.getElementById('exportBtn').disabled = false;
            document.getElementById('count').textContent = `Businesses found: ${response.count}`;
            updateStatus('Data ready! Click Export to download.', 'success');
        }
    } catch (e) {
        // Content script not ready or no data yet
        console.log('Content script not ready:', e);
    }
}

async function startScraping() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('google.com/maps')) {
        updateStatus('Please open Google Maps first', 'error');
        return;
    }

    isScrapingActive = true;
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'block';
    document.getElementById('exportBtn').disabled = true;

    updateStatus('Scraping started! You can close this popup.', 'info');

    try {
        await chrome.tabs.sendMessage(tab.id, { action: 'startScraping' });
    } catch (e) {
        updateStatus('Error starting scraper. Please refresh the page.', 'error');
    }
}

async function stopScraping() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    isScrapingActive = false;
    document.getElementById('startBtn').style.display = 'block';
    document.getElementById('stopBtn').style.display = 'none';

    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'stopScraping' });
        const count = response?.count ?? 0;

        document.getElementById('count').textContent = `Businesses found: ${count}`;
        document.getElementById('exportBtn').disabled = count === 0;
        updateStatus(`Scraping stopped. ${count} businesses saved, ready to export.`, 'info');
    } catch (e) {
        console.error('Error stopping scraper:', e);
    }
}

async function exportToCSV() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'exportData' });

        if (response && response.data) {
            downloadCSV(response.data);
        } else {
            updateStatus('No data to export', 'error');
        }
    } catch (e) {
        updateStatus('Error exporting data. Please try again.', 'error');
    }
}

function downloadCSV(businesses) {
    if (businesses.length === 0) {
        updateStatus('No data to export', 'error');
        return;
    }

    // Create CSV content
    const headers = ['Business Name', 'Google Maps URL'];
    const csvContent = [
        headers.join(','),
        ...businesses.map(b => `"${b.name.replace(/"/g, '""')}","${b.url}"`)
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `google_maps_businesses_${Date.now()}.csv`);
    link.click();

    updateStatus('CSV downloaded successfully!', 'success');
}

function updateStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;

    if (type === 'error') {
        statusDiv.style.backgroundColor = '#fce8e6';
        statusDiv.style.color = '#c5221f';
    } else if (type === 'success') {
        statusDiv.style.backgroundColor = '#e6f4ea';
        statusDiv.style.color = '#1e8e3e';
    } else {
        statusDiv.style.backgroundColor = '#e8f0fe';
        statusDiv.style.color = '#1967d2';
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateCount') {
        document.getElementById('count').textContent = `Businesses found: ${request.count}`;
    } else if (request.action === 'scrapingComplete') {
        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('stopBtn').style.display = 'none';
        document.getElementById('exportBtn').disabled = false;
        updateStatus(`Scraping complete! Found ${request.count} businesses`, 'success');
    } else if (request.action === 'scrapingError') {
        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('stopBtn').style.display = 'none';
        // Partial data is kept, so allow exporting it
        document.getElementById('exportBtn').disabled = false;
        updateStatus('Error: ' + request.message + ' (partial data can still be exported)', 'error');
    }
});
