const { uploadFile } = require('./uploadHelpers')

const ALLOWED_RECEIPT_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'image/webp'])

async function storeReceiptUpload({ fileBase64, mimeType, folder = 'payment-receipts' }) {
  if (!fileBase64) throw new Error('fileBase64 is required')
  const type = mimeType || 'image/jpeg'
  if (!ALLOWED_RECEIPT_MIMES.has(type)) {
    throw new Error('Only PDF, JPG, JPEG, PNG, or WebP allowed')
  }
  const result = await uploadFile({
    fileBase64,
    folder,
    resourceType: type === 'application/pdf' ? 'raw' : 'image',
    originalName: 'receipt',
  })
  return result.url
}

module.exports = { storeReceiptUpload, ALLOWED_RECEIPT_MIMES }
