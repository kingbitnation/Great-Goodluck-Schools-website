import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { withAuth } from '../../components/withAuth'
import { apiGet, apiPost } from '../../lib/api'
import type { AuthUser } from '../../lib/useAuth'

type Bank = { id: string; name: string; description?: string; subjectName?: string; itemCount: number }

function AdminCbtQuestionBanksPage({ user }: { user: AuthUser }) {
  const [banks, setBanks] = useState<Bank[]>([])
  const [form, setForm] = useState({ name: '', description: '' })
  const [itemForm, setItemForm] = useState({
    bankId: '',
    questionText: '',
    questionType: 'multiple_choice',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correctAnswer: '',
    marks: 1,
  })
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const data = await apiGet<Bank[]>('/api/cbt/question-banks')
    setBanks(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createBank(e: React.FormEvent) {
    e.preventDefault()
    await apiPost('/api/cbt/question-banks', form)
    setForm({ name: '', description: '' })
    load()
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!itemForm.bankId) return
    const options =
      itemForm.questionType === 'true_false'
        ? ['True', 'False']
        : [itemForm.option1, itemForm.option2, itemForm.option3, itemForm.option4].filter(Boolean)
    await apiPost(`/api/cbt/question-banks/${itemForm.bankId}/items`, {
      questionText: itemForm.questionText,
      questionType: itemForm.questionType,
      options,
      correctAnswer: itemForm.correctAnswer,
      marks: itemForm.marks,
    })
    setItemForm({ ...itemForm, questionText: '', option1: '', option2: '', option3: '', option4: '', correctAnswer: '' })
    load()
  }

  return (
    <AppLayout user={user} title="Question Banks">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/admin/cbt-exams" className="text-sm text-slate-500 hover:text-school-navy">← CBT Exams</Link>

        <form onSubmit={createBank} className="content-card space-y-3 p-6">
          <h2 className="font-semibold text-school-navy">New question bank</h2>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bank name" className="w-full" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full" />
          <button type="submit" className="btn-gold text-sm">Create bank</button>
        </form>

        <form onSubmit={addItem} className="content-card space-y-3 p-6">
          <h2 className="font-semibold text-school-navy">Add question to bank</h2>
          <select required value={itemForm.bankId} onChange={(e) => setItemForm({ ...itemForm, bankId: e.target.value })} className="w-full">
            <option value="">Select bank</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <textarea required value={itemForm.questionText} onChange={(e) => setItemForm({ ...itemForm, questionText: e.target.value })} placeholder="Question" rows={2} className="w-full" />
          <select value={itemForm.questionType} onChange={(e) => setItemForm({ ...itemForm, questionType: e.target.value })} className="w-full">
            <option value="multiple_choice">Multiple choice</option>
            <option value="true_false">True / False</option>
            <option value="short_answer">Short answer</option>
          </select>
          {itemForm.questionType === 'multiple_choice' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {(['option1', 'option2', 'option3', 'option4'] as const).map((k, i) => (
                <input key={k} value={itemForm[k]} onChange={(e) => setItemForm({ ...itemForm, [k]: e.target.value })} placeholder={`Option ${i + 1}`} className="w-full" />
              ))}
            </div>
          )}
          <input required value={itemForm.correctAnswer} onChange={(e) => setItemForm({ ...itemForm, correctAnswer: e.target.value })} placeholder="Correct answer" className="w-full" />
          <button type="submit" className="rounded-lg bg-school-navy px-4 py-2 text-sm text-white">Add question</button>
        </form>

        {loading ? <p className="text-slate-500">Loading...</p> : (
          <div className="space-y-3">
            {banks.map((b) => (
              <div key={b.id} className="content-card flex justify-between p-5">
                <div>
                  <p className="font-semibold text-school-navy">{b.name}</p>
                  <p className="text-sm text-slate-500">{b.itemCount} questions · {b.subjectName || 'General'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default withAuth(AdminCbtQuestionBanksPage, { roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher'] })
