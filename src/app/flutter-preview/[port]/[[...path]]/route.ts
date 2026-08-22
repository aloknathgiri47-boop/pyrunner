/**
 * Next.js catch-all route that proxies /flutter-preview/<port>/<path...> to
 * localhost:<port>/<path...>.
 *
 * Why this exists:
 *   The Flutter web build's index.html contains `<base href="/">` and
 *   `<script src="flutter.js">`. When the preview iframe loads
 *   `/?XTransformPort=<port>`, the server returns HTML with the base href
 *   rewritten to `/flutter-preview/<port>/`. Per RFC 3986 URL resolution
 *   rules, relative URLs against a PATH-based base preserve the path prefix:
 *
 *     base:  /flutter-preview/41711/
 *     rel:   flutter.js
 *     res:   /flutter-preview/41711/flutter.js     <- path preserved!
 *
 *   (Compare with query-based base `/?XTransformPort=41711` - relative
 *   URLs that have their own path component DROP the query, so the
 *   browser would fetch `/flutter.js` and get a 404.)
 *
 * Flow:
 *   1. Browser loads iframe `/?XTransformPort=41711` -> Caddy -> flutter-server
 *   2. flutter-server returns HTML with `<base href="/flutter-preview/41711/">`
 *   3. Browser fetches `/flutter-preview/41711/flutter.js` -> Caddy -> Next.js
 *   4. This route handler proxies to `localhost:41711/flutter.js`
 *   5. flutter-server returns `flutter.js`
 *   6. flutter.js dynamically loads main.dart.js, canvaskit/*, assets/* -
 *      all resolved against the base, so all go through this proxy.
 *
 * NOTE: Folder name must NOT start with `_` - Next.js treats _-prefixed
 * folders as private and excludes them from routing.
 */

import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UPSTREAM_TIMEOUT_MS = 30_000

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ port: string; path?: string[] }> }
) {
  return proxy(req, ctx)
}

export async function HEAD(
  req: NextRequest,
  ctx: { params: Promise<{ port: string; path?: string[] }> }
) {
  return proxy(req, ctx)
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ port: string; path?: string[] }> }
) {
  return proxy(req, ctx)
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ port: string; path?: string[] }> }
) {
  const { port, path } = await ctx.params

  // Validate port (digits only, 1-5 digits)
  if (!/^\d{1,5}$/.test(port)) {
    return new Response('Invalid port', { status: 400 })
  }
  const portNum = parseInt(port, 10)
  if (portNum < 1 || portNum > 65535) {
    return new Response('Port out of range', { status: 400 })
  }

  // Build upstream URL
  const pathStr = path && path.length > 0 ? path.join('/') : ''
  // Reconstruct the query string from the incoming URL
  const url = new URL(req.url)
  const search = url.search || ''
  const upstream = `http://127.0.0.1:${portNum}/${pathStr}${search}`

  // Build upstream request, forwarding necessary headers
  const headers = new Headers()
  const forwardHeaders = [
    'accept',
    'accept-language',
    'cache-control',
    'pragma',
    'range',
    'if-modified-since',
    'if-none-match',
    'content-type',
    'content-length',
  ]
  for (const h of forwardHeaders) {
    const v = req.headers.get(h)
    if (v) headers.set(h, v)
  }

  // Read body (for POST etc.)
  let body: BodyInit | null = null
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    body = await req.arrayBuffer()
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    const upstreamRes = await fetch(upstream, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
      redirect: 'manual',
    })
    clearTimeout(timer)

    // Forward the response, preserving status, headers, and body
    const respHeaders = new Headers()
    upstreamRes.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      // Skip headers that Next.js / the browser should set themselves
      if (
        lower === 'transfer-encoding' ||
        lower === 'connection' ||
        lower === 'content-length' ||
        lower === 'content-encoding' ||
        lower === 'keep-alive'
      ) {
        return
      }
      respHeaders.set(key, value)
    })
    // Allow iframe embedding
    respHeaders.delete('x-frame-options')
    respHeaders.delete('content-security-policy')
    respHeaders.set('access-control-allow-origin', '*')

    const buf = await upstreamRes.arrayBuffer()
    return new Response(buf, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: respHeaders,
    })
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'upstream timeout' : (err?.message || 'upstream error')
    return new Response(`Proxy error: ${msg}`, { status: 502 })
  }
}
