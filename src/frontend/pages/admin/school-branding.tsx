import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPut, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Branding = {
  schoolId: string
  name: string
  logo: string | null
  primaryColor: string | null
  secondaryColor: string | null
  customDomain: string | null
  bankName: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
}

type DomainRecord = {
  id: string
  domain: string
  status: string
  verificationToken: string
  dnsVerifiedAt?: string | null
}

function SchoolBrandingPage({ user }: { user: AuthUser }) {
  const schoolId = user.schoolId || ''
  const [form, setForm] = useState<Partial<Branding>>({})
  const [domains, setDomains] = useState<DomainRecord[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [dnsInstructions, setDnsInstructions] = useState<{ host: string; value: string } | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function loadDomains() {
    if (!schoolId) return
    apiGet<DomainRecord[]>(`/api/schools/${schoolId}/domains`).then(setDomains).catch(() => {})
  }

  useEffect(() => {
    if (!schoolId) return
    apiGet<Branding>(`/api/schools/${schoolId}/branding`).then(setForm)
    loadDomains()
  }, [schoolId])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!schoolId) return
    setError('')
    try {
      await apiPut(`/api/schools/${schoolId}/branding`, form)
      setMessage('Branding saved')
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function addDomain() {
    if (!schoolId || !newDomain.trim()) return
    setError('')
    try {
      const res = await apiPost<{ instructions: { host: string; value: string } }>(`/api/schools/${schoolId}/domains`, { domain: newDomain })
      setDnsInstructions(res.instructions)
      setNewDomain('')
      loadDomains()
      setMessage('Add the DNS TXT record below, then click Verify.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function verifyDomain(recordId: string) {
    if (!schoolId) return
    try {
      await apiPost(`/api/schools/${schoolId}/domains/${recordId}/verify`, {})
      setMessage('Domain verified successfully')
      loadDomains()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    }
  }

  if (!schoolId) {
    return <AppLayout user={user} title="Branding"><div className="p-8">Super admins manage schools from the Schools page.</div></AppLayout>
  }

  return (
    <AppLayout user={user} title="School branding">
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold text-school-navy">Branding & profile</h1>
        <p className="text-sm text-slate-500">Used on receipts, emails, and your public portal.</p>
        {message && <p className="mt-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{message}</p>}
        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={save} className="mt-6 space-y-4 content-card p-6">
          <input placeholder="School name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full" />
          <input placeholder="Logo URL" value={form.logo || ''} onChange={(e) => setForm({ ...form, logo: e.target.value })} className="w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">Primary color<input type="color" value={form.primaryColor || '#f59e0b'} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="mt-1 h-10 w-full" /></label>
            <label className="text-sm">Secondary color<input type="color" value={form.secondaryColor || '#0F172A'} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} className="mt-1 h-10 w-full" /></label>
          </div>
          <input placeholder="Custom domain (legacy — use DNS verification below)" value={form.customDomain || ''} onChange={(e) => setForm({ ...form, customDomain: e.target.value })} className="w-full" />
          <hr />
          <h3 className="font-semibold">Custom domain (verified)</h3>
          <p className="text-xs text-slate-500">Professional+ plans. Point a TXT record to verify ownership. After verification, point the domain to your load balancer and issue TLS certificates manually (Let&apos;s Encrypt, Cloudflare, or your host panel) — automated SSL provisioning is not built in.</p>
          <div className="flex gap-2">
            <input placeholder="portal.yourschool.edu.ng" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} className="flex-1" />
            <button type="button" onClick={addDomain} className="rounded border px-3 py-2 text-sm">Add</button>
          </div>
          {dnsInstructions && (
            <div className="rounded bg-slate-50 p-3 text-xs font-mono">
              <p>TXT host: {dnsInstructions.host}</p>
              <p className="mt-1 break-all">Value: {dnsInstructions.value}</p>
            </div>
          )}
          <ul className="space-y-2 text-sm">
            {domains.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded border p-2">
                <span>{d.domain} <span className="capitalize text-slate-500">({d.status})</span></span>
                {d.status === 'pending' && (
                  <button type="button" onClick={() => verifyDomain(d.id)} className="link-admin text-xs">Verify DNS</button>
                )}
              </li>
            ))}
          </ul>
          <hr />
          <h3 className="font-semibold text-school-navy">School bank account</h3>
          <p className="text-sm text-slate-600">Used for fee payments, shop orders, and alumni donations. Each school sets its own account — parents pay this account, not SchoolPilot.</p>
          <input placeholder="Bank name" value={form.bankName || ''} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="w-full" />
          <input placeholder="Account name" value={form.bankAccountName || ''} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} className="w-full" />
          <input placeholder="Account number" value={form.bankAccountNumber || ''} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} className="w-full" />
          <button type="submit" className="btn-gold">Save branding</button>
        </form>
      </div>
    </AppLayout>
  )
}

export default withAuth(SchoolBrandingPage, { roles: ['SchoolAdmin', 'SuperAdmin'] })
