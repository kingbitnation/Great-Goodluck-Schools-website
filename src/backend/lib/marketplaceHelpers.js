const crypto = require('crypto')
const { checkTenantAccess } = require('./tenantHelpers')

function resolveSchoolId(req) {
  if (req.user?.role === 'SuperAdmin' && (req.query.schoolId || req.body?.schoolId)) {
    return String(req.query.schoolId || req.body.schoolId)
  }
  return req.user?.schoolId || req.query.schoolId || null
}

function generateOrderNumber(schoolId) {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `ORD-${String(schoolId).slice(0, 6)}-${Date.now().toString(36).toUpperCase()}-${suffix}`
}

function generateOrderReference(schoolId) {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `MKT-${String(schoolId).slice(0, 6)}-${suffix}`
}

function formatProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    sku: product.sku,
    price: product.price,
    currency: product.currency,
    imageUrl: product.imageUrl,
    sizes: product.sizes || [],
    stockQty: product.stockQty,
    isActive: product.isActive,
    inStock: product.stockQty > 0,
    createdAt: product.createdAt,
  }
}

function formatCartItem(item) {
  return {
    id: item.id,
    quantity: item.quantity,
    size: item.size,
    product: item.product ? formatProduct(item.product) : null,
    subtotal: item.product ? item.product.price * item.quantity : 0,
  }
}

function formatOrderItem(item) {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    size: item.size,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.subtotal,
  }
}

function formatOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    totalAmount: order.totalAmount,
    currency: order.currency,
    gateway: order.gateway,
    reference: order.reference,
    status: order.status,
    paymentReceiptUrl: order.paymentReceiptUrl,
    fulfillmentNotes: order.fulfillmentNotes,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    items: (order.items || []).map(formatOrderItem),
    itemCount: order.items?.length || 0,
  }
}

async function marketplaceStatsForSchool(prisma, schoolId) {
  const [products, activeProducts, lowStock, orders, revenue, pendingOrders] = await Promise.all([
    prisma.marketplaceProduct.count({ where: { schoolId } }),
    prisma.marketplaceProduct.count({ where: { schoolId, isActive: true } }),
    prisma.marketplaceProduct.count({ where: { schoolId, isActive: true, stockQty: { lte: 5 } } }),
    prisma.marketplaceOrder.count({ where: { schoolId } }),
    prisma.marketplaceOrder.aggregate({
      where: { schoolId, status: { in: ['paid', 'processing', 'fulfilled'] } },
      _sum: { totalAmount: true },
    }),
    prisma.marketplaceOrder.count({ where: { schoolId, status: 'pending' } }),
  ])
  return {
    products,
    activeProducts,
    lowStock,
    orders,
    revenue: revenue._sum.totalAmount || 0,
    pendingOrders,
  }
}

async function getCartWithProducts(prisma, userId) {
  return prisma.marketplaceCartItem.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: 'asc' },
  })
}

function cartTotal(items) {
  return items.reduce((sum, item) => {
    if (!item.product?.isActive) return sum
    return sum + item.product.price * item.quantity
  }, 0)
}

async function fulfillPaidOrder(prisma, order, notify) {
  if (order.status === 'paid') return order
  const updated = await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (!item.productId) continue
      const product = await tx.marketplaceProduct.findUnique({ where: { id: item.productId } })
      if (!product || product.stockQty < item.quantity) {
        throw new Error(`Insufficient stock for ${item.productName}`)
      }
      await tx.marketplaceProduct.update({
        where: { id: item.productId },
        data: { stockQty: product.stockQty - item.quantity },
      })
    }
    const result = await tx.marketplaceOrder.update({
      where: { id: order.id },
      data: { status: 'paid', paidAt: new Date() },
      include: { items: true, school: true },
    })
    await tx.marketplaceCartItem.deleteMany({ where: { userId: order.userId } })
    return result
  })

  if (notify) {
    await notify(prisma, {
      userId: updated.userId,
      schoolId: updated.schoolId,
      type: 'marketplace',
      title: 'Order confirmed',
      body: `Your order ${updated.orderNumber} (₦${updated.totalAmount.toLocaleString()}) has been confirmed.`,
      payload: { orderId: updated.id, reference: updated.reference },
      emailTemplate: 'payment_received',
      emailPayload: {
        amount: updated.totalAmount,
        feeName: `Marketplace order ${updated.orderNumber}`,
        reference: updated.reference,
      },
    }).catch(() => {})
  }

  return updated
}

module.exports = {
  resolveSchoolId,
  generateOrderNumber,
  generateOrderReference,
  formatProduct,
  formatCartItem,
  formatOrder,
  formatOrderItem,
  marketplaceStatsForSchool,
  getCartWithProducts,
  cartTotal,
  checkTenantAccess,
  fulfillPaidOrder,
}
