import { PASSWORD_RULES, passwordsMatch } from '../../lib/passwordRules'

type Props = {
  password: string
  confirm?: string
}

export default function PasswordRulesList({ password, confirm = '' }: Props) {
  return (
    <ul className="space-y-1 rounded-lg border border-school-border bg-school-surface/50 p-3 text-sm">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password)
        return (
          <li key={rule.id} className={`flex items-center gap-2 ${ok ? 'text-school-green' : 'text-school-muted'}`}>
            <span aria-hidden>{ok ? '✓' : '○'}</span>
            <span>{rule.label}</span>
          </li>
        )
      })}
      {confirm !== undefined && (
        <li className={`flex items-center gap-2 ${passwordsMatch(password, confirm) ? 'text-school-green' : 'text-school-muted'}`}>
          <span aria-hidden>{passwordsMatch(password, confirm) ? '✓' : '○'}</span>
          <span>Passwords match</span>
        </li>
      )}
    </ul>
  )
}
