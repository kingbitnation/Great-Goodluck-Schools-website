const { streamBrandedPdf } = require('./brandedPdf')

function streamSubscriptionInvoicePdf(res, { school, invoice, plan }) {
  const lines = [
    { text: 'SUBSCRIPTION INVOICE', size: 14, bold: true },
    { divider: true },
    `Invoice reference: ${invoice.reference}`,
    `Date: ${new Date(invoice.createdAt).toLocaleDateString()}`,
    `Status: ${invoice.status}`,
    { divider: true },
    `Plan: ${plan?.name || 'N/A'}`,
    `Billing: ${plan?.interval || 'monthly'}`,
    `Amount: ${invoice.currency} ${Number(invoice.amount).toLocaleString()}`,
    invoice.paidAt ? `Paid at: ${new Date(invoice.paidAt).toLocaleString()}` : '',
    { divider: true },
    'Thank you for subscribing to SchoolPilot.',
  ].filter(Boolean)

  streamBrandedPdf(res, {
    school,
    title: 'Subscription Invoice',
    filename: `invoice-${invoice.reference}`,
    lines,
  })
}

module.exports = { streamSubscriptionInvoicePdf }
