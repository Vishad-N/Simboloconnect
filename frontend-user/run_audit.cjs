const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');

// 1. Generate JWT Token using backend's jsonwebtoken installation
console.log("Generating JWT auth token...");
const userId = "f958ef61-49d6-46f5-90c1-58e17b5b8829";
const email = "abhishekumaroy4177@gmail.com";
const role = "ADMIN";
const secret = "super-secret-key-12345";

let token;
try {
    const cmd = `node -e "console.log(require('jsonwebtoken').sign({ id: '${userId}', email: '${email}', role: '${role}' }, '${secret}'))"`;
    token = execSync(cmd, { cwd: '../backend' }).toString().trim();
    console.log("Token generated successfully.");
} catch (e) {
    console.error("Failed to generate token:", e.message);
    process.exit(1);
}

const targetDomain = "https://wadesk.authai.space";

// Pages to visit
const pages = [
    { name: 'Shopify Page', path: '/ecommerce/shopify' },
    { name: 'Analytics Page', path: '/ecommerce/analytics' },
    { name: 'Templates Page', path: '/templates' },
    { name: 'Profile Page', path: '/profile' }
];

(async () => {
    console.log("Launching headless browser...");
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1280, height: 800 });

    const auditReport = [];

    // First go to the main page to initialize localStorage context
    console.log(`Navigating to ${targetDomain}/login to set localStorage context...`);
    await page.goto(`${targetDomain}/login`, { waitUntil: 'networkidle2' });

    // Inject Auth Token
    await page.evaluate((tok, uid) => {
        localStorage.setItem('userToken', tok);
        localStorage.setItem('tenantId', uid);
        localStorage.setItem('user_theme_preference', 'fresh'); // default theme context
    }, token, userId);

    console.log("Auth credentials injected into localStorage.");

    // Loop through each page
    for (const p of pages) {
        console.log(`Auditing: ${p.name} (${p.path})...`);
        
        const consoleErrors = [];
        const consoleLogs = [];
        const failedRequests = [];
        const exceptions = [];
        const networkLogs = [];

        // Attach listeners
        const handleConsole = msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error') {
                consoleErrors.push(text);
            } else {
                consoleLogs.push(`[${type}] ${text}`);
            }
        };

        const handlePageError = err => {
            exceptions.push(err.message || err.toString());
        };

        const handleRequestFailed = req => {
            failedRequests.push({
                url: req.url(),
                errorText: req.failure()?.errorText || 'Failed'
            });
        };

        const handleResponse = res => {
            const status = res.status();
            if (status >= 400) {
                networkLogs.push({
                    url: res.url(),
                    status: status,
                    statusText: res.statusText()
                });
            }
        };

        page.on('console', handleConsole);
        page.on('pageerror', handlePageError);
        page.on('requestfailed', handleRequestFailed);
        page.on('response', handleResponse);

        try {
            // Navigate to page
            const url = `${targetDomain}${p.path}`;
            const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
            
            // Wait an additional 3 seconds for dynamic JS elements
            await new Promise(r => setTimeout(r, 3000));

            const pageStatus = response ? response.status() : 'No Response';

            auditReport.push({
                pageName: p.name,
                url: url,
                pageStatus: pageStatus,
                consoleErrors,
                consoleLogs,
                failedRequests,
                exceptions,
                networkResponseErrors: networkLogs
            });

        } catch (navigateErr) {
            console.error(`Error navigating to ${p.name}:`, navigateErr.message);
            auditReport.push({
                pageName: p.name,
                url: `${targetDomain}${p.path}`,
                pageStatus: 'NAVIGATION_ERROR',
                navigationError: navigateErr.message,
                consoleErrors,
                failedRequests,
                exceptions,
                networkResponseErrors: networkLogs
            });
        } finally {
            // Remove listeners for the next page
            page.off('console', handleConsole);
            page.off('pageerror', handlePageError);
            page.off('requestfailed', handleRequestFailed);
            page.off('response', handleResponse);
        }
    }

    // Save report to disk
    const reportPath = "/Users/abhisheksharma/.gemini/antigravity/brain/a1266062-01a6-4a27-8581-1093e6a3c345/scratch/page_audit_results.json";
    fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
    console.log(`Audit report generated and saved at: ${reportPath}`);

    await browser.close();
    console.log("Audit complete.");
})();
