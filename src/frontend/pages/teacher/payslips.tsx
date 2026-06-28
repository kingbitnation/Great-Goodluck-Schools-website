import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import { fetchWithAuth } from '../../lib/auth'
import type { AuthUser } from '../../lib/useAuth'

type MyPayslip = {
  id: string
  payrollRunId: string
  periodLabel: string
  grossPay: number
  netPay: number
  totalDeductions: number
  status: string
}

function TeacherPayslipsPage({ user }: { user: AuthUser }) {
  const [rows, setRows] = useState<MyPayslip[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<MyPayslip[]>('/api/payroll/my-payslips').then(setRows).catch((err) => setError((err as Error).message))
  }, [])

  const downloadPdf = async (id: string) => {
    const res = await fetchWithAuth(`/api/payroll/my-payslips/${id}/pdf`)
    if (!res.ok) {
      setError('Could not download payslip PDF')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `my-payslip-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppLayout user={user} title="My Payslips">
      <div className="mx-auto max-w-5xl space-y-6 p-8">
        <h1 className="text-3xl font-bold">My Payslips</h1>
        <p className="text-slate-600">Download approved payroll slips for your records.</p>
        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        {rows.length === 0 ? (
          <div className="content-card p-6 text-slate-600">No payslips available yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">Net</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">{r.periodLabel}</td>
                    <td className="px-4 py-3">NGN {r.grossPay.toLocaleString()}</td>
                    <td className="px-4 py-3">NGN {r.totalDeductions.toLocaleString()}</td>
                    <td className="px-4 py-3">NGN {r.netPay.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => downloadPdf(r.id)} className="rounded border px-2 py-1 text-xs">
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(TeacherPayslipsPage, { roles: ['Teacher', 'HRManager', 'SchoolAdmin', 'Accountant', 'Librarian', 'HostelManager', 'TransportManager'] })
