const {
  resolveSchoolId,
  generateOrderNumber,
  generateOrderReference,
  formatProduct,
  formatCartItem,
  formatOrder,
  marketplaceStatsForSchool,
  getCartWithProducts,
  cartTotal,
  checkTenantAccess,
  fulfillPaidOrder,
} = require('../lib/marketplaceHelpers')
const { streamMarketplaceOrderReceipt } = require('../lib/marketplaceOrderPdf')
const { dispatchNotification } = require('../lib/notificationDispatcher')
const { schoolBankDetails } = require('../lib/manualPaymentHelpers')

function registerMarketplaceRoutes(app, { prisma, requireRole }) {
  const adminRoles = ['SuperAdmin', 'SchoolAdmin']
  const shopRoles = ['Student', 'Parent', 'Teacher', ...adminRoles]

  function userId(req) {
    return req.user.userId || req.user.id
  }

  // ===== STATS =====
  app.get('/api/marketplace/stats', requireRole(...adminRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      res.json(await marketplaceStatsForSchool(prisma, schoolId))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== PRODUCTS =====
  app.get('/api/marketplace/products', requireRole(...shopRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.json([])

      const category = req.query.category ? String(req.query.category) : ''
      const q = req.query.q ? String(req.query.q).trim() : ''
      const adminView = adminRoles.includes(req.user.role)
      const where = {
        schoolId,
        ...(adminView ? {} : { isActive: true, stockQty: { gt: 0 } }),
        ...(category && category !== 'all' ? { category } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      }

      const products = await prisma.marketplaceProduct.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        take: 200,
      })
      res.json(products.map(formatProduct))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/marketplace/products', requireRole(...adminRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })
      const { name, description, category, sku, price, imageUrl, sizes, stockQty, isActive } = req.body
      if (!name || price == null) return res.status(400).json({ error: 'Name and price required' })

      const product = await prisma.marketplaceProduct.create({
        data: {
          schoolId,
          name,
          description: description || null,
          category: category || 'supplies',
          sku: sku || null,
          price: Number(price),
          imageUrl: imageUrl || null,
          sizes: Array.isArray(sizes) ? sizes : [],
          stockQty: stockQty != null ? Number(stockQty) : 0,
          isActive: isActive !== false,
        },
      })
      res.status(201).json(formatProduct(product))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.put('/api/marketplace/products/:id', requireRole(...adminRoles), async (req, res) => {
    try {
      const existing = await prisma.marketplaceProduct.findUnique({ where: { id: req.params.id } })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req, existing.schoolId)) return res.status(403).json({ error: 'Forbidden' })

      const product = await prisma.marketplaceProduct.update({
        where: { id: existing.id },
        data: {
          name: req.body.name,
          description: req.body.description,
          category: req.body.category,
          sku: req.body.sku,
          price: req.body.price != null ? Number(req.body.price) : undefined,
          imageUrl: req.body.imageUrl,
          sizes: Array.isArray(req.body.sizes) ? req.body.sizes : undefined,
          stockQty: req.body.stockQty != null ? Number(req.body.stockQty) : undefined,
          isActive: req.body.isActive,
        },
      })
      res.json(formatProduct(product))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/marketplace/products/:id/stock', requireRole(...adminRoles), async (req, res) => {
    try {
      const existing = await prisma.marketplaceProduct.findUnique({ where: { id: req.params.id } })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req, existing.schoolId)) return res.status(403).json({ error: 'Forbidden' })

      const delta = Number(req.body.delta)
      if (!Number.isFinite(delta)) return res.status(400).json({ error: 'delta required' })

      const product = await prisma.marketplaceProduct.update({
        where: { id: existing.id },
        data: { stockQty: Math.max(0, existing.stockQty + delta) },
      })
      res.json(formatProduct(product))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/marketplace/products/:id', requireRole(...adminRoles), async (req, res) => {
    try {
      const existing = await prisma.marketplaceProduct.findUnique({ where: { id: req.params.id } })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req, existing.schoolId)) return res.status(403).json({ error: 'Forbidden' })
      await prisma.marketplaceProduct.delete({ where: { id: existing.id } })
      res.json({ message: 'Deleted' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== CART =====
  app.get('/api/marketplace/cart', requireRole(...shopRoles), async (req, res) => {
    try {
      const items = await getCartWithProducts(prisma, userId(req))
      const valid = items.filter((i) => i.product?.isActive)
      res.json({
        items: valid.map(formatCartItem),
        total: cartTotal(valid),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.post('/api/marketplace/cart', requireRole(...shopRoles), async (req, res) => {
    try {
      const { productId, quantity = 1, size = null } = req.body
      if (!productId) return res.status(400).json({ error: 'productId required' })

      const product = await prisma.marketplaceProduct.findUnique({ where: { id: productId } })
      if (!product || !product.isActive) return res.status(404).json({ error: 'Product not found' })
      if (!checkTenantAccess(req, product.schoolId)) return res.status(403).json({ error: 'Forbidden' })
      if (product.sizes?.length && !size) return res.status(400).json({ error: 'Size required' })
      if (size && product.sizes?.length && !product.sizes.includes(size)) {
        return res.status(400).json({ error: 'Invalid size' })
      }

      const qty = Math.max(1, Number(quantity) || 1)
      const sizeKey = size ? String(size) : ''

      const existing = await prisma.marketplaceCartItem.findUnique({
        where: { userId_productId_size: { userId: userId(req), productId, size: sizeKey } },
      })
      const newQty = (existing?.quantity || 0) + qty
      if (newQty > product.stockQty) return res.status(400).json({ error: 'Insufficient stock' })

      const item = await prisma.marketplaceCartItem.upsert({
        where: { userId_productId_size: { userId: userId(req), productId, size: sizeKey } },
        update: { quantity: newQty },
        create: { userId: userId(req), productId, quantity: qty, size: sizeKey },
        include: { product: true },
      })
      res.status(201).json(formatCartItem(item))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/marketplace/cart/:id', requireRole(...shopRoles), async (req, res) => {
    try {
      const item = await prisma.marketplaceCartItem.findUnique({
        where: { id: req.params.id },
        include: { product: true },
      })
      if (!item || item.userId !== userId(req)) return res.status(404).json({ error: 'Not found' })

      const qty = Math.max(1, Number(req.body.quantity) || 1)
      if (qty > item.product.stockQty) return res.status(400).json({ error: 'Insufficient stock' })

      const updated = await prisma.marketplaceCartItem.update({
        where: { id: item.id },
        data: { quantity: qty },
        include: { product: true },
      })
      res.json(formatCartItem(updated))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/marketplace/cart/:id', requireRole(...shopRoles), async (req, res) => {
    try {
      const item = await prisma.marketplaceCartItem.findUnique({ where: { id: req.params.id } })
      if (!item || item.userId !== userId(req)) return res.status(404).json({ error: 'Not found' })
      await prisma.marketplaceCartItem.delete({ where: { id: item.id } })
      res.json({ message: 'Removed' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.delete('/api/marketplace/cart', requireRole(...shopRoles), async (req, res) => {
    try {
      await prisma.marketplaceCartItem.deleteMany({ where: { userId: userId(req) } })
      res.json({ message: 'Cart cleared' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  // ===== CHECKOUT =====
  app.post('/api/marketplace/checkout', requireRole(...shopRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      if (!schoolId) return res.status(400).json({ error: 'School required' })

      const cartItems = await getCartWithProducts(prisma, userId(req))
      const valid = cartItems.filter((i) => i.product?.isActive && i.product.schoolId === schoolId)
      if (!valid.length) return res.status(400).json({ error: 'Cart is empty' })

      for (const item of valid) {
        if (item.quantity > item.product.stockQty) {
          return res.status(400).json({ error: `Insufficient stock for ${item.product.name}` })
        }
      }

      const total = cartTotal(valid)
      const { customerName, customerEmail } = req.body
      const user = await prisma.user.findUnique({ where: { id: userId(req) } })
      const name = customerName || `${user.firstName} ${user.lastName}`.trim()
      const email = customerEmail || user.email

      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, bankName: true, bankAccountName: true, bankAccountNumber: true },
      })
      if (!school?.bankAccountNumber?.trim()) {
        return res.status(400).json({
          error: 'School bank account is not configured. Add bank details in Admin → School branding.',
        })
      }

      const orderNumber = generateOrderNumber(schoolId)
      const reference = generateOrderReference(schoolId)

      const order = await prisma.marketplaceOrder.create({
        data: {
          schoolId,
          userId: userId(req),
          orderNumber,
          customerName: name,
          customerEmail: email,
          totalAmount: total,
          gateway: 'manual',
          reference,
          status: 'pending',
          items: {
            create: valid.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              size: item.size,
              quantity: item.quantity,
              unitPrice: item.product.price,
              subtotal: item.product.price * item.quantity,
            })),
          },
        },
        include: { items: true },
      })

      res.json({
        orderId: order.id,
        orderNumber,
        reference,
        total,
        manual: true,
        bankDetails: schoolBankDetails(school, { amount: total, reference }),
        message: 'Transfer the amount using the reference below. Your order will be processed after payment confirmation.',
      })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Checkout failed' })
    }
  })

  app.post('/api/marketplace/orders/:id/upload-receipt', requireRole(...shopRoles), async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body
      if (!fileBase64) return res.status(400).json({ error: 'fileBase64 required' })

      const order = await prisma.marketplaceOrder.findUnique({ where: { id: req.params.id } })
      if (!order) return res.status(404).json({ error: 'Order not found' })
      if (order.userId !== userId(req) && !adminRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      if (order.gateway !== 'manual') {
        return res.status(400).json({ error: 'Receipt upload only for manual orders' })
      }

      const { storeReceiptUpload } = require('../lib/receiptUploadHelpers')
      const paymentReceiptUrl = await storeReceiptUpload({ fileBase64, mimeType, folder: 'shop-receipts' })

      const updated = await prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: { paymentReceiptUrl },
      })

      res.json({
        ...formatOrder(updated),
        message: 'Receipt uploaded. Your order will be processed after payment confirmation.',
      })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Upload failed' })
    }
  })

  app.post('/api/marketplace/orders/verify', requireRole(...shopRoles), async (req, res) => {
    try {
      const { reference } = req.body
      if (!reference) return res.status(400).json({ error: 'Reference required' })

      const order = await prisma.marketplaceOrder.findUnique({
        where: { reference },
        include: { items: true },
      })
      if (!order) return res.status(404).json({ error: 'Order not found' })
      if (order.userId !== userId(req) && !adminRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      res.json({
        ...formatOrder(order),
        message: order.status === 'pending'
          ? 'Payment pending confirmation. Contact the school after your bank transfer.'
          : 'Order updated.',
      })
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Verification failed' })
    }
  })

  // ===== ORDERS =====
  app.get('/api/marketplace/orders', requireRole(...shopRoles), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req)
      const where = {}
      if (schoolId) where.schoolId = schoolId
      if (!adminRoles.includes(req.user.role)) where.userId = userId(req)
      if (req.query.status) where.status = String(req.query.status)

      const orders = await prisma.marketplaceOrder.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      res.json(orders.map(formatOrder))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/marketplace/orders/:id', requireRole(...shopRoles), async (req, res) => {
    try {
      const order = await prisma.marketplaceOrder.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      })
      if (!order) return res.status(404).json({ error: 'Not found' })
      if (order.userId !== userId(req) && !checkTenantAccess(req, order.schoolId)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      res.json(formatOrder(order))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.get('/api/marketplace/orders/:id/receipt', requireRole(...shopRoles), async (req, res) => {
    try {
      const order = await prisma.marketplaceOrder.findUnique({
        where: { id: req.params.id },
        include: { items: true, school: true },
      })
      if (!order) return res.status(404).json({ error: 'Not found' })
      if (order.userId !== userId(req) && !checkTenantAccess(req, order.schoolId)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      if (!['paid', 'processing', 'fulfilled'].includes(order.status)) {
        return res.status(400).json({ error: 'Receipt available after payment' })
      }
      streamMarketplaceOrderReceipt(res, order, order.school)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Server error' })
    }
  })

  app.patch('/api/marketplace/orders/:id/status', requireRole(...adminRoles), async (req, res) => {
    try {
      const { status, fulfillmentNotes } = req.body
      const allowed = ['pending', 'paid', 'processing', 'fulfilled', 'cancelled']
      if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' })

      const existing = await prisma.marketplaceOrder.findUnique({
        where: { id: req.params.id },
        include: { items: true, school: true },
      })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      if (!checkTenantAccess(req, existing.schoolId)) return res.status(403).json({ error: 'Forbidden' })

      let updated
      if (status === 'paid' && existing.status === 'pending') {
        updated = await fulfillPaidOrder(prisma, existing, dispatchNotification)
        if (fulfillmentNotes) {
          updated = await prisma.marketplaceOrder.update({
            where: { id: existing.id },
            data: { fulfillmentNotes },
            include: { items: true },
          })
        }
      } else {
        updated = await prisma.marketplaceOrder.update({
          where: { id: existing.id },
          data: {
            status,
            fulfillmentNotes: fulfillmentNotes ?? existing.fulfillmentNotes,
            ...(status === 'paid' && !existing.paidAt ? { paidAt: new Date() } : {}),
          },
          include: { items: true },
        })
      }
      res.json(formatOrder(updated))
    } catch (err) {
      console.error(err)
      res.status(400).json({ error: err.message || 'Server error' })
    }
  })
}

module.exports = { registerMarketplaceRoutes }
