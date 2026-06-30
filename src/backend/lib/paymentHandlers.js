const { completePayment } = require('./financeHelpers')
const { deliverWebhook } = require('./webhookDispatcher')
const { onPaymentApproved } = require('./workflowEngine')

async function handleSuccessfulFeePayment(prisma, payment, paidAmount, { transactionId, gateway, dispatchNotification }) {
  const updated = await completePayment(prisma, payment, paidAmount, {
    transactionId,
    extra: { verificationStatus: 'approved', gateway },
  })

  if (dispatchNotification && updated.student?.user) {
    await dispatchNotification(prisma, {
      userId: updated.student.user.id,
      schoolId: payment.schoolId,
      type: 'payment',
      title: 'Payment received',
      body: `Your payment of ₦${paidAmount} was confirmed via ${gateway}.`,
      channels: ['in_app', 'email'],
      email: updated.student.user.email,
    }).catch(() => {})
  }

  await deliverWebhook(prisma, {
    schoolId: payment.schoolId,
    event: 'payment.approved',
    payload: { paymentId: payment.id, amount: paidAmount, gateway },
  }).catch(() => {})

  await onPaymentApproved(prisma, { ...updated, student: updated.student }).catch((err) => {
    console.error('Workflow payment error:', err.message)
  })

  return updated
}

module.exports = { handleSuccessfulFeePayment }
