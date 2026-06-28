import { useEffect, useState } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet } from '../../lib/api'
import { fetchWithAuth } from '../../lib/auth'
import type { AuthUser } from '../../lib/useAuth'

type Certificate = {
  id: string
  certificateType: string
  title: string
  recipientName: string
  certificateNumber: string
  verifyCode: string
  issuedAt: string
  sessionLabel?: string | null
  className?: string | null
  description?: string | null
}

function StudentCertificatesPage({ user }: { user: AuthUser }) {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadCertificates()
  }, [])

  async function loadCertificates() {
    try {
      setLoading(true)
      setCertificates(await apiGet<Certificate[]>('/api/certificates/my'))
      setError('')
    } catch {
      setError('Failed to load certificates')
    } finally {
      setLoading(false)
    }
  }

  async function downloadPdf(id: string, number: string) {
    const res = await fetchWithAuth(`/api/certificates/${id}/pdf`)
    if (!res.ok) {
      setError('Download failed')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `certificate-${number}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const typeLabel = (t: string) =>
    t === 'graduation' ? 'Graduation' : t === 'attendance' ? 'Attendance' : t === 'excellence' ? 'Excellence' : t

  return (
    <AppLayout user={user} title="My Certificates">
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">My Certificates</h1>
        <p className="text-gray-600 mb-6">Download official school certificates. Each PDF includes a QR code for verification.</p>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading...</div>
        ) : certificates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
            No school certificates have been issued to you yet.
          </div>
        ) : (
          <div className="space-y-4">
            {certificates.map((cert) => (
              <div key={cert.id} className="bg-white rounded-lg shadow p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold">{typeLabel(cert.certificateType)}</p>
                  <h2 className="text-xl font-bold text-gray-900 mt-1">{cert.title}</h2>
                  {cert.description && <p className="text-sm text-gray-600 mt-2">{cert.description}</p>}
                  <p className="text-sm text-gray-500 mt-2">
                    {cert.className && <span>{cert.className} · </span>}
                    {cert.sessionLabel && <span>{cert.sessionLabel} · </span>}
                    Issued {new Date(cert.issuedAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs font-mono text-gray-400 mt-1">#{cert.certificateNumber}</p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => downloadPdf(cert.id, cert.certificateNumber)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Download PDF
                  </button>
                  <a
                    href={`/verify-certificate?code=${cert.verifyCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-center hover:bg-gray-50"
                  >
                    Verify online
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(StudentCertificatesPage, { roles: ['Student'] })
