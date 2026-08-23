/**
 * POST /api/android-preview
 * 
 * Accepts generated HTML, stores it, returns:
 * { success, previewId, previewUrl, qrCode }
 * 
 * The HTML is generated client-side (from XML AST + transpiled Kotlin JS)
 * and sent as the request body. This keeps the server simple — it only
 * stores and serves, never executes user code.
 */

import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { storePreview, cleanupExpired } from '@/lib/preview-storage'

const MAX_HTML_SIZE = 500_000 // 500 KB max

// Rate limiting (simple in-memory, per-IP)
const rateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60_000 // 1 minute
const RATE_LIMIT_MAX = 10 // 10 requests per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimit.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: 'Rate limited. Please wait a moment.' },
        { status: 429 }
      )
    }

    // Cleanup expired previews periodically
    cleanupExpired()

    const body = await req.json()
    const html = body?.html as string

    if (!html || typeof html !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "html" field' },
        { status: 400 }
      )
    }

    if (html.length > MAX_HTML_SIZE) {
      return NextResponse.json(
        { success: false, error: `HTML too large (${html.length} bytes, max ${MAX_HTML_SIZE})` },
        { status: 413 }
      )
    }

    // Basic sanitization: reject if it contains script tags from external sources
    // (our generated HTML has inline scripts, which is fine)
    if (html.includes('<script src="http')) {
      return NextResponse.json(
        { success: false, error: 'External script sources are not allowed' },
        { status: 400 }
      )
    }

    // Store the preview
    const previewId = storePreview(html)

    // Build the public URL
    const protocol = req.headers.get('x-forwarded-proto') || 'http'
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
    const previewUrl = `${protocol}://${host}/preview/${previewId}`

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(previewUrl, {
      width: 256,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })

    return NextResponse.json({
      success: true,
      previewId,
      previewUrl,
      qrCode,
      expiresIn: '60 minutes',
    })
  } catch (e) {
    console.error('Preview API error:', e)
    return NextResponse.json(
      { success: false, error: `Server error: ${(e as Error).message}` },
      { status: 500 }
    )
  }
}
