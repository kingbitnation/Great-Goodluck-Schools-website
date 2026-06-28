function platformBankDetails({ amount, reference }) {
  return {
    bankName: process.env.PLATFORM_BANK_NAME || 'Zenith Bank',
    accountName: process.env.PLATFORM_BANK_ACCOUNT_NAME || 'SchoolPilot Ltd',
    accountNumber: process.env.PLATFORM_BANK_ACCOUNT_NUMBER || '',
    amount,
    reference,
  }
}

/** Bank details for a school's own collections (fees, shop, donations). No platform fallback. */
function schoolBankDetails(school, { amount, reference }) {
  if (!school?.bankAccountNumber?.trim()) return null
  return {
    bankName: school.bankName?.trim() || 'Bank',
    accountName: school.bankAccountName?.trim() || school.name,
    accountNumber: school.bankAccountNumber.trim(),
    amount,
    reference,
  }
}

module.exports = { platformBankDetails, schoolBankDetails }
