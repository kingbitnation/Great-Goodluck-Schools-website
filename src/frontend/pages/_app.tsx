import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { ThemeProvider } from '../components/ThemeProvider'
import { registerServiceWorker } from '../lib/pushNotifications'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  )
}
