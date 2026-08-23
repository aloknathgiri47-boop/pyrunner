/**
 * GET /preview/[id] — serves a stored preview HTML page.
 * 
 * This is the page users open on their phone after scanning the QR code.
 * It renders the generated interactive HTML (layout + transpiled Kotlin).
 */

import { getPreview } from '@/lib/preview-storage'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const preview = getPreview(id)

  if (!preview) {
    // Preview not found or expired — show a friendly error page
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview Expired</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#f3f4f6; }
.card { text-align:center; padding:40px; background:#fff; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.1); max-width:400px; }
h1 { color:#ef4444; font-size:24px; margin-bottom:8px; }
p { color:#6b7280; font-size:14px; line-height:1.5; }
</style>
</head>
<body>
<div class="card">
<h1>Preview Expired</h1>
<p>This preview has expired or doesn't exist. Previews are available for 60 minutes after generation. Please go back to PyRunner and click Run again.</p>
</div>
</body>
</html>`,
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    )
  }

  // Return the stored HTML directly
  return new Response(preview.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
