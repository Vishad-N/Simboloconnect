const puppeteer = require('puppeteer');

(async () => {
    console.log("Starting browser...");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    console.log("Navigating to https://prebuiltapi.com/ai-brain...");
    await page.goto('https://prebuiltapi.com/ai-brain', { waitUntil: 'networkidle0' });
    
    console.log("Waiting 2s...");
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
    console.log("Done");
})();
