async function deleteSchoolCompletely(prisma, schoolId) {
  await prisma.exam.deleteMany({
    where: { OR: [{ schoolId }, { teacher: { schoolId } }] },
  })

  const userIds = (
    await prisma.user.findMany({ where: { schoolId }, select: { id: true } })
  ).map((u) => u.id)

  if (userIds.length) {
    await prisma.attendance.deleteMany({
      where: {
        OR: [
          { student: { schoolId } },
          { markedById: { in: userIds } },
        ],
      },
    })
    await prisma.paymentVerificationLog.deleteMany({
      where: { performedById: { in: userIds } },
    })
    await prisma.message.deleteMany({
      where: {
        OR: [{ senderId: { in: userIds } }, { receiverId: { in: userIds } }],
      },
    })
    await prisma.user.deleteMany({ where: { schoolId } })
  }

  await prisma.school.delete({ where: { id: schoolId } })
}

async function resetPlatformData(prisma) {
  const schools = await prisma.school.findMany({ select: { id: true } })
  for (const { id } of schools) {
    await deleteSchoolCompletely(prisma, id)
  }

  await prisma.schoolRegistration.deleteMany({})
  await prisma.subscriptionReceipt.deleteMany({})
  await prisma.subscriptionPayment.deleteMany({})
  await prisma.subscriptionInvoice.deleteMany({})
  await prisma.subscriptionTransactionLog.deleteMany({})
  await prisma.schoolUsageDaily.deleteMany({})
  await prisma.referralConversion.deleteMany({})
}

module.exports = { deleteSchoolCompletely, resetPlatformData }
