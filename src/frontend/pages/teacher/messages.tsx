import { useState, useEffect } from 'react'
import { withAuth } from '../../components/withAuth'
import AppLayout from '../../components/layout/AppLayout'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Message = {
  id: string
  subject?: string | null
  body: string
  createdAt: string
  sender: { id: string; firstName: string; lastName: string; email: string }
  receiver: { id: string; firstName: string; lastName: string; email: string }
}

function TeacherMessagesPage({ user }: { user: AuthUser }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [composeData, setComposeData] = useState({ receiverId: '', subject: '', body: '' })

  useEffect(() => {
    loadMessages()
  }, [tab])

  async function loadMessages() {
    try {
      setLoading(true)
      const data = await apiGet<Message[]>(`/api/messages?sent=${tab === 'sent'}`)
      setMessages(data)
    } catch (err) {
      setError('Failed to load messages')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSendMessage() {
    if (!composeData.receiverId || !composeData.body) {
      setError('Receiver and message body are required')
      return
    }

    try {
      await apiPost('/api/messages', {
        receiverId: composeData.receiverId,
        subject: composeData.subject || null,
        body: composeData.body,
      })
      setComposeData({ receiverId: '', subject: '', body: '' })
      setShowCompose(false)
      loadMessages()
      alert('Message sent successfully!')
    } catch (err) {
      setError('Failed to send message')
      console.error(err)
    }
  }

  return (
    <AppLayout user={user} title="Messages">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Messages</h1>
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
          >
            {showCompose ? 'Cancel' : 'Compose Message'}
          </button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {/* Compose Form */}
        {showCompose && (
          <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Recipient</label>
              <input
                type="email"
                value={composeData.receiverId}
                onChange={(e) => setComposeData({ ...composeData, receiverId: e.target.value })}
                placeholder="Recipient email or user ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Subject (Optional)</label>
              <input
                type="text"
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                placeholder="Message subject"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Message</label>
              <textarea
                value={composeData.body}
                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                placeholder="Type your message"
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <button
              onClick={handleSendMessage}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              Send Message
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b">
          <button
            onClick={() => setTab('inbox')}
            className={`px-4 py-2 font-medium ${
              tab === 'inbox'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Inbox ({messages.filter((m) => m.sender.id !== user.id).length})
          </button>
          <button
            onClick={() => setTab('sent')}
            className={`px-4 py-2 font-medium ${
              tab === 'sent'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sent ({messages.filter((m) => m.sender.id === user.id).length})
          </button>
        </div>

        {/* Messages List */}
        {loading ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-600">
            No messages in {tab === 'inbox' ? 'your inbox' : 'sent messages'}.
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setSelectedMessage(selectedMessage?.id === message.id ? null : message)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {tab === 'inbox' ? `${message.sender.firstName} ${message.sender.lastName}` : `To: ${message.receiver.firstName} ${message.receiver.lastName}`}
                    </p>
                    <p className="text-sm text-gray-600">{message.sender.email}</p>
                    <p className="text-sm font-medium mt-1">{message.subject || 'No subject'}</p>
                  </div>
                  <div className="text-xs text-gray-400">{new Date(message.createdAt).toLocaleDateString()}</div>
                </div>

                {selectedMessage?.id === message.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-gray-700 whitespace-pre-wrap">{message.body}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(TeacherMessagesPage, { roles: ['Teacher'] })
