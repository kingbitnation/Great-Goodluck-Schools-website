import { useState } from 'react'
import { useRouter } from 'next/router'
import { saveToken } from '../lib/auth'
import { ROLE_HOME } from '../lib/navigation'

export default function Login() {
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || body?.message || 'Login failed')
      }
      const data = await res.json()
      if (data?.accessToken) {
        saveToken(data.accessToken)
        const role = data.user?.role || 'SuperAdmin'
        router.push(ROLE_HOME[role] || '/dashboard')
      } else {
        throw new Error('No token returned')
      }
    } catch (err: any) {
      setError(err.message || 'Login error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-6 bg-white rounded-lg shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h2>
        <p className="text-sm text-gray-500 mb-6">School Management System</p>
        <label className="block mb-4 text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block mb-4 text-sm font-medium text-gray-700">
          Password
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <p className="mt-4 text-xs text-gray-400 text-center">
          Demo: admin@example.com / admin123 or sadmin@demoschool.edu / admin123
        </p>
      </form>
    </div>
  )
}
