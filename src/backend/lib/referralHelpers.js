const { priceForInterval } = require('./planLimits')
const {
  billingPeriodEnd,
  activateSubscription,
  applyCoupon,
} = require('./subscriptionHelpers')

async function findReferralCode(prisma, code) {
  if (!code) return null
  return prisma.referralCode.findFirst({
    where: { code: String(code).toUpperCase(), isActive: true },
  })
}

async function recordReferralConversion(prisma, referralCode, referredSchoolId) {
  const existing = await prisma.referralConversion.findUnique({
    where: { referredSchoolId },
  })
  if (existing) return existing

  return prisma.referralConversion.create({
    data: {
      referralCodeId: referralCode.id,
      referredSchoolId,
      status: 'pending',
    },
  })
}

async function processReferralReward(prisma, referredSchoolId) {
  const conversion = await prisma.referralConversion.findUnique({
    where: { referredSchoolId },
    include: { referralCode: true },
  })
  if (!conversion || conversion.status === 'rewarded') return null

  const ref = conversion.referralCode
  const referrerSchoolId = ref.schoolId

  const rewardDays = ref.rewardDays || 14
  const sub = await prisma.schoolSubscription.findUnique({ where: { schoolId: referrerSchoolId } })
  if (sub) {
    const base = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()
      ? sub.currentPeriodEnd
      : new Date()
    const extended = new Date(base.getTime() + rewardDays * 24 * 60 * 60 * 1000)
    await prisma.schoolSubscription.update({
      where: { schoolId: referrerSchoolId },
      data: { currentPeriodEnd: extended, status: 'active' },
    })
  }

  const aiBalance = await prisma.aiCreditBalance.findUnique({ where: { schoolId: referrerSchoolId } })
  if (aiBalance && ref.rewardAiCredits) {
    await prisma.aiCreditBalance.update({
      where: { schoolId: referrerSchoolId },
      data: { balance: { increment: ref.rewardAiCredits } },
    })
    await prisma.aiCreditTransaction.create({
      data: {
        schoolId: referrerSchoolId,
        amount: ref.rewardAiCredits,
        type: 'grant',
        note: `Referral reward for school ${referredSchoolId}`,
      },
    })
  }

  await prisma.referralConversion.update({
    where: { id: conversion.id },
    data: { status: 'rewarded', rewardedAt: new Date() },
  })

  return { referrerSchoolId, rewardDays, rewardAiCredits: ref.rewardAiCredits }
}

module.exports = {
  findReferralCode,
  recordReferralConversion,
  processReferralReward,
  applyCoupon,
  billingPeriodEnd,
  activateSubscription,
  priceForInterval,
}
