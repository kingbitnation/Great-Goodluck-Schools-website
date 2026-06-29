import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import PublicLayout from '../../components/layout/PublicLayout'
import { apiBaseUrl, parseJsonResponse } from '../../lib/apiBase'
import Seo from '../../components/Seo'

type FormField = { id: string; label: string; type: string; required?: boolean }
type PublicForm = { id: string; title: string; description: string | null; fields: FormField[] }

export default function PublicFormPage() {
  const router = useRouter()
  const slug = router.query.slug as string
  const [form, setForm] = useState<PublicForm | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`${apiBaseUrl()}/api/forms/${slug}/public`)
      .then((r) => parseJsonResponse<{ form: PublicForm }>(r))
      .then((d) => setForm(d.form))
      .catch((e) => setError(e.message))
  }, [slug])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    await fetch(`${apiBaseUrl()}/api/forms/${form.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: values,
        submitterEmail: values.email,
        submitterName: values.name,
      }),
    })
    setDone(true)
  }

  if (error) return <PublicLayout title="Form"><p className="p-8 text-red-600">{error}</p></PublicLayout>
  if (!form) return <PublicLayout title="Form"><p className="p-8 text-slate-500">Loading…</p></PublicLayout>
  if (done) return (
    <PublicLayout title="Submitted">
      <div className="container-school py-16 text-center">
        <h1 className="text-2xl font-bold text-school-navy">Thank you</h1>
        <p className="mt-2 text-slate-600">Your response has been recorded.</p>
      </div>
    </PublicLayout>
  )

  return (
    <>
      <Seo title={form.title} description={form.description || ''} path={`/forms/${slug}`} />
      <PublicLayout title={form.title}>
        <div className="container-school max-w-lg py-12">
          {form.description && <p className="mb-6 text-slate-600">{form.description}</p>}
          <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
            {form.fields.map((field) => (
              <label key={field.id} className="block text-sm">
                {field.label}{field.required && ' *'}
                {field.type === 'textarea' ? (
                  <textarea className="mt-1 w-full rounded-lg border px-3 py-2" required={field.required} onChange={(e) => setValues({ ...values, [field.id]: e.target.value })} />
                ) : (
                  <input type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'} className="mt-1 w-full rounded-lg border px-3 py-2" required={field.required} onChange={(e) => setValues({ ...values, [field.id]: e.target.value })} />
                )}
              </label>
            ))}
            <button type="submit" className="btn-gold w-full justify-center">Submit</button>
          </form>
        </div>
      </PublicLayout>
    </>
  )
}
