export type PasswordRule = { id: string; label: string; test: (p: string) => boolean }

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'One number', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'One special character (!@#$%^&*)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function passwordMeetsRules(password: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(password))
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return confirm.length > 0 && password === confirm
}
