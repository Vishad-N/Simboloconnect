/**
 * WooCommerceService.js
 * Phase B — WooCommerce REST API v3 integration.
 * Syncs products, orders, and customers from WooCommerce stores.
 */
const axios = require('axios');
const prisma = require('../prismaClient');

class WooCommerceService {
    constructor(store) {
        this.store = store;
        let domain = store.domain || '';
        if (domain && !/^https?:\/\//i.test(domain)) {
            domain = `https://${domain}`;
        }
        domain = domain.replace(/\/+$/, '');
        this.baseUrl = `${domain}/wp-json/wc/v3`;
        this.auth = {
            username: store.apiKey,    // Consumer Key
            password: store.apiSecret  // Consumer Secret
        };
    }

    async _get(endpoint, params = {}) {
        const res = await axios.get(`${this.baseUrl}/${endpoint}`, {
            auth: this.auth,
            params: { per_page: 100, ...params }
        });
        return res.data;
    }

    /**
     * Sync all products from WooCommerce to EcomProduct
     */
    async syncProducts() {
        let page = 1;
        let synced = 0;

        while (true) {
            let products;
            try {
                products = await this._get('products', { page, status: 'publish' });
            } catch (err) {
                console.error('[WooCommerceService] syncProducts error:', err.response?.data || err.message);
                break;
            }

            if (!products.length) break;

            for (const prod of products) {
                const image = prod.images?.[0]?.src || null;
                const price = parseFloat(prod.price) || 0;
                const stock = prod.stock_quantity || 0;

                await prisma.ecomProduct.upsert({
                    where: { storeId_externalProductId: { storeId: this.store.id, externalProductId: String(prod.id) } },
                    update: {
                        title: prod.name,
                        description: prod.description?.replace(/<[^>]*>/g, '') || '',
                        sku: prod.sku || '',
                        price,
                        comparePrice: parseFloat(prod.regular_price) || null,
                        stock,
                        stockStatus: prod.in_stock ? 'active' : 'out_of_stock',
                        imageUrl: image,
                        syncedAt: new Date()
                    },
                    create: {
                        userId: this.store.userId,
                        storeId: this.store.id,
                        externalProductId: String(prod.id),
                        title: prod.name,
                        description: prod.description?.replace(/<[^>]*>/g, '') || '',
                        sku: prod.sku || '',
                        price,
                        comparePrice: parseFloat(prod.regular_price) || null,
                        stock,
                        stockStatus: prod.in_stock ? 'active' : 'out_of_stock',
                        imageUrl: image,
                        syncedAt: new Date()
                    }
                });
                synced++;
            }

            if (products.length < 100) break; // Last page
            page++;
        }

        console.log(`[WooCommerceService] Synced ${synced} products for store ${this.store.id}`);
        return synced;
    }

    /**
     * Sync recent orders from WooCommerce
     */
    async syncOrders() {
        const orders = await this._get('orders', { orderby: 'date', order: 'desc' });
        let synced = 0;

        for (const order of orders) {
            const customerPhone = order.billing?.phone || null;
            let paymentStatus = 'pending';
            if (['completed', 'processing'].includes(order.status)) paymentStatus = 'paid';
            if (order.status === 'refunded') paymentStatus = 'refunded';

            let orderStatus = 'pending';
            if (order.status === 'completed') orderStatus = 'delivered';
            if (order.status === 'processing') orderStatus = 'confirmed';
            if (order.status === 'cancelled') orderStatus = 'cancelled';

            try {
                await prisma.ecomOrder.upsert({
                    where: { storeId_externalOrderId: { storeId: this.store.id, externalOrderId: String(order.id) } },
                    update: { orderStatus, paymentStatus, totalAmount: order.total, currency: order.currency },
                    create: {
                        userId: this.store.userId,
                        storeId: this.store.id,
                        externalOrderId: String(order.id),
                        customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
                        customerPhone,
                        customerEmail: order.billing?.email || null,
                        orderStatus,
                        paymentStatus,
                        paymentMethod: order.payment_method_title || 'WooCommerce',
                        totalAmount: order.total,
                        currency: order.currency,
                        lineItems: order.line_items
                    }
                });
                synced++;
            } catch (e) {
                console.error(`[WooCommerceService] Failed to sync order ${order.id}:`, e.message);
            }
        }

        console.log(`[WooCommerceService] Synced ${synced} orders for store ${this.store.id}`);
        return synced;
    }

    /**
     * Sync customers from WooCommerce
     */
    async syncCustomers() {
        const customers = await this._get('customers');
        let synced = 0;

        for (const cust of customers) {
            try {
                await prisma.ecomCustomer.upsert({
                    where: { storeId_externalCustomerId: { storeId: this.store.id, externalCustomerId: String(cust.id) } },
                    update: {
                        name: `${cust.first_name || ''} ${cust.last_name || ''}`.trim(),
                        phone: cust.billing?.phone || null,
                        email: cust.email || null,
                        totalOrders: cust.orders_count || 0,
                        totalSpent: parseFloat(cust.total_spent) || 0
                    },
                    create: {
                        userId: this.store.userId,
                        storeId: this.store.id,
                        externalCustomerId: String(cust.id),
                        name: `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Unknown',
                        phone: cust.billing?.phone || null,
                        email: cust.email || null,
                        totalOrders: cust.orders_count || 0,
                        totalSpent: parseFloat(cust.total_spent) || 0,
                        segment: cust.orders_count > 2 ? 'loyal' : 'new'
                    }
                });
                synced++;
            } catch (e) {
                console.error(`[WooCommerceService] Failed to sync customer ${cust.id}:`, e.message);
            }
        }

        console.log(`[WooCommerceService] Synced ${synced} customers for store ${this.store.id}`);
        return synced;
    }
}

module.exports = WooCommerceService;
