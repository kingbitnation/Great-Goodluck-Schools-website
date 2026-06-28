import Link from 'next/link'
import PublicCmsPage from '../components/public/PublicCmsPage'
import Reveal from '../components/public/Reveal'

export default function FaqPage() {
  return (
    <PublicCmsPage slug="faq" fallbackTitle="FAQ" fallbackSubtitle="Frequently asked questions">
      {(page) => (
        <div className="max-w-3xl space-y-4">
          {(page.body.faqs || []).map((f) => (
            <details key={f.q} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-gray-900">
              <summary className="font-medium cursor-pointer">{f.q}</summary>
              <p className="mt-3 text-gray-600 dark:text-gray-400 text-sm">{f.a}</p>
            </details>
          ))}
        </div>
      )}
    </PublicCmsPage>
  )
}
