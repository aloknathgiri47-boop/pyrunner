/**
 * Preview Storage — in-memory store for generated previews.
 * 
 * Previews are stored for 60 minutes then automatically deleted.
 * No source code is stored — only the generated HTML.
 */

interface StoredPreview {
  html: string
  createdAt: number
  expiresAt: number
}

const TTL_MS = 60 * 60 * 1000 // 60 minutes
const MAX_PREVIEWS = 100 // prevent memory exhaustion

// In-memory store (persists for the lifetime of the server process)
const previews = new Map<string, StoredPreview>()

/** Generate a random 8-character alphanumeric ID. */
export function generatePreviewId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  // Ensure uniqueness
  if (previews.has(id)) return generatePreviewId()
  return id
}

/** Store a generated preview HTML. Returns the preview ID. */
export function storePreview(html: string): string {
  const id = generatePreviewId()
  const now = Date.now()

  // Enforce max previews (evict oldest)
  if (previews.size >= MAX_PREVIEWS) {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    for (const [k, v] of previews) {
      if (v.createdAt < oldestTime) {
        oldestTime = v.createdAt
        oldestKey = k
      }
    }
    if (oldestKey) previews.delete(oldestKey)
  }

  previews.set(id, {
    html,
    createdAt: now,
    expiresAt: now + TTL_MS,
  })

  return id
}

/** Retrieve a preview by ID. Returns null if not found or expired. */
export function getPreview(id: string): StoredPreview | null {
  const preview = previews.get(id)
  if (!preview) return null

  // Check expiration
  if (Date.now() > preview.expiresAt) {
    previews.delete(id)
    return null
  }

  return preview
}

/** Clean up expired previews (called periodically). */
export function cleanupExpired(): number {
  const now = Date.now()
  let cleaned = 0
  for (const [id, preview] of previews) {
    if (now > preview.expiresAt) {
      previews.delete(id)
      cleaned++
    }
  }
  return cleaned
}

/** Get current number of stored previews (for monitoring). */
export function getPreviewCount(): number {
  return previews.size
}
