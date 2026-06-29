const prisma = require('../prismaClient');

async function isWalletEnabled() {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'WALLET_MANAGEMENT_ENABLED' } });
    return setting ? setting.value === 'true' : false; // Default to false if not set
}


/**
 * Ensures user has a wallet. If not, creates one.
 */
async function getOrCreateWallet(userId) {
    let wallet = await prisma.wallet.findUnique({
        where: { userId }
    });
    if (!wallet) {
        wallet = await prisma.wallet.create({
            data: {
                userId,
                currentBalance: 0.0,
                currency: 'INR'
            }
        });
    }
    return wallet;
}

/**
 * Helper to determine category default if not explicitly provided
 */
function normalizeCategory(category) {
    if (!category) return 'SERVICE';
    const c = category.toUpperCase();
    if (['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'].includes(c)) return c;
    return 'SERVICE';
}

/**
 * Validate balance before action
 */
async function validateBalance(userId, rawCategory, count = 1) {
    const category = normalizeCategory(rawCategory);
    
    // Enforce Plan Message Limits first (independent of Wallet toggle)
    const { checkMessageLimit } = require('./planLimits');
    await checkMessageLimit(userId, count);

    if (!(await isWalletEnabled())) {
        return { totalCost: 0, category, walletId: null };
    }

    
    // Fetch wallet and rates in parallel
    const [wallet, pricingRate] = await Promise.all([
        getOrCreateWallet(userId),
        prisma.pricingRate.findUnique({
            where: { category }
        })
    ]);

    // If pricing rate config doesn't exist, log warning but default cost to 0
    let totalRate = 0.0;
    if (pricingRate) {
        totalRate = parseFloat((Number(pricingRate.baseCost) + Number(pricingRate.markup)).toFixed(4));
    } else {
        console.warn(`[Wallet] Missing PricingRate for category: ${category}`);
    }

    const totalCost = parseFloat((totalRate * count).toFixed(4));
    const currentBalance = Number(wallet.currentBalance);

    if (totalCost > 0 && currentBalance < totalCost) {
        throw new Error(`Insufficient Credits. You need ₹${totalCost.toFixed(2)} to send this message, but your balance is ₹${currentBalance.toFixed(2)}`);
    }

    return { totalCost, category, walletId: wallet.id };
}

/**
 * Deduct credits logic
 */
async function deductCredits(userId, rawCategory, count = 1, description = "Message sent") {
    const category = normalizeCategory(rawCategory);
    
    if (!(await isWalletEnabled())) return 0;

    
    // Fetch rates
    let pricingRate = await prisma.pricingRate.findUnique({
        where: { category }
    });

    let totalRate = 0.0;
    if (pricingRate) {
        totalRate = parseFloat((Number(pricingRate.baseCost) + Number(pricingRate.markup)).toFixed(4));
    }

    const totalCost = parseFloat((totalRate * count).toFixed(4));

    if (totalCost <= 0) {
        return; // Nothing to deduct
    }

    // Wrap in Prisma transaction for atomic deduction
    await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new Error("Wallet not found for deduction");

        if (Number(wallet.currentBalance) < totalCost) {
            throw new Error("Insufficient Credits during deduction");
        }

        // Exact decimal decrement
        await tx.wallet.update({
            where: { userId },
            data: {
                currentBalance: {
                    decrement: totalCost
                }
            }
        });

        await tx.transaction.create({
            data: {
                userId,
                amount: totalCost,
                type: 'DEBIT',
                category: category,
                description: description
            }
        });
    });

    return totalCost;
}

async function refundCredits(userId, rawCategory, count = 1, description = "Refund") {
    const category = normalizeCategory(rawCategory);
    
    if (!(await isWalletEnabled())) return;

    
    let pricingRate = await prisma.pricingRate.findUnique({
        where: { category }
    });

    let totalRate = 0.0;
    if (pricingRate) {
        totalRate = parseFloat((Number(pricingRate.baseCost) + Number(pricingRate.markup)).toFixed(4));
    }

    const totalCost = parseFloat((totalRate * count).toFixed(4));

    if (totalCost <= 0) return;

    await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
            where: { userId },
            data: {
                currentBalance: {
                    increment: totalCost
                }
            }
        });

        await tx.transaction.create({
            data: {
                userId,
                amount: totalCost,
                type: 'CREDIT',
                category: category,
                description: description
            }
        });
    });
}

module.exports = {
    getOrCreateWallet,
    validateBalance,
    deductCredits,
    refundCredits
};
