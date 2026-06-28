import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api'
import { fetchWithAuth } from '../../lib/auth'

export type IdCard = {
  id: string
  cardType: string
  cardNumber: string
  verifyCode: string
  holderName: string
  photoUrl?: string | null
  roleLabel?: string | null
  departmentOrClass?: string | null
  idNumber?: string | null
  bloodType?: string | null
  issuedAt: string
  expiresAt: string
  status: string
  schoolName?: string
}

export function MyIdCardView() {
  const [card, setCard] = useState<IdCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<IdCard | null>('/api/id-cards/my')
      .then(setCard)
      .catch(() => setError('Failed to load ID card'))
      .finally(() => setLoading(false))
  }, [])

  async function downloadPdf() {
    if (!card) return
    const res = await fetchWithAuth(`/api/id-cards/${card.id}/pdf`)
    if (!res.ok) {
      setError('Download failed')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `id-card-${card.cardNumber}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading ID card...</div>
  if (!card) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
        No active digital ID card has been issued for your account yet.
      </div>
    )
  }

  const expired = card.status === 'expired'
  const revoked = card.status === 'revoked'

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-md mx-auto border border-gray-200">
        <div className="bg-[#0b1f4a] text-white px-6 py-4 text-center">
          <p className="text-sm opacity-90">{card.schoolName || 'School'}</p>
          <p className="text-xs uppercase tracking-wider mt-1 opacity-75">
            {card.cardType === 'staff' ? 'Staff ID' : 'Student ID'}
          </p>
        </div>
        <div className="p-6 flex gap-4">
          <div className="w-20 h-20 rounded-lg bg-slate-200 flex items-center justify-center text-2xl font-bold text-[#0b1f4a] shrink-0">
            {card.holderName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900 truncate">{card.holderName}</h2>
            {card.roleLabel && <p className="text-sm text-gray-600">{card.roleLabel}</p>}
            {card.departmentOrClass && <p className="text-sm text-gray-500">{card.departmentOrClass}</p>}
            {card.idNumber && <p className="text-xs font-mono text-gray-500 mt-2">ID: {card.idNumber}</p>}
            {card.bloodType && <p className="text-xs text-gray-500">Blood: {card.bloodType}</p>}
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-between text-xs text-gray-500">
          <span>Issued {new Date(card.issuedAt).toLocaleDateString()}</span>
          <span className={expired ? 'text-red-600 font-medium' : ''}>
            Expires {new Date(card.expiresAt).toLocaleDateString()}
          </span>
        </div>
        <div className="px-6 pb-4">
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
            revoked ? 'bg-red-100 text-red-800' : expired ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
          }`}>
            {card.status}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
        {!revoked && !expired && (
          <button
            onClick={downloadPdf}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Download / Print PDF
          </button>
        )}
        <a
          href={`/verify-id-card?code=${card.verifyCode}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 border border-gray-300 rounded-lg text-center font-medium hover:bg-gray-50"
        >
          Verification link
        </a>
      </div>
      <p className="text-center text-xs text-gray-500 max-w-md mx-auto">
        PDF includes a QR code for gate and security verification.
      </p>
    </div>
  )
}
