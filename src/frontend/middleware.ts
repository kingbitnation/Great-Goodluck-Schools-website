import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MAIN_HOSTS = new Set(['localhost', '127.0.0.1'])

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() || ''
  if (!host || MAIN_HOSTS.has(host)) return NextResponse.next()

  const response = NextResponse.next()
  response.cookies.set('tenant_domain', host, { path: '/', sameSite: 'lax' })
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
