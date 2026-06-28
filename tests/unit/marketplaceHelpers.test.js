const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  formatProduct,
  formatCartItem,
  cartTotal,
} = require('../../src/backend/lib/marketplaceHelpers')

describe('marketplaceHelpers', () => {
  it('formatProduct exposes stock flags', () => {
    const product = formatProduct({
      id: 'p1',
      name: 'Uniform',
      description: 'Blue',
      category: 'Uniforms',
      sku: 'UNI-1',
      price: 5000,
      currency: 'NGN',
      imageUrl: null,
      sizes: ['S', 'M'],
      stockQty: 0,
      isActive: true,
      createdAt: new Date(),
    })
    assert.equal(product.inStock, false)
    assert.equal(product.price, 5000)
  })

  it('formatCartItem calculates subtotal', () => {
    const item = formatCartItem({
      id: 'c1',
      quantity: 2,
      size: 'M',
      product: {
        id: 'p1',
        name: 'Uniform',
        description: '',
        category: 'Uniforms',
        sku: 'UNI-1',
        price: 2500,
        currency: 'NGN',
        imageUrl: null,
        sizes: [],
        stockQty: 10,
        isActive: true,
        createdAt: new Date(),
      },
    })
    assert.equal(item.subtotal, 5000)
  })

  it('cartTotal skips inactive products', () => {
    const total = cartTotal([
      {
        quantity: 2,
        product: { price: 1000, isActive: true },
      },
      {
        quantity: 1,
        product: { price: 9999, isActive: false },
      },
    ])
    assert.equal(total, 2000)
  })
})
