const crypto = require('crypto')
const dns = require('dns').promises
const { DOMAIN_VERIFY_PREFIX } = require('./platformBrand')

function normalizeDomain(domain) {
  return String(domain || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim()
}

function verificationHost(domain) {
  return `_schoolpilot-verify.${normalizeDomain(domain)}`
}

function generateVerificationToken() {
  return `${DOMAIN_VERIFY_PREFIX}-${crypto.randomBytes(16).toString('hex')}`
}

async function verifyDnsTxt(domain, expectedToken) {
  const host = verificationHost(domain)
  try {
    const records = await dns.resolveTxt(host)
    const flat = records.map((r) => r.join('')).join('')
    return flat.includes(expectedToken)
  } catch {
    return false
  }
}

async function startDomainVerification(prisma, schoolId, domain) {
  const normalized = normalizeDomain(domain)
  if (!normalized) throw new Error('Invalid domain')

  const existing = await prisma.customDomainRecord.findUnique({ where: { domain: normalized } })
  if (existing && existing.schoolId !== schoolId) {
    throw new Error('Domain already registered to another school')
  }

  const token = generateVerificationToken()
  const record = await prisma.customDomainRecord.upsert({
    where: { domain: normalized },
    update: {
      schoolId,
      verificationToken: token,
      status: 'pending',
      dnsVerifiedAt: null,
    },
    create: {
      schoolId,
      domain: normalized,
      verificationToken: token,
      status: 'pending',
    },
  })

  return {
    record,
    instructions: {
      type: 'TXT',
      host: verificationHost(normalized),
      value: token,
      note: 'Add this TXT record, then click Verify DNS. SSL provisioning may take up to 24 hours.',
    },
  }
}

async function confirmDomainVerification(prisma, schoolId, recordId) {
  const record = await prisma.customDomainRecord.findFirst({
    where: { id: recordId, schoolId },
  })
  if (!record) throw new Error('Domain record not found')

  const ok = await verifyDnsTxt(record.domain, record.verificationToken)
  if (!ok) {
    await prisma.customDomainRecord.update({
      where: { id: record.id },
      data: { status: 'failed' },
    })
    throw new Error('DNS TXT record not found — check your DNS settings and try again')
  }

  const updated = await prisma.customDomainRecord.update({
    where: { id: record.id },
    data: {
      status: 'verified',
      dnsVerifiedAt: new Date(),
      sslStatus: 'pending',
    },
  })

  await prisma.school.update({
    where: { id: schoolId },
    data: { customDomain: record.domain },
  })

  return updated
}

module.exports = {
  normalizeDomain,
  verificationHost,
  generateVerificationToken,
  verifyDnsTxt,
  startDomainVerification,
  confirmDomainVerification,
}
