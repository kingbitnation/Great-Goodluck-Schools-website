import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet } from '../../lib/api'
import { fetchWithAuth } from '../../lib/auth'
import type { AuthUser } from '../../lib/useAuth'

type ClassRow = { id: string; name: string }

type BroadsheetSubject = { id: string; name: string; code: string }

type BroadsheetRow = {
  rank: number
  studentId: string
  admissionNo: string
  name: string
  scores: Record<string, { score: number; grade: string; gpa: number } | null>
  average: number
  grade: string
  gpa: number
}

type BroadsheetResponse = {
  class: { id: string; name: string }
  school?: string
  subjects: BroadsheetSubject[]
  rows: BroadsheetRow[]
}

function AdminBroadsheetsPage({ user }: { user: AuthUser }) {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [classId, setClassId] = useState('')
  const [publishedOnly, setPublishedOnly] = useState(true)
  const [data, setData] = useState<BroadsheetResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<ClassRow[]>('/api/classes')
      .then((rows) => {
        setClasses(rows)
        if (rows.length) setClassId(rows[0].id)
      })
      .catch(() => setError('Failed to load classes'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!classId) return
    setLoading(true)
    setError('')
    apiGet<BroadsheetResponse>(`/api/broadsheets/${classId}?publishedOnly=${publishedOnly}`)
      .then(setData)
      .catch(() => setError('Failed to load broadsheet'))
      .finally(() => setLoading(false))
  }, [classId, publishedOnly])

  async function downloadPdf() {
    if (!classId) return
    try {
      const res = await fetchWithAuth(`/api/broadsheets/${classId}/pdf?termLabel=${encodeURIComponent(data?.class.name || '')}`)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `broadsheet-${data?.class.name || classId}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Failed to download PDF')
    }
  }

  return (
    <AppLayout user={user} title="Class Broadsheets">
      <div className="mx-auto max-w-7xl space-y-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/admin/results" className="text-sm text-slate-500 hover:text-school-navy">
              ← Results
            </Link>
            <h1 className="mt-2 text-3xl font-bold">Class Broadsheets</h1>
            <p className="mt-1 text-sm text-slate-600">
              Ranked class performance across subjects — export as PDF for records.
            </p>
          </div>
          {classId && (
            <button
              type="button"
              onClick={downloadPdf}
              className="rounded bg-school-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Download PDF
            </button>
          )}
        </div>

        {error && <div className="rounded bg-red-50 p-4 text-red-700">{error}</div>}

        <div className="flex flex-wrap items-end gap-4 rounded-lg bg-white p-4 shadow">
          <div>
            <label className="mb-1 block text-sm font-medium">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="min-w-[200px] rounded border p-2"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publishedOnly}
              onChange={(e) => setPublishedOnly(e.target.checked)}
            />
            Published results only
          </label>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading broadsheet...</p>
        ) : !data || data.rows.length === 0 ? (
          <p className="text-slate-600">No results for this class yet.</p>
        ) : (
          <div className="content-card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-3 text-left">Rank</th>
                  <th className="px-3 py-3 text-left">Student</th>
                  <th className="px-3 py-3 text-left">Adm. No</th>
                  {data.subjects.map((s) => (
                    <th key={s.id} className="px-3 py-3 text-center" title={s.name}>
                      {s.code}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center">Avg</th>
                  <th className="px-3 py-3 text-center">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((row) => (
                  <tr key={row.studentId}>
                    <td className="px-3 py-3 font-bold">{row.rank}</td>
                    <td className="px-3 py-3">{row.name}</td>
                    <td className="px-3 py-3 text-slate-600">{row.admissionNo}</td>
                    {data.subjects.map((s) => {
                      const cell = row.scores[s.id]
                      return (
                        <td key={s.id} className="px-3 py-3 text-center">
                          {cell ? (
                            <span title={`Grade ${cell.grade}`}>{cell.score}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-3 text-center font-medium">{row.average}</td>
                    <td className="px-3 py-3 text-center">{row.grade}</td>
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

export default withAuth(AdminBroadsheetsPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
