const {
  processExpiredTrials,
  processExpiredSubscriptions,
  processRenewalReminders,
  processAutoRenewals,
} = require('./subscriptionHelpers')

function startSubscriptionJobs(prisma, { dispatchNotification } = {}) {
  const notify = dispatchNotification
    ? (payload) => dispatchNotification(prisma, payload)
    : null

  const run = async () => {
    try {
      const expired = await processExpiredTrials(prisma, { notify })
      const subsExpired = await processExpiredSubscriptions(prisma, { notify })
      const reminders = await processRenewalReminders(prisma, { notify })
      const renewals = await processAutoRenewals(prisma)
      if (expired || subsExpired || reminders || renewals) {
        console.log(`[billing-jobs] trials=${expired} subs=${subsExpired} reminders=${reminders} renewals=${renewals}`)
      }
    } catch (err) {
      console.error('[billing-jobs] error:', err.message)
    }
  }

  run()
  const interval = setInterval(run, 60 * 60 * 1000)
  return () => clearInterval(interval)
}

module.exports = { startSubscriptionJobs }
