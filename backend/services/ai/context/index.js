const prisma = require('../../../prismaClient');
const redis = require('../../redisConnection');
const cheerio = require('cheerio');
const axios = require('axios');

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN ESTIMATION UTILITIES
// Approx: 1 token ≈ 4 chars for English/Hindi mixed content
// ─────────────────────────────────────────────────────────────────────────────
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

/**
 * Trims a string to fit within a max token budget.
 */
function trimToTokens(text, maxTokens) {
    if (!text) return '';
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars) + '\n... [CONTENT TRIMMED TO FIT TOKEN LIMIT]';
}

async function scrapeWebsiteContent(url) {
    try {
        const parsedBase = new URL(url);
        const origin = parsedBase.origin;

        // 1. Scrape the homepage first
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 8000
        });
        const $ = cheerio.load(response.data);
        
        // Discover internal links (pricing, products, about, etc.)
        const internalLinks = new Set();
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            
            try {
                const resolved = new URL(href, origin);
                // Ensure same origin, not just hash links, not static files, and not homepage itself
                if (resolved.origin === origin && 
                    resolved.pathname !== '/' && 
                    !resolved.pathname.includes('.') && 
                    !resolved.hash) {
                    internalLinks.add(resolved.href);
                }
            } catch (err) {}
        });

        // Clean noise from homepage
        $('script, style, nav, footer, iframe, noscript').remove();
        let homepageText = $('body').text().replace(/\s+/g, ' ').trim();
        
        // ── REDUCED: Homepage capped at 2000 chars (was 5000) ──
        let combinedText = `[PAGE: Home]\n${homepageText.substring(0, 2000)}`;

        // 2. Fetch up to 2 sub-pages (was 3)
        const subPagesToScrape = Array.from(internalLinks).slice(0, 2);
        if (subPagesToScrape.length > 0) {
            console.log(`[RAG Scraper] Business website has sub-pages. Crawling:`, subPagesToScrape);
            
            const subPagePromises = subPagesToScrape.map(async (subUrl) => {
                try {
                    const subRes = await axios.get(subUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        },
                        timeout: 5000
                    });
                    const sub$ = cheerio.load(subRes.data);
                    sub$('script, style, nav, footer, iframe, noscript').remove();
                    const subText = sub$('body').text().replace(/\s+/g, ' ').trim();
                    const pathLabel = new URL(subUrl).pathname;
                    // ── REDUCED: Sub-page capped at 1500 chars (was 3000) ──
                    return `\n\n[PAGE: ${pathLabel}]\n${subText.substring(0, 1500)}`;
                } catch (err) {
                    console.warn(`[RAG Scraper] Failed to scrape sub-page ${subUrl}:`, err.message);
                    return '';
                }
            });
            
            const subPagesContents = await Promise.all(subPagePromises);
            combinedText += subPagesContents.join('');
        }

        // ── HARD CAP: Total crawled content max 5000 chars (was 15000) ──
        return combinedText.substring(0, 5000);
    } catch (e) {
        console.error(`[Scraper Error] Failed to scrape ${url}:`, e.message);
        return null;
    }
}

/**
 * Builds the AI context string safely using ONLY data from the given workspace.
 * Phone number is matched in multi-format to handle with/without + prefix.
 * 
 * TOKEN BUDGETS (total target: max 2500 tokens for system prompt context):
 *   - Base system prompt:        ~500 tokens
 *   - Crawled website content:   ~750 tokens max  (3000 chars)
 *   - Customer profile:          ~100 tokens
 *   - Voice capability:          ~80 tokens
 *   - Rules + formatting:        ~200 tokens
 *   Total budget:                ~1630 tokens for context
 */
async function buildWorkspaceContext(workspaceId, contactPhone) {
    // 1. Multi-format contact lookup — handles +91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX
    const phoneForms = [
        contactPhone,
        contactPhone.startsWith('+') ? contactPhone.substring(1) : '+' + contactPhone,
    ];
    let contact = await prisma.contact.findFirst({
        where: { userId: workspaceId, phone: { in: phoneForms } }
    });

    // 2. Auto-create contact if not found — never crash the AI for new contacts
    if (!contact) {
        try {
            contact = await prisma.contact.create({
                data: { userId: workspaceId, phone: contactPhone, name: null, tags: ['Inbound', 'AI-Created'] }
            });
            console.log(`[AI Context] Auto-created contact for ${contactPhone} in workspace ${workspaceId}`);
        } catch (createErr) {
            // Race condition guard — another worker may have created it simultaneously
            contact = await prisma.contact.findFirst({
                where: { userId: workspaceId, phone: { in: phoneForms } }
            });
            if (!contact) {
                // Absolute fallback — build context with minimal info to keep AI running
                contact = { id: 'UNKNOWN', phone: contactPhone, name: null, tags: [] };
            }
        }
    }

    // 2. Fetch workspace AI settings
    const agentConfig = await prisma.aiAgent.findUnique({
        where: { userId: workspaceId }
    });

    const companyName = agentConfig?.name || "Workspace Assistant";
    // ── TOKEN CAP: Base system prompt hard-capped at 1500 tokens (6000 chars) ──
    const rawPrompt = agentConfig?.systemPrompt || `You are an AI assistant for this workspace.`;
    const basePrompt = trimToTokens(rawPrompt, 1500);

    // 3. Fetch Ecommerce integrations summary
    const store = await prisma.ecomStore.findFirst({
        where: { userId: workspaceId, status: 'connected' }
    });

    let ecommerceContext = "No active Ecommerce store connected.";
    if (store) {
        ecommerceContext = `Connected Store: ${store.storeName} (${store.platform})`;
    }

    // 4. Fetch and Cache Website Crawled Data
    // ── TOKEN CAP: Crawled content hard-capped at 750 tokens (3000 chars) ──
    let crawledContext = "No website documentation parsed.";
    if (agentConfig?.knowledgeWebsite) {
        const websiteUrl = agentConfig.knowledgeWebsite;
        const cacheKey = `ai_crawled_website:${workspaceId}`;
        
        try {
            let cachedContent = await redis.get(cacheKey);
            if (!cachedContent) {
                console.log(`[RAG Scraper] Triggering background crawl for business website: ${websiteUrl}`);
                
                // Trigger web scrape in the background without blocking the response
                scrapeWebsiteContent(websiteUrl).then(scraped => {
                    if (scraped) {
                        redis.set(cacheKey, scraped, 'EX', 86400);
                        console.log(`[RAG Scraper] Background crawl successfully completed for ${websiteUrl}`);
                    }
                }).catch(err => {
                    console.error(`[RAG Scraper] Background crawl failed for ${websiteUrl}:`, err.message);
                });

                // Set a temporary short-lived placeholder lock to prevent multiple concurrent background scrapes
                cachedContent = "CRAWLING_IN_PROGRESS";
                await redis.set(cacheKey, "CRAWLING_IN_PROGRESS", 'EX', 120); // 2-minute lock
            }

            if (cachedContent && cachedContent !== "CRAWLING_IN_PROGRESS") {
                // ── HARD CAP: Never inject more than 3000 chars of crawled content (≈750 tokens) ──
                crawledContext = trimToTokens(cachedContent, 750);
            } else {
                crawledContext = "Website documentation is currently being parsed in the background. Please assist the customer using general knowledge about the company or product catalog.";
            }
        } catch (e) {
            console.error("[RAG Scraper] Cache/Scrape failed:", e.message);
        }
    }

    // 5. Fetch real-time AI Voice capability status
    let voiceCapabilityContext = 'Voice calling: UNAVAILABLE (no provider configured).';
    try {
        const activeVoiceProvider = await prisma.userVoiceProvider.findFirst({
            where: { userId: workspaceId, active: true, provider: { enabled: true } },
            include: { provider: true }
        });
        if (activeVoiceProvider) {
            voiceCapabilityContext = `Voice calling: AVAILABLE via ${activeVoiceProvider.provider.name}. You CAN initiate calls by triggering the 'initiate_voice_call' tool.`;
        } else if (process.env.ENABLE_AI_VOICE_CALLING === 'true') {
            voiceCapabilityContext = 'Voice calling: ENABLED globally but no provider configured by workspace. Do NOT promise calls.';
        }
    } catch (vcErr) {
        console.error('[AI Context] Failed to check voice capability:', vcErr.message);
    }

    const customerDisplayName = contact.name || null;

    return `[SYSTEM PROMPT]
${basePrompt}

[WORKSPACE]
- Name: ${companyName}

[BUSINESS KNOWLEDGE BASE]
${crawledContext}

[CUSTOMER]
- Name: ${customerDisplayName || 'Unknown'}
- Phone: ${contact.phone}
- Tags: ${(contact.tags || []).join(', ') || 'None'}

[INTEGRATIONS]
- Ecommerce: ${ecommerceContext}

[VOICE STATUS]
- ${voiceCapabilityContext}
- If voice IS available and customer asks to be called, trigger 'initiate_voice_call' immediately.
- If voice is UNAVAILABLE, never promise a call.

[RULES]
1. Only use tools provided to you.
2. For payment links, use create_payment_link tool. Never invent URLs.
3. Keep responses concise, warm, professional, and human-like. Use customer name when known.
4. Answer using [BUSINESS KNOWLEDGE BASE]. If info not found, politely say you are checking.
5. Never invent pricing. Use search_products tool. Never shorten URLs.
`;
}

module.exports = { buildWorkspaceContext, estimateTokens, trimToTokens };
