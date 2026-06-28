import { apiGet, apiPost, apiDelete } from './api'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
  return output
}

export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    return reg
  } catch (err) {
    console.warn('Service worker registration failed', err)
    return null
  }
}

export async function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getVapidPublicKey() {
  const data = await apiGet<{ publicKey: string | null; pushEnabled: boolean }>(
    '/api/notifications/vapid-public-key'
  )
  return data
}

export async function subscribeToPush() {
  if (!(await isPushSupported())) {
    throw new Error('Push notifications are not supported in this browser')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  const { publicKey, pushEnabled } = await getVapidPublicKey()
  if (!pushEnabled || !publicKey) {
    throw new Error('Push notifications are not configured on the server')
  }

  const registration = (await navigator.serviceWorker.ready) || (await registerServiceWorker())
  if (!registration) throw new Error('Service worker not available')

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const json = subscription.toJSON()
  await apiPost('/api/notifications/push/subscribe', {
    endpoint: json.endpoint,
    keys: json.keys,
  })

  return subscription
}

export async function unsubscribeFromPush() {
  if (!(await isPushSupported())) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await subscription.unsubscribe()
  }
  await apiDelete('/api/notifications/push/subscribe')
}

export function getApiBaseForSw() {
  return API_BASE
}
