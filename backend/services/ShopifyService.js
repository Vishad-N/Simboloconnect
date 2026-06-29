const axios = require('axios');
const prisma = require('../prismaClient');

class ShopifyService {
  constructor(store) {
    this.store = store;
    const cleanDomain = (store.domain || '').replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/+$/, '');
    this.baseUrl = `https://${cleanDomain}/admin/api/2023-10`;
    this.headers = {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json',
    };
  }

  async syncProducts() {
    try {
      const res = await axios.get(`${this.baseUrl}/products.json?limit=250`, { headers: this.headers });
      const products = res.data.products;
      
      for (const prod of products) {
        const firstVariant = prod.variants[0] || {};
        const image = prod.image ? prod.image.src : null;
        
        await prisma.ecomProduct.upsert({
          where: {
            storeId_externalProductId: {
              storeId: this.store.id,
              externalProductId: prod.id.toString()
            }
          },
          update: {
            title: prod.title,
            description: prod.body_html || '',
            sku: firstVariant.sku || '',
            price: firstVariant.price || 0,
            comparePrice: firstVariant.compare_at_price || null,
            stock: firstVariant.inventory_quantity || 0,
            stockStatus: firstVariant.inventory_quantity > 0 ? 'active' : 'out_of_stock',
            imageUrl: image,
            syncedAt: new Date()
          },
          create: {
            userId: this.store.userId,
            storeId: this.store.id,
            externalProductId: prod.id.toString(),
            title: prod.title,
            description: prod.body_html || '',
            sku: firstVariant.sku || '',
            price: firstVariant.price || 0,
            comparePrice: firstVariant.compare_at_price || null,
            stock: firstVariant.inventory_quantity || 0,
            stockStatus: firstVariant.inventory_quantity > 0 ? 'active' : 'out_of_stock',
            imageUrl: image,
            syncedAt: new Date()
          }
        });
      }
      return products.length;
    } catch (err) {
      console.error('[ShopifyService] syncProducts error:', err.response?.data || err.message);
      throw err;
    }
  }

  async syncOrders() {
    try {
      const res = await axios.get(`${this.baseUrl}/orders.json?status=any&limit=250`, { headers: this.headers });
      const orders = res.data.orders;
      
      for (const order of orders) {
        const customerPhone = order.customer?.phone || order.billing_address?.phone || order.phone || null;
        
        // Map Shopify financial status
        let paymentStatus = 'pending';
        if (order.financial_status === 'paid') paymentStatus = 'paid';
        if (order.financial_status === 'refunded') paymentStatus = 'refunded';
        
        // Map Shopify fulfillment status
        let orderStatus = 'pending';
        if (order.fulfillment_status === 'fulfilled') orderStatus = 'shipped';
        if (order.cancelled_at) orderStatus = 'cancelled';
        
        await prisma.ecomOrder.upsert({
          where: {
            storeId_externalOrderId: {
              storeId: this.store.id,
              externalOrderId: order.id.toString()
            }
          },
          update: {
            orderStatus,
            paymentStatus,
            totalAmount: order.total_price,
            currency: order.currency,
          },
          create: {
            userId: this.store.userId,
            storeId: this.store.id,
            externalOrderId: order.id.toString(),
            customerName: order.customer ? `${order.customer.first_name} ${order.customer.last_name}`.trim() : 'Unknown',
            customerPhone,
            customerEmail: order.email || null,
            orderStatus,
            paymentStatus,
            totalAmount: order.total_price,
            currency: order.currency,
            lineItems: order.line_items,
          }
        });
      }
      return orders.length;
    } catch (err) {
      console.error('[ShopifyService] syncOrders error:', err.response?.data || err.message);
      throw err;
    }
  }

  async syncCustomers() {
    try {
      const res = await axios.get(`${this.baseUrl}/customers.json?limit=250`, { headers: this.headers });
      const customers = res.data.customers;
      
      for (const cust of customers) {
        await prisma.ecomCustomer.upsert({
          where: {
            storeId_externalCustomerId: {
              storeId: this.store.id,
              externalCustomerId: cust.id.toString()
            }
          },
          update: {
            name: `${cust.first_name || ''} ${cust.last_name || ''}`.trim(),
            phone: cust.phone || null,
            email: cust.email || null,
            totalOrders: cust.orders_count || 0,
            totalSpent: cust.total_spent || 0,
          },
          create: {
            userId: this.store.userId,
            storeId: this.store.id,
            externalCustomerId: cust.id.toString(),
            name: `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Unknown',
            phone: cust.phone || null,
            email: cust.email || null,
            totalOrders: cust.orders_count || 0,
            totalSpent: cust.total_spent || 0,
            segment: cust.orders_count > 2 ? 'loyal' : 'new'
          }
        });
      }
      return customers.length;
    } catch (err) {
      console.error('[ShopifyService] syncCustomers error:', err.response?.data || err.message);
      throw err;
    }
  }
}

module.exports = ShopifyService;
