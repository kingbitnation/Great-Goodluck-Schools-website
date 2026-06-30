const ROLE_PROFILE_MODELS = {
  Accountant: 'accountant',
  Librarian: 'librarian',
  HostelManager: 'hostelManager',
  TransportManager: 'transportManager',
  BiometricManager: 'biometricManager',
}

function staffNoForRole(roleName, customNo) {
  if (customNo) return customNo
  const prefix = {
    Accountant: 'ACC',
    Librarian: 'LIB',
    HostelManager: 'HST',
    TransportManager: 'TRN',
    BiometricManager: 'BIO',
  }[roleName] || 'STF'
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}

async function ensureRoleProfile(prisma, userId, roleName, staffNo) {
  const model = ROLE_PROFILE_MODELS[roleName]
  if (!model) return null

  const existing = await prisma[model].findUnique({ where: { userId } })
  if (existing) return existing

  return prisma[model].create({
    data: {
      userId,
      staffNo: staffNoForRole(roleName, staffNo),
    },
  })
}

async function getRoleProfile(prisma, userId, roleName) {
  const model = ROLE_PROFILE_MODELS[roleName]
  if (!model) return null
  return prisma[model].findUnique({ where: { userId } })
}

module.exports = {
  ROLE_PROFILE_MODELS,
  ensureRoleProfile,
  getRoleProfile,
  staffNoForRole,
}
