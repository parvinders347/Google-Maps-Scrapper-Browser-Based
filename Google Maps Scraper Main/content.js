// Wait for page to load and then scrape
function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkElement = () => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
            } else if (Date.now() - startTime > timeout) {
                reject(new Error('Element not found: ' + selector));
            } else {
                setTimeout(checkElement, 100);
            }
        };

        checkElement();
    });
}

async function scrapeBusinessData() {
    try {
        // Wait for the main business card to load
        await waitForElement('.m6QErb.XiKgde');

        // Additional wait to ensure all data is loaded
        await new Promise(resolve => setTimeout(resolve, 2000));

        const data = {
            businessName: '',
            rating: '',
            address: '',
            phone: '',
            website: '',
            originalUrl: window.location.href
        };

        // Extract Business Name
        // Method 1: Try to find the specific element with aria-label containing "Information for"
        let nameElement = document.querySelector('.m6QErb.XiKgde[aria-label*="Information for"]');
        if (nameElement) {
            const ariaLabel = nameElement.getAttribute('aria-label');
            if (ariaLabel) {
                data.businessName = ariaLabel.replace('Information for ', '').trim();
            }
        }

        // Method 2: If not found, try the main heading
        if (!data.businessName) {
            const headingElement = document.querySelector('h1.DUwDvf.lfPIob');
            if (headingElement) {
                data.businessName = headingElement.textContent.trim();
            }
        }

        // Method 3: Try alternative selectors
        if (!data.businessName) {
            const altElement = document.querySelector('[role="region"][aria-label^="Information for"]');
            if (altElement) {
                const ariaLabel = altElement.getAttribute('aria-label');
                if (ariaLabel) {
                    data.businessName = ariaLabel.replace('Information for ', '').trim();
                }
            }
        }

        // Extract Rating
        const ratingElement = document.querySelector('.ceNzKf[role="img"]');
        if (ratingElement) {
            const ariaLabel = ratingElement.getAttribute('aria-label');
            if (ariaLabel) {
                const match = ariaLabel.match(/([0-9.]+)\s*stars?/i);
                if (match) {
                    data.rating = match[1];
                }
            }
        }

        // Extract Address
        const addressButton = document.querySelector('button[data-item-id="address"]');
        if (addressButton) {
            const addressDiv = addressButton.querySelector('.Io6YTe.fontBodyMedium');
            if (addressDiv) {
                data.address = addressDiv.textContent.trim();
            }
        }

        // Extract Phone Number
        const phoneButton = document.querySelector('button[data-item-id^="phone:tel:"]');
        if (phoneButton) {
            const phoneDiv = phoneButton.querySelector('.Io6YTe.fontBodyMedium');
            if (phoneDiv) {
                data.phone = phoneDiv.textContent.trim();
            }
        }

        // Extract Website
        const websiteLink = document.querySelector('a[data-item-id="authority"]');
        if (websiteLink) {
            const websiteDiv = websiteLink.querySelector('.Io6YTe.fontBodyMedium');
            if (websiteDiv) {
                data.website = websiteDiv.textContent.trim();
            }
        }

        // Send scraped data back to background script
        chrome.runtime.sendMessage({
            type: 'scrapedData',
            data: data
        });

    } catch (err) {
        console.error('Scraping error:', err);

        // Send error data
        chrome.runtime.sendMessage({
            type: 'scrapedData',
            data: {
                businessName: 'Error',
                rating: 'N/A',
                address: 'N/A',
                phone: 'N/A',
                website: 'N/A',
                originalUrl: window.location.href
            }
        });
    }
}

// Start scraping when page loads
if (window.location.href.includes('google.com/maps')) {
    scrapeBusinessData();
}