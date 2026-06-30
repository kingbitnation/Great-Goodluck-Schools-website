export type PlatformBankDetails = {
  bankName: string
  accountName: string
  accountNumber: string
}

export function platformBankFromEnv(): PlatformBankDetails {
  return {
    bankName: process.env.NEXT_PUBLIC_PLATFORM_BANK_NAME || 'OPay',
    accountName: process.env.NEXT_PUBLIC_PLATFORM_BANK_ACCOUNT_NAME || 'Orìre Supo Dapo',
    accountNumber: process.env.NEXT_PUBLIC_PLATFORM_BANK_ACCOUNT_NUMBER || '7040155877',
  }
}

export function generateRegistrationReference() {
  const stamp = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase()
  return `REG-${stamp}-${rand}`
}
