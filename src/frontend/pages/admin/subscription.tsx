import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function SubscriptionRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/billing')
  }, [router])
  return <p className="p-8 text-center text-slate-500">Redirecting to billing…</p>
}
