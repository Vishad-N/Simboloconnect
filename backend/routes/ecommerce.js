/**
 * routes/ecommerce.js
 * Ecommerce Integration Module — REST API
 * Handles: Stores, Orders, Products, Customers, Abandoned Carts,
 *          Automations, Campaigns, Templates, Analytics
 */

const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { executeEcomCampaign } = require('../services/EcomCampaignService');
const axios = require('axios');
const { decrypt } = require('../utils/encryption');
const { getMetaConfig } = require('../utils/metaConfig');

// Apply auth middleware to all routes
router.use(authenticate);

// ──────────────────────────────────────────────
// HELPER: Get userId from request
// ──────────────────────────────────────────────
const getUserId = (req) => req.user?.workspaceId || req.user?.id || req.headers['x-user-id'];

// ══════════════════════════════════════════════
// STORES
// ══════════════════════════════════════════════

/**
 * GET /api/ecommerce/stores
 * List all connected stores for the user
 */
router.get('/stores', async (req, res) => {
  try {
    const userId = getUserId(req);
    const stores = await prisma.ecomStore.findMany({
      where: { userId, status: 'connected' },
      orderBy: { connectedAt: 'desc' },
      select: {
        id: true, platform: true, storeName: true, domain: true,
        status: true, currency: true, timezone: true, storeOwner: true,
        webhookStatus: true, syncStatus: true, connectedAt: true, createdAt: true,
        // Never expose accessToken in list
      },
    });

    const storesWithStats = await Promise.all(stores.map(async (store) => {
      const [ordersCount, productsCount, customersCount, revenueAgg] = await Promise.all([
        prisma.ecomOrder.count({ where: { storeId: store.id } }),
        prisma.ecomProduct.count({ where: { storeId: store.id } }),
        prisma.ecomCustomer.count({ where: { storeId: store.id } }),
        prisma.ecomOrder.aggregate({
          where: { storeId: store.id },
          _sum: { totalAmount: true }
        })
      ]);

      return {
        ...store,
        orders: ordersCount,
        products: productsCount,
        customers: customersCount,
        revenue: Number(revenueAgg._sum.totalAmount || 0)
      };
    }));

    res.json({ stores: storesWithStats });
  } catch (err) {
    console.error('[Ecom/Stores] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch stores' });
  }
});

/**
 * POST /api/ecommerce/stores/connect
 * Connect a new Shopify or WooCommerce store
 */
router.post('/stores/connect', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { platform, domain, accessToken, apiKey, apiSecret, consumerKey, consumerSecret, storeName } = req.body;

    if (!platform || !domain) {
      return res.status(400).json({ message: 'Platform and domain are required' });
    }

    // Shopify validation
    if (platform === 'shopify' && !accessToken) {
      return res.status(400).json({ message: 'Shopify access token is required' });
    }

    // WooCommerce validation
    if (platform === 'woocommerce' && (!consumerKey || !consumerSecret)) {
      return res.status(400).json({ message: 'WooCommerce consumer key and secret are required' });
    }

    // Check for duplicate store
    const existing = await prisma.ecomStore.findFirst({ where: { userId, domain } });
    if (existing) {
      return res.status(409).json({ message: 'This store is already connected' });
    }

    let cleanDomain = domain.trim();
    if (platform === 'shopify') {
      cleanDomain = cleanDomain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/+$/, '');
    } else if (platform === 'woocommerce') {
      if (!/^https?:\/\//i.test(cleanDomain)) {
        cleanDomain = `https://${cleanDomain}`;
      }
      cleanDomain = cleanDomain.replace(/\/+$/, '');
    }

    const storeData = {
      userId,
      platform,
      domain: cleanDomain,
      storeName: storeName || cleanDomain.split('.')[0].replace(/^(https?:\/\/)?(www\.)?/, ''),
      status: 'connected',
      connectedAt: new Date(),
    };

    if (platform === 'shopify') {
      storeData.accessToken = accessToken;
      storeData.apiKey = apiKey || null;
      storeData.apiSecret = apiSecret || null;
    } else if (platform === 'woocommerce') {
      storeData.accessToken = consumerKey;
      storeData.apiSecret = consumerSecret;
    }

    const store = await prisma.ecomStore.create({ data: storeData });

    // TODO: Register webhooks in background
    // await registerWebhooks(store);

    res.status(201).json({
      store: {
        id: store.id, platform: store.platform, storeName: store.storeName,
        domain: store.domain, status: store.status, connectedAt: store.connectedAt,
      },
      message: 'Store connected successfully',
    });
  } catch (err) {
    console.error('[Ecom/Stores] POST connect error:', err);
    res.status(500).json({ message: 'Failed to connect store' });
  }
});

/**
 * PUT /api/ecommerce/stores/:storeId
 * Update store details/credentials
 */
router.put('/stores/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = getUserId(req);
    const { storeName, accessToken, apiKey, apiSecret, consumerKey, consumerSecret } = req.body;

    const store = await prisma.ecomStore.findFirst({ where: { id: storeId, userId } });
    if (!store) return res.status(404).json({ message: 'Store not found' });

    const updateData = {};
    if (storeName) updateData.storeName = storeName;

    if (store.platform === 'shopify') {
      if (accessToken) updateData.accessToken = accessToken;
      if (apiKey !== undefined) updateData.apiKey = apiKey || null;
      if (apiSecret) updateData.apiSecret = apiSecret;
    } else if (store.platform === 'woocommerce') {
      if (consumerKey) updateData.accessToken = consumerKey;
      if (consumerSecret) updateData.apiSecret = consumerSecret;
    }

    const updated = await prisma.ecomStore.update({
      where: { id: storeId },
      data: updateData,
    });

    res.json({
      store: {
        id: updated.id, platform: updated.platform, storeName: updated.storeName,
        domain: updated.domain, status: updated.status, connectedAt: updated.connectedAt,
      },
      message: 'Store settings updated successfully',
    });
  } catch (err) {
    console.error('[Ecom/Stores] PUT error:', err);
    res.status(500).json({ message: 'Failed to update store settings' });
  }
});

/**
 * POST /api/ecommerce/stores/:storeId/sync
 * Trigger a sync for orders/products/customers
 */
router.post('/stores/:storeId/sync', async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = getUserId(req);
    const { type } = req.body; // orders | products | customers | all

    const store = await prisma.ecomStore.findFirst({ where: { id: storeId, userId } });
    if (!store) return res.status(404).json({ message: 'Store not found' });

    // Update sync status
    await prisma.ecomStore.update({
      where: { id: storeId },
      data: { syncStatus: 'syncing', updatedAt: new Date() },
    });

    if (store.platform === 'shopify') {
      const ShopifyService = require('../services/ShopifyService');
      const shopify = new ShopifyService(store);
      
      if (type === 'products' || type === 'all' || !type) await shopify.syncProducts();
      if (type === 'orders' || type === 'all' || !type) await shopify.syncOrders();
      if (type === 'customers' || type === 'all' || !type) await shopify.syncCustomers();
    } else if (store.platform === 'woocommerce') {
      // TODO: WooCommerce Service
    }

    // Mark sync completion
    await prisma.ecomStore.update({
      where: { id: storeId },
      data: { syncStatus: 'synced', lastSyncedAt: new Date(), updatedAt: new Date() },
    });

    res.json({ message: `${type || 'all'} sync completed successfully`, storeId, type });
  } catch (err) {
    console.error('[Ecom/Stores] Sync error:', err);
    await prisma.ecomStore.update({
      where: { id: req.params.storeId },
      data: { syncStatus: 'error', updatedAt: new Date() },
    });
    res.status(500).json({ message: 'Sync failed' });
  }
});

/**
 * DELETE /api/ecommerce/stores/:storeId
 * Disconnect a store
 */
router.delete('/stores/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = getUserId(req);

    const store = await prisma.ecomStore.findFirst({ where: { id: storeId, userId } });
    if (!store) return res.status(404).json({ message: 'Store not found' });

    // Permanently delete the store record so it doesn't reappear
    await prisma.ecomStore.delete({ where: { id: storeId } });

    res.json({ message: 'Store disconnected successfully' });
  } catch (err) {
    console.error('[Ecom/Stores] DELETE error:', err);
    res.status(500).json({ message: 'Failed to disconnect store' });
  }
});

// ══════════════════════════════════════════════
// ORDERS
// ══════════════════════════════════════════════

/**
 * GET /api/ecommerce/orders
 * List orders with filters and pagination
 */
router.get('/orders', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status, platform, search, page = 1, limit = 20, storeId } = req.query;

    const where = { userId };
    if (storeId) where.storeId = storeId;
    if (status) where.orderStatus = status;
    if (search) {
      where.OR = [
        { externalOrderId: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.ecomOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        include: { store: { select: { storeName: true, platform: true } } },
      }),
      prisma.ecomOrder.count({ where }),
    ]);

    res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[Ecom/Orders] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

/**
 * POST /api/ecommerce/orders/:orderId/notify
 * Send WhatsApp notification for an order
 */
router.post('/orders/:orderId/notify', async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = getUserId(req);
    const { templateName } = req.body;

    const order = await prisma.ecomOrder.findFirst({
      where: { id: orderId, userId },
      include: { store: true }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (!order.customerPhone) {
      return res.status(400).json({ message: 'Order has no customer phone number to notify.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.wabaId || !user.metaToken || !user.phoneNumberId) {
      return res.status(400).json({ message: 'WhatsApp API credentials not configured.' });
    }

    // 1. Look for best matching template
    let template = null;
    if (templateName) {
      template = await prisma.ecomTemplate.findFirst({
        where: { userId, name: templateName }
      }) || await prisma.template.findFirst({
        where: { userId, name: templateName }
      });
    }

    if (!template) {
      // Look for any approved template from EcomTemplate
      template = await prisma.ecomTemplate.findFirst({
        where: { userId, status: 'APPROVED' }
      }) || await prisma.template.findFirst({
        where: { userId, status: 'APPROVED' }
      }) || await prisma.ecomTemplate.findFirst({
        where: { userId }
      }) || await prisma.template.findFirst({
        where: { userId }
      });
    }

    if (!template) {
      return res.status(400).json({ message: 'No WhatsApp templates found. Please create a template first.' });
    }

    // 2. Prepare variables map
    const variablesMap = {
      customer_name: order.customerName || 'Customer',
      order_id: order.externalOrderId || '',
      order_amount: order.totalAmount ? `₹${parseFloat(order.totalAmount).toLocaleString()}` : '',
      product_name: Array.isArray(order.lineItems) && order.lineItems[0]
        ? (order.lineItems[0].title || order.lineItems[0].name || '')
        : 'items',
      tracking_link: order.trackingUrl || '',
      coupon_code: '',
      shop_link: order.store?.domain ? `https://${order.store.domain}` : ''
    };

    // 3. Construct parameters
    const convertedBody = convertVariablesToMetaFormat(template.body);
    const varCount = (convertedBody.match(/\{\{\d+\}\}/g) || []).length;
    const parameters = [];
    const varsArray = template.variables || [];

    for (let i = 0; i < varCount; i++) {
      const varName = varsArray[i] || '';
      const resolvedVal = variablesMap[varName.toLowerCase()] || variablesMap[varName.toLowerCase().replace(/_/g, '')] || 'Update';
      parameters.push({ type: 'text', text: String(resolvedVal) });
    }

    const components = [];
    if (parameters.length > 0) {
      components.push({
        type: 'body',
        parameters
      });
    }

    // 4. Send template via Meta API
    const decryptedToken = decrypt(user.metaToken);
    const MetaApiService = require('../services/MetaApiService');
    const cleanPhone = order.customerPhone.replace(/[^\d]/g, '');

    const sendRes = await MetaApiService.sendTemplate({
      phoneNumberId: user.phoneNumberId,
      token: decryptedToken,
      to: cleanPhone,
      templateName: template.name,
      language: template.language || 'en',
      components: components,
      context: { userId, orderId: order.id, recipient: cleanPhone }
    });

    // 5. Update database order status
    await prisma.ecomOrder.update({
      where: { id: orderId },
      data: {
        lastNotifiedAt: new Date(),
        whatsappStatus: 'sent'
      },
    });

    // Also log outbound message to MessageLog so it shows up in Chat history!
    try {
      await prisma.messageLog.create({
        data: {
          userId,
          messageId: sendRes.messageId,
          recipient: cleanPhone,
          direction: 'OUTBOUND',
          status: 'SENT',
          content: {
            type: 'template',
            templateName: template.name,
            resolvedBody: template.body.replace(/\{\{([a-zA-Z_]+)\}\}/g, (_, name) => variablesMap[name.toLowerCase()] || 'Update'),
            components: template.components ? (typeof template.components === 'string' ? JSON.parse(template.components) : template.components) : []
          }
        }
      });
    } catch (logErr) {
      console.warn('[Ecom/Orders] Failed to create outbound message log:', logErr.message);
    }

    res.json({ message: 'WhatsApp notification sent successfully', orderId, messageId: sendRes.messageId });

  } catch (err) {
    console.error('[Ecom/Orders] Notify error:', err.response?.data || err.message);
    const metaErrMsg = err.response?.data?.error?.message || err.message;
    
    // Save failed status to database
    try {
      const { orderId } = req.params;
      await prisma.ecomOrder.update({
        where: { id: orderId },
        data: { whatsappStatus: 'failed' }
      });
    } catch (_) {}

    res.status(500).json({ message: `Failed to send WhatsApp update: ${metaErrMsg}` });
  }
});

// ══════════════════════════════════════════════
// CUSTOMERS
// ══════════════════════════════════════════════

/**
 * GET /api/ecommerce/customers
 */
router.get('/customers', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { search, segment, storeId, page = 1, limit = 20 } = req.query;

    const where = { userId };
    if (storeId) where.storeId = storeId;
    if (segment && segment !== 'all') where.segment = segment;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.ecomCustomer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        include: { store: { select: { storeName: true, platform: true } } },
      }),
      prisma.ecomCustomer.count({ where }),
    ]);

    res.json({ customers, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[Ecom/Customers] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch customers' });
  }
});

// ══════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════

/**
 * GET /api/ecommerce/products
 */
router.get('/products', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { search, status, storeId, page = 1, limit = 20 } = req.query;

    const where = { userId };
    if (storeId) where.storeId = storeId;
    if (status) where.stockStatus = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.ecomProduct.findMany({
        where,
        orderBy: { syncedAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        include: { store: { select: { storeName: true, platform: true } } },
      }),
      prisma.ecomProduct.count({ where }),
    ]);

    res.json({ products, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[Ecom/Products] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// ══════════════════════════════════════════════
// ABANDONED CARTS
// ══════════════════════════════════════════════

/**
 * GET /api/ecommerce/abandoned-carts
 */
router.get('/abandoned-carts', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status, storeId, page = 1, limit = 20 } = req.query;

    const where = { userId };
    if (storeId) where.storeId = storeId;
    if (status) where.recoveryStatus = status;

    const [carts, total] = await Promise.all([
      prisma.ecomAbandonedCart.findMany({
        where,
        orderBy: { abandonedAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        include: { store: { select: { storeName: true, platform: true } } },
      }),
      prisma.ecomAbandonedCart.count({ where }),
    ]);

    const stats = {
      total: await prisma.ecomAbandonedCart.count({ where: { userId } }),
      pending: await prisma.ecomAbandonedCart.count({ where: { userId, recoveryStatus: 'pending' } }),
      recovered: await prisma.ecomAbandonedCart.count({ where: { userId, recoveryStatus: 'recovered' } }),
    };

    res.json({ carts, total, stats, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[Ecom/AbandonedCarts] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch abandoned carts' });
  }
});

/**
 * POST /api/ecommerce/abandoned-carts/:cartId/remind
 * Send a recovery reminder message
 */
router.post('/abandoned-carts/:cartId/remind', async (req, res) => {
  try {
    const { cartId } = req.params;
    const userId = getUserId(req);
    const { step, templateName } = req.body;

    const cart = await prisma.ecomAbandonedCart.findFirst({ where: { id: cartId, userId } });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    // TODO: Send WhatsApp reminder
    // await sendCartReminder({ cart, step, templateName });

    await prisma.ecomAbandonedCart.update({
      where: { id: cartId },
      data: { reminderCount: { increment: 1 }, lastReminderAt: new Date() },
    });

    res.json({ message: `Reminder step ${step} sent`, cartId });
  } catch (err) {
    console.error('[Ecom/AbandonedCarts] Remind error:', err);
    res.status(500).json({ message: 'Failed to send reminder' });
  }
});

// ══════════════════════════════════════════════
// AUTOMATIONS
// ══════════════════════════════════════════════

/**
 * GET /api/ecommerce/automations
 */
router.get('/automations', async (req, res) => {
  try {
    const userId = getUserId(req);
    const automations = await prisma.ecomAutomation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ automations });
  } catch (err) {
    console.error('[Ecom/Automations] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch automations' });
  }
});

/**
 * POST /api/ecommerce/automations
 * Create a new automation
 */
router.post('/automations', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, triggerType, storeScope, flowJson } = req.body;

    if (!name || !triggerType) {
      return res.status(400).json({ message: 'Name and trigger type are required' });
    }

    const automation = await prisma.ecomAutomation.create({
      data: { userId, name, triggerType, storeScope: storeScope || 'all', flowJson: flowJson || {}, status: 'draft' },
    });

    res.status(201).json({ automation, message: 'Automation created' });
  } catch (err) {
    console.error('[Ecom/Automations] POST error:', err);
    res.status(500).json({ message: 'Failed to create automation' });
  }
});

/**
 * PATCH /api/ecommerce/automations/:id/toggle
 * Toggle automation active/paused
 */
router.patch('/automations/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const auto = await prisma.ecomAutomation.findFirst({ where: { id, userId } });
    if (!auto) return res.status(404).json({ message: 'Automation not found' });

    const newStatus = auto.status === 'active' ? 'paused' : 'active';
    const updated = await prisma.ecomAutomation.update({ where: { id }, data: { status: newStatus } });

    res.json({ automation: updated, message: `Automation ${newStatus}` });
  } catch (err) {
    console.error('[Ecom/Automations] Toggle error:', err);
    res.status(500).json({ message: 'Failed to toggle automation' });
  }
});

/**
 * DELETE /api/ecommerce/automations/:id
 */
router.delete('/automations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const auto = await prisma.ecomAutomation.findFirst({ where: { id, userId } });
    if (!auto) return res.status(404).json({ message: 'Automation not found' });

    await prisma.ecomAutomation.delete({ where: { id } });
    res.json({ message: 'Automation deleted' });
  } catch (err) {
    console.error('[Ecom/Automations] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete automation' });
  }
});

// ══════════════════════════════════════════════
// CAMPAIGNS
// ══════════════════════════════════════════════

/**
 * GET /api/ecommerce/campaigns
 */
router.get('/campaigns', async (req, res) => {
  try {
    const userId = getUserId(req);
    const campaigns = await prisma.ecomCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { store: { select: { storeName: true, platform: true } } },
    });

    // Fetch dynamic status counts from message logs
    const logs = await prisma.messageLog.groupBy({
      by: ['ecomCampaignId', 'status'],
      where: { userId, ecomCampaignId: { not: null } },
      _count: { id: true }
    });

    const statsMap = {};
    logs.forEach(row => {
      if (!row.ecomCampaignId) return;
      if (!statsMap[row.ecomCampaignId]) {
        statsMap[row.ecomCampaignId] = { SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0 };
      }
      statsMap[row.ecomCampaignId][row.status] = row._count.id;
    });

    const mappedCampaigns = campaigns.map(c => {
      const stats = statsMap[c.id] || { SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0 };
      const sent = stats.SENT + stats.DELIVERED + stats.READ + stats.FAILED;
      return {
        ...c,
        type: c.campaignType,
        targetAudience: c.audienceCount,
        sent: sent,
        delivered: stats.DELIVERED + stats.READ,
        read: stats.READ,
        clicks: c.clickCount,
        revenue: Number(c.revenueAttributed),
      };
    });

    res.json({ campaigns: mappedCampaigns });
  } catch (err) {
    console.error('[Ecom/Campaigns] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch campaigns' });
  }
});

/**
 * POST /api/ecommerce/campaigns
 */
router.post('/campaigns', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, type, storeId, audienceSegment, audience, templateName, scheduledAt } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: 'Campaign name and type are required' });
    }

    const resolvedAudience = audienceSegment || audience || 'all';

    const campaign = await prisma.ecomCampaign.create({
      data: {
        userId,
        name,
        campaignType: type,
        storeId: storeId && storeId !== 'all' ? storeId : null,
        audienceSegment: resolvedAudience,
        templateName: templateName || null,
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
      include: { store: { select: { storeName: true, platform: true } } },
    });

    // If not scheduled, trigger immediate execution in background
    if (!scheduledAt) {
      executeEcomCampaign(campaign.id).catch(err => {
        console.error(`[Ecom/Campaigns] Immediate execution error for campaign ${campaign.id}:`, err);
      });
    }

    // Map to frontend structure
    const mappedCampaign = {
      ...campaign,
      type: campaign.campaignType,
      targetAudience: campaign.audienceCount,
      sent: 0,
      delivered: 0,
      read: 0,
      clicks: campaign.clickCount,
      revenue: Number(campaign.revenueAttributed),
    };

    res.status(201).json({ campaign: mappedCampaign, message: 'Campaign created' });
  } catch (err) {
    console.error('[Ecom/Campaigns] POST error:', err);
    res.status(500).json({ message: 'Failed to create campaign' });
  }
});

/**
 * DELETE /api/ecommerce/campaigns/:id
 */
router.delete('/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const campaign = await prisma.ecomCampaign.findFirst({ where: { id, userId } });
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    await prisma.ecomCampaign.delete({ where: { id } });
    res.json({ message: 'Campaign deleted' });
  } catch (err) {
    console.error('[Ecom/Campaigns] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete campaign' });
  }
});

// ══════════════════════════════════════════════
// TEMPLATES
// ══════════════════════════════════════════════

/**
 * GET /api/ecommerce/templates
 */
router.get('/templates', async (req, res) => {
  try {
    const userId = getUserId(req);
    const templates = await prisma.ecomTemplate.findMany({
      where: { userId },
      orderBy: { usageCount: 'desc' },
    });

    // Dynamically sync status from the main Template table
    const updatedTemplates = await Promise.all(templates.map(async (tpl) => {
      const mainTpl = await prisma.template.findFirst({
        where: {
          userId,
          name: tpl.name,
        }
      });
      if (mainTpl && mainTpl.status !== tpl.status) {
        // Sync in database
        const updated = await prisma.ecomTemplate.update({
          where: { id: tpl.id },
          data: { status: mainTpl.status }
        });
        return updated;
      }
      return tpl;
    }));

    res.json({ templates: updatedTemplates });
  } catch (err) {
    console.error('[Ecom/Templates] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

function convertVariablesToMetaFormat(body) {
  let index = 1;
  return body.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, () => {
    return `{{${index++}}}`;
  });
}

/**
 * POST /api/ecommerce/templates
 */
router.post('/templates', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { displayName, category, body, language, variables } = req.body;

    if (!displayName || !body) {
      return res.status(400).json({ message: 'Display name and body are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.wabaId || !user.metaToken) {
      return res.status(400).json({ message: 'Meta API credentials not configured. Please connect your WhatsApp settings first.' });
    }

    const convertedBody = convertVariablesToMetaFormat(body);
    const nameFormatted = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const categoryMap = {
      promotion: 'MARKETING',
      order: 'UTILITY',
      shipping: 'UTILITY',
      cart: 'UTILITY',
      support: 'UTILITY',
      general: 'UTILITY'
    };
    const metaCategory = categoryMap[category] || 'UTILITY';

    const components = [
      {
        type: 'BODY',
        text: convertedBody
      }
    ];

    // Meta API mandates body text examples if variables are present
    const varCount = (convertedBody.match(/\{\{\d+\}\}/g) || []).length;
    if (varCount > 0) {
      const samples = [];
      for (let i = 1; i <= varCount; i++) {
        samples.push(`Sample ${i}`);
      }
      components[0].example = {
        body_text: [samples]
      };
    }

    const decryptedToken = decrypt(user.metaToken);
    const { version } = await getMetaConfig();

    // Register template on Meta WhatsApp platform
    await axios.post(
      `https://graph.facebook.com/${version}/${user.wabaId}/message_templates`,
      {
        name: nameFormatted,
        category: metaCategory,
        language: language || 'en',
        components
      },
      { headers: { Authorization: `Bearer ${decryptedToken}` } }
    );

    const template = await prisma.ecomTemplate.create({
      data: {
        userId,
        name: nameFormatted,
        displayName,
        category: category || 'general',
        body,
        language: language || 'en',
        variables: variables || [],
        status: 'PENDING',
      },
    });

    // Also upsert/create in the main Template table so it shows up in Live Chat/Campaigns immediately
    try {
      const existingMain = await prisma.template.findFirst({
        where: {
          userId,
          name: nameFormatted,
          language: language || 'en'
        }
      });

      const mainTemplateData = {
        userId,
        name: nameFormatted,
        language: language || 'en',
        category: metaCategory,
        body: convertedBody,
        status: 'PENDING',
        components: components
      };

      if (existingMain) {
        await prisma.template.update({
          where: { id: existingMain.id },
          data: mainTemplateData
        });
      } else {
        await prisma.template.create({
          data: mainTemplateData
        });
      }
    } catch (mainTplErr) {
      console.warn('[Ecom/Templates] Failed to create main template record:', mainTplErr.message);
    }

    res.status(201).json({ template, message: 'Template created successfully' });
  } catch (err) {
    console.error('[Ecom/Templates] POST error:', err.response?.data || err.message);
    const metaErr = err.response?.data?.error;
    const errMsg = metaErr?.error_user_msg || metaErr?.message || err.message || 'Failed to create template';
    res.status(400).json({ message: `Meta API: ${errMsg}` });
  }
});

/**
 * DELETE /api/ecommerce/templates/:id
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const template = await prisma.ecomTemplate.findFirst({ where: { id, userId } });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    // Call Meta API to delete template
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.wabaId && user.metaToken) {
        const decryptedToken = decrypt(user.metaToken);
        const { version } = await getMetaConfig();
        await axios.delete(
          `https://graph.facebook.com/${version}/${user.wabaId}/message_templates?name=${template.name}`,
          { headers: { Authorization: `Bearer ${decryptedToken}` } }
        );
      }
    } catch (metaErr) {
      console.warn('[Ecom/Templates] Failed to delete template from Meta:', metaErr.response?.data || metaErr.message);
    }

    await prisma.ecomTemplate.delete({ where: { id } });

    // Also delete from main Template table
    try {
      await prisma.template.deleteMany({
        where: {
          userId,
          name: template.name
        }
      });
    } catch (mainDelErr) {
      console.warn('[Ecom/Templates] Failed to delete main template record:', mainDelErr.message);
    }

    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('[Ecom/Templates] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete template' });
  }
});

// ══════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════

/**
 * GET /api/ecommerce/analytics/overview
 * Returns aggregated ecommerce analytics for the user
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { period = '7d' } = req.query;

    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalStores, totalOrders, totalRevenue, totalCarts,
      recoveredCarts, totalCustomers, totalAutomations, messagesSent,
      ordersList, cartsList, customersList, messagesList, storesList
    ] = await Promise.all([
      prisma.ecomStore.count({ where: { userId, status: 'connected' } }),
      prisma.ecomOrder.count({ where: { userId, createdAt: { gte: since } } }),
      prisma.ecomOrder.aggregate({ where: { userId, createdAt: { gte: since } }, _sum: { totalAmount: true } }),
      prisma.ecomAbandonedCart.count({ where: { userId, abandonedAt: { gte: since } } }),
      prisma.ecomAbandonedCart.count({ where: { userId, recoveryStatus: 'recovered', recoveredAt: { gte: since } } }),
      prisma.ecomCustomer.count({ where: { userId } }),
      prisma.ecomAutomation.count({ where: { userId, status: 'active' } }),
      prisma.messageLog.count({ where: { userId, ecomCampaignId: { not: null } } }),
      prisma.ecomOrder.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { createdAt: true, totalAmount: true }
      }),
      prisma.ecomAbandonedCart.findMany({
        where: { userId, abandonedAt: { gte: since } },
        select: { abandonedAt: true, recoveryStatus: true }
      }),
      prisma.ecomCustomer.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { createdAt: true }
      }),
      prisma.messageLog.findMany({
        where: { userId, direction: 'OUTBOUND', timestamp: { gte: since }, NOT: { ecomCampaignId: null } },
        select: { timestamp: true }
      }),
      prisma.ecomStore.findMany({
        where: { userId },
        select: { connectedAt: true }
      })
    ]);

    const recoveryRate = totalCarts > 0 ? ((recoveredCarts / totalCarts) * 100).toFixed(1) : 0;

    // Helpers to bin daily data
    const getBinIndex = (date) => {
      const msDiff = Date.now() - new Date(date).getTime();
      const dayDiff = Math.floor(msDiff / (24 * 60 * 60 * 1000));
      return Math.max(0, Math.min(days - 1, (days - 1) - dayDiff));
    };

    const sparks = {
      stores: Array(days).fill(0),
      orders: Array(days).fill(0),
      revenue: Array(days).fill(0),
      recoveredCarts: Array(days).fill(0),
      messages: Array(days).fill(0),
      customers: Array(days).fill(0),
      automations: Array(days).fill(0),
      carts: Array(days).fill(0)
    };

    // Populate
    ordersList.forEach(o => {
      const idx = getBinIndex(o.createdAt);
      sparks.orders[idx]++;
      sparks.revenue[idx] += Number(o.totalAmount || 0);
    });

    cartsList.forEach(c => {
      const idx = getBinIndex(c.abandonedAt);
      sparks.carts[idx]++;
      if (c.recoveryStatus === 'recovered') {
        sparks.recoveredCarts[idx]++;
      }
    });

    customersList.forEach(c => {
      const idx = getBinIndex(c.createdAt);
      sparks.customers[idx]++;
    });

    messagesList.forEach(m => {
      const idx = getBinIndex(m.timestamp);
      sparks.messages[idx]++;
    });

    // For stores: progressive count
    storesList.forEach(s => {
      const idx = getBinIndex(s.connectedAt);
      for (let i = idx; i < days; i++) {
        sparks.stores[i]++;
      }
    });

    if (sparks.stores.every(v => v === 0)) {
      sparks.stores = Array(days).fill(totalStores);
    }

    sparks.automations = Array(days).fill(totalAutomations);

    res.json({
      period,
      stats: {
        totalStores,
        totalOrders,
        totalRevenue: totalRevenue._sum?.totalAmount || 0,
        totalCarts,
        recoveredCarts,
        recoveryRate,
        totalCustomers,
        totalAutomations,
        messagesSent,
      },
      sparks
    });
  } catch (err) {
    console.error('[Ecom/Analytics] Overview error:', err);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/ecommerce/analytics
 * Returns detailed aggregated analytics for the analytics page
 */
router.get('/analytics', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { period = '7d' } = req.query;

    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get store count to check if any stores are connected
    const totalStores = await prisma.ecomStore.count({ where: { userId, status: 'connected' } });
    if (totalStores === 0) {
      return res.json({
        hasConnectedStores: false,
        kpiCards: [],
        revenueData: [],
        cartRecoveryData: [],
        orderStatusSegments: [],
        msgData: [],
        platformSplit: [],
        topProducts: [],
        campaignPerformance: []
      });
    }

    // If stores are connected, run aggregations
    const [
      totalOrders, totalRevenue, totalCarts, recoveredCarts,
      totalCustomers, automations, messagesSent,
      ordersList, cartsList, customersList, messagesList,
      storePlatforms, topProductsList, campaignList
    ] = await Promise.all([
      prisma.ecomOrder.count({ where: { userId, createdAt: { gte: since } } }),
      prisma.ecomOrder.aggregate({ where: { userId, createdAt: { gte: since } }, _sum: { totalAmount: true } }),
      prisma.ecomAbandonedCart.count({ where: { userId, abandonedAt: { gte: since } } }),
      prisma.ecomAbandonedCart.count({ where: { userId, recoveryStatus: 'recovered', recoveredAt: { gte: since } } }),
      prisma.ecomCustomer.count({ where: { userId } }),
      prisma.ecomAutomation.findMany({ where: { userId } }),
      prisma.messageLog.count({ where: { userId, ecomCampaignId: { not: null } } }),
      
      // Daily groupings lists
      prisma.ecomOrder.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { createdAt: true, totalAmount: true }
      }),
      prisma.ecomAbandonedCart.findMany({
        where: { userId, abandonedAt: { gte: since } },
        select: { abandonedAt: true, recoveryStatus: true }
      }),
      prisma.ecomCustomer.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { createdAt: true }
      }),
      prisma.messageLog.findMany({
        where: { userId, direction: 'OUTBOUND', timestamp: { gte: since }, NOT: { ecomCampaignId: null } },
        select: { timestamp: true }
      }),
      
      // Platform split
      prisma.ecomStore.groupBy({
        by: ['platform'],
        where: { userId, status: 'connected' },
        _count: { id: true }
      }),
      
      // Top products list
      prisma.ecomProduct.findMany({
        where: { userId },
        orderBy: { totalSold: 'desc' },
        take: 5
      }),

      // Campaign list
      prisma.ecomCampaign.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3
      })
    ]);

    // Calculate dynamic values
    const recoveryRate = totalCarts > 0 ? ((recoveredCarts / totalCarts) * 100).toFixed(1) : "0.0";
    const totalAutomationRuns = automations.reduce((acc, auto) => acc + (auto.totalRuns || 0), 0);
    const successRuns = automations.reduce((acc, auto) => acc + (auto.successRuns || 0), 0);
    const successRate = totalAutomationRuns > 0 ? ((successRuns / totalAutomationRuns) * 100).toFixed(1) : "100.0";

    // Format daily data
    const getLabel = (date) => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const binDailyData = (list, dateField, valueField = null) => {
      const dailyMap = {};
      // Initialize daily keys for last N days
      for (let i = days - 1; i >= 0; i--) {
        const dt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        dailyMap[getLabel(dt)] = 0;
      }
      list.forEach(item => {
        const lbl = getLabel(item[dateField]);
        if (dailyMap[lbl] !== undefined) {
          if (valueField) {
            dailyMap[lbl] += Number(item[valueField] || 0);
          } else {
            dailyMap[lbl]++;
          }
        }
      });
      return Object.keys(dailyMap).map(key => ({ label: key, val: dailyMap[key] }));
    };

    const revenueData = binDailyData(ordersList, 'createdAt', 'totalAmount');
    const cartRecoveryData = binDailyData(cartsList.filter(c => c.recoveryStatus === 'recovered'), 'abandonedAt');
    
    // Messages sent per day
    const weekdayMap = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
    const msgDataMap = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 };
    messagesList.forEach(m => {
      const dayName = weekdayMap[new Date(m.timestamp).getDay()];
      if (msgDataMap[dayName] !== undefined) msgDataMap[dayName]++;
    });
    const msgData = Object.keys(msgDataMap).map(key => ({ label: key, val: msgDataMap[key] }));

    // Order status segments
    const statusCounts = await prisma.ecomOrder.groupBy({
      by: ['orderStatus'],
      where: { userId, createdAt: { gte: since } },
      _count: { id: true }
    });
    const statusColorMap = {
      delivered: '#10b981',
      shipped: '#06b6d4',
      processing: '#818cf8',
      pending: '#f59e0b',
      cancelled: '#ef4444',
      confirmed: '#3b82f6'
    };
    const orderStatusSegments = statusCounts.map(sc => ({
      label: sc.orderStatus.charAt(0).toUpperCase() + sc.orderStatus.slice(1),
      val: sc._count.id,
      color: statusColorMap[sc.orderStatus.toLowerCase()] || '#9ca3af'
    }));
    if (orderStatusSegments.length === 0) {
      orderStatusSegments.push({ label: 'No Orders', val: 0, color: '#9ca3af' });
    }

    // Platform split
    const platformColors = { shopify: '#96bf48', woocommerce: '#7f54b3' };
    const platformSplit = storePlatforms.map(sp => ({
      label: sp.platform.charAt(0).toUpperCase() + sp.platform.slice(1),
      val: sp._count.id,
      color: platformColors[sp.platform.toLowerCase()] || '#6b7280'
    }));

    // Top products
    const topProducts = topProductsList.map(p => ({
      name: p.title,
      orders: p.totalSold || 0,
      revenue: Number(p.price || 0) * (p.totalSold || 0),
      growth: 0 // Default growth
    }));

    // Campaign Performance
    const ecomCampaignIds = campaignList.map(c => c.id);
    const campaignLogs = await prisma.messageLog.groupBy({
      by: ['ecomCampaignId', 'status'],
      where: { userId, ecomCampaignId: { in: ecomCampaignIds } },
      _count: { id: true }
    });
    const campaignStatsMap = {};
    campaignLogs.forEach(row => {
      if (!row.ecomCampaignId) return;
      if (!campaignStatsMap[row.ecomCampaignId]) {
        campaignStatsMap[row.ecomCampaignId] = { SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0 };
      }
      campaignStatsMap[row.ecomCampaignId][row.status] = row._count.id;
    });

    const campaignPerformance = campaignList.map((c, idx) => {
      const stats = campaignStatsMap[c.id] || { SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0 };
      const sent = stats.SENT + stats.DELIVERED + stats.READ + stats.FAILED;
      const read = stats.READ;
      const ctr = sent > 0 ? ((read / sent) * 100).toFixed(1) + '%' : '0.0%';
      const colors = ['#818cf8', '#10b981', '#f59e0b'];
      return {
        label: c.name,
        sent,
        read,
        ctr,
        revenue: '₹' + Number(c.revenueAttributed || 0).toLocaleString(),
        color: colors[idx % colors.length]
      };
    });

    // KPI Cards
    const revenueSum = totalRevenue._sum?.totalAmount || 0;
    const kpiCards = [
      { label: 'Total Revenue', val: '₹' + Number(revenueSum).toLocaleString(), sub: 'Across all connected stores', up: true, color: '#00d9a5', icon: 'DollarSign' },
      { label: 'Orders', val: Number(totalOrders).toLocaleString(), sub: 'Orders in period', up: true, color: '#818cf8', icon: 'ShoppingCart' },
      { label: 'Cart Recovery Rate', val: recoveryRate + '%', sub: `${recoveredCarts} carts recovered`, up: true, color: '#10b981', icon: 'RotateCcw' },
      { label: 'WhatsApp Sent', val: Number(messagesSent).toLocaleString(), sub: 'Outbound campaign messages', up: true, color: '#f59e0b', icon: 'MessageSquare' },
      { label: 'New Customers', val: Number(totalCustomers).toLocaleString(), sub: 'Total synced customers', up: true, color: '#f472b6', icon: 'Users' },
      { label: 'Automation Runs', val: Number(totalAutomationRuns).toLocaleString(), sub: `${successRate}% success rate`, up: true, color: '#06b6d4', icon: 'Zap' },
    ];

    res.json({
      hasConnectedStores: true,
      kpiCards,
      revenueData,
      cartRecoveryData,
      orderStatusSegments,
      msgData,
      platformSplit,
      topProducts,
      campaignPerformance
    });
  } catch (err) {
    console.error('[Ecom/Analytics] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch analytics data' });
  }
});

// ══════════════════════════════════════════════
// WEBHOOK RECEIVER (unauthenticated)
// ══════════════════════════════════════════════

/**
 * POST /api/ecommerce/webhook/shopify/:userId
 * Receive Shopify webhook events
 */
router.post('/webhook/shopify/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const topic = req.headers['x-shopify-topic'];
    const payload = req.body;

    console.log(`[Ecom/Webhook] Shopify event: ${topic} for user: ${userId}`);

    // Log the webhook
    await prisma.ecomWebhookLog.create({
      data: {
        userId,
        platform: 'shopify',
        topic: topic || 'unknown',
        payload: payload,
        status: 'received',
      },
    });

    // TODO: Queue for processing
    // await webhookQueue.add('shopify-event', { userId, topic, payload });

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Ecom/Webhook] Shopify error:', err);
    res.status(200).json({ received: true }); // Always 200 to Shopify
  }
});

/**
 * POST /api/ecommerce/webhook/woocommerce/:userId
 * Receive WooCommerce webhook events
 */
router.post('/webhook/woocommerce/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const topic = req.headers['x-wc-webhook-topic'];
    const payload = req.body;

    console.log(`[Ecom/Webhook] WooCommerce event: ${topic} for user: ${userId}`);

    await prisma.ecomWebhookLog.create({
      data: {
        userId,
        platform: 'woocommerce',
        topic: topic || 'unknown',
        payload: payload,
        status: 'received',
      },
    });

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Ecom/Webhook] WooCommerce error:', err);
    res.status(200).json({ received: true });
  }
});

/**
 * GET /api/ecommerce/webhook-logs
 * Get recent webhook logs for admin view
 */
router.get('/webhook-logs', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { platform, status, page = 1, limit = 50 } = req.query;

    const where = { userId };
    if (platform) where.platform = platform;
    if (status) where.status = status;

    const logs = await prisma.ecomWebhookLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    res.json({ logs });
  } catch (err) {
    console.error('[Ecom/WebhookLogs] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch webhook logs' });
  }
});

module.exports = router;
