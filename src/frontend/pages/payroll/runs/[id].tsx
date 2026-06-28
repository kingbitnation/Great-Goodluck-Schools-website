import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AppLayout from '../../../components/layout/AppLayout'
import { withAuth } from '../../../components/withAuth'
import { apiGet } from '../../../lib/api'
import { fetchWithAuth } from '../../../lib/auth'
import type { AuthUser } from '../../../lib/useAuth'

type Payslip = {
  id: string
  employeeNo: string
  employeeName: string
  grossPay: number
  totalDeductions: number
  netPay: number
  status: string
}

type PayrollRunDetail = {
  id: string
  periodLabel: string
  status: string
  totalGross: number
  totalDeductions: number
  totalNet: number
  payslips: Payslip[]
}

function PayrollRunDetailPage({ user }: { user: AuthUser }) {
  const router = useRouter()
  const { id } = router.query
  const [run, setRun] = useState<PayrollRunDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id || typeof id !== 'string') return
    apiGet<PayrollRunDetail>(`/api/payroll/runs/${id}`).then(setRun).catch((err) => setError((err as Error).message))
  }, [id])

  const downloadPdf = async (payslipId: string) => {
    if (!id || typeof id !== 'string') return
    const res = await fetchWithAuth(`/api/payroll/runs/${id}/payslips/${payslipId}/pdf`)
    if (!res.ok) {
      setError('Failed to download payslip PDF')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payslip-${payslipId}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppLayout user={user} title="Payroll Run">
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <h1 className="text-3xl font-bold">{run?.periodLabel || 'Payroll Run'}</h1>
        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        {!run ? (
          <div className="content-card p-6">Loading run...</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="content-card p-4"><p className="text-xs text-slate-500">Status</p><p className="font-semibold">{run.status}</p></div>
              <div className="content-card p-4"><p className="text-xs text-slate-500">Gross</p><p className="font-semibold">NGN {run.totalGross.toLocaleString()}</p></div>
              <div className="content-card p-4"><p className="text-xs text-slate-500">Deductions</p><p className="font-semibold">NGN {run.totalDeductions.toLocaleString()}</p></div>
              <div className="content-card p-4"><p className="text-xs text-slate-500">Net</p><p className="font-semibold">NGN {run.totalNet.toLocaleString()}</p></div>
            </div>

            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Gross</th>
                    <th className="px-4 py-3">Deductions</th>
                    <th className="px-4 py-3">Net</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {run.payslips.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3">{p.employeeName} ({p.employeeNo})</td>
                      <td className="px-4 py-3">NGN {p.grossPay.toLocaleString()}</td>
                      <td className="px-4 py-3">NGN {p.totalDeductions.toLocaleString()}</td>
                      <td className="px-4 py-3">NGN {p.netPay.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => downloadPdf(p.id)} className="rounded border px-2 py-1 text-xs">
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(PayrollRunDetailPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'HRManager', 'Accountant'] })
