import PublicLayout from '../layout/PublicLayout'
import Reveal from './Reveal'

type SimplePublicPageProps = {
  title: string
  subtitle?: string
  paragraphs: string[]
  bullets?: string[]
}

export default function SimplePublicPage({ title, subtitle, paragraphs, bullets }: SimplePublicPageProps) {
  return (
    <PublicLayout title={title} subtitle={subtitle}>
      <Reveal>
        <div className="glass-card max-w-3xl rounded-3xl p-8 sm:p-10">
          <div className="space-y-4 leading-relaxed text-slate-600">
            {paragraphs.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </div>
          {bullets && (
            <ul className="mt-8 space-y-3 border-t border-slate-100 pt-8">
              {bullets.map((b) => (
                <li key={b} className="flex gap-3 text-slate-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-school-gold/20 text-xs font-bold text-amber-800">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Reveal>
    </PublicLayout>
  )
}
