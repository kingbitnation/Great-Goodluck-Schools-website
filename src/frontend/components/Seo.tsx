import Head from 'next/head'

type SeoProps = {
  title?: string
  description?: string
  path?: string
  noIndex?: boolean
}

const SITE = 'SchoolPilot'
const DEFAULT_DESC =
  'SchoolPilot — multi-school ERP for academics, fees, CBT, LMS, HR, payroll, and parent portals.'

export default function Seo({
  title,
  description = DEFAULT_DESC,
  path = '',
  noIndex = false,
}: SeoProps) {
  const fullTitle = title ? `${title} | ${SITE}` : `${SITE} | School Management Platform`
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  const url = base ? `${base.replace(/\/$/, '')}${path}` : undefined

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {url && <meta property="og:url" content={url} />}
      <meta name="twitter:card" content="summary_large_image" />
    </Head>
  )
}
