import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function AccountantFeesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/accountant/finance')
  }, [router])
  return null
}
