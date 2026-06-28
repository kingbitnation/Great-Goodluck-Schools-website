import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiGet, apiPut } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

export type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  readAt?: string | null
  createdAt: string
  sentAt: string
  payload?: Record<string, unknown>
}

const TYPE_COLORS: Record<string, string> = {
  assignment: 'bg-blue-100 text-blue-800',
  grade: 'bg-green-100 text-green-800',
  results: 'bg-green-100 text-green-800',
  attendance: 'bg-purple-100 text-purple-800',
  fee: 'bg-amber-100 text-amber-800',
  payment: 'bg-emerald-100 text-emerald-800',
  admission: 'bg-indigo-100 text-indigo-800',
  announcement: 'bg-orange-100 text-orange-800',
  message: 'bg-pink-100 text-pink-800',
  marketplace: 'bg-cyan-100 text-cyan-800',
  library: 'bg-rose-100 text-rose-800',
  leave: 'bg-violet-100 text-violet-800',
  payroll: 'bg-slate-100 text-slate-800',
}

export default function NotificationsPanel({
  user,
  settingsHref = '/settings/notifications',
}: {
  user: AuthUser
  settingsHref?: string
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all')

  useEffect(() => {
    loadNotifications()
  }, [])

  async function loadNotifications() {
    try {
      setLoading(true)
      const data = await apiGet<NotificationItem[]>('/api/notifications')
      setNotifications(data)
    } catch {
      setError('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkAsRead(notificationId: string) {
    try {
      await apiPut(`/api/notifications/${notificationId}/read`, {})
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n
        )
      )
    } catch (err) {
      console.error(err)
    }
  }

  async function handleMarkAllRead() {
    try {
      await apiPut('/api/notifications/read-all', {})
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: n.readAt || new Date().toISOString() }))
      )
    } catch (err) {
      console.error(err)
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (filterRead === 'unread') return !n.read
    if (filterRead === 'read') return n.read
    return true
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Notifications</h1>
          <p className="text-sm text-gray-600 mt-1">
            In-app alerts from {user.schoolName || 'your school'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Mark all read
            </button>
          )}
          <Link
            href={settingsHref}
            className="px-3 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600"
          >
            Notification settings
          </Link>
        </div>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

      <div className="mb-6 flex gap-2 border-b overflow-x-auto">
        {(['all', 'unread', 'read'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilterRead(status)}
            className={`px-4 py-2 font-medium capitalize whitespace-nowrap ${
              filterRead === status
                ? 'border-b-2 border-amber-500 text-amber-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {status} {status === 'unread' && unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white p-8 rounded-lg text-center text-gray-500 shadow-sm">Loading notifications...</div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white p-8 rounded-lg text-center text-gray-600 shadow-sm">
          {filterRead === 'unread'
            ? 'No unread notifications'
            : filterRead === 'read'
              ? 'No read notifications'
              : 'No notifications yet'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`rounded-lg border p-4 transition shadow-sm ${
                notif.read ? 'border-gray-200 bg-white' : 'border-amber-200 bg-amber-50/50'
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold capitalize ${
                        TYPE_COLORS[notif.type] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {notif.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(notif.sentAt).toLocaleDateString()}{' '}
                      {new Date(notif.sentAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h3 className={`font-semibold ${notif.read ? 'text-gray-700' : 'text-gray-900'}`}>
                    {notif.title}
                  </h3>
                  <p className={`text-sm mt-1 ${notif.read ? 'text-gray-600' : 'text-gray-700'}`}>
                    {notif.body}
                  </p>
                </div>
                {!notif.read && (
                  <button
                    type="button"
                    onClick={() => handleMarkAsRead(notif.id)}
                    className="shrink-0 px-3 py-1 text-sm text-amber-700 hover:bg-white rounded transition"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
