/**
 * Preview Generator — combines XML AST + transpiled Kotlin JS into a complete
 * standalone HTML page that can be served at /preview/<id>.
 */

import type { UIElement } from './android-xml-parser'
import { parseDimension, resolveColor } from './android-xml-parser'
import type { ResourceTable } from './android-xml-parser'
import type { TranspileResult } from './kotlin-transpiler'

/**
 * Generates a complete standalone HTML page from:
 * - UIElement AST (parsed from layout XML)
 * - Transpiled JavaScript (from Kotlin)
 * - Resource table (strings, colors)
 */
export function generatePreviewHtml(
  ast: UIElement,
  transpiledJs: TranspileResult,
  resources: ResourceTable
): string {
  const html = astToHtml(ast, resources)
  const js = transpiledJs.js

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Android Preview</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif; background: #fff; color: #000; overflow-x: hidden; }
.android-screen { width: 100%; min-height: 100vh; max-width: 480px; margin: 0 auto; background: #fff; position: relative; overflow: hidden; }
.toast-container { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 9999; pointer-events: none; }
.toast { background: rgba(0,0,0,0.8); color: #fff; padding: 12px 24px; border-radius: 24px; font-size: 14px; margin-bottom: 8px; animation: fadeIn 0.3s, fadeOut 0.3s 2.7s; opacity: 0; }
.toast.show { opacity: 1; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeOut { to { opacity: 0; } }
button { font-family: inherit; }
input { font-family: inherit; }
</style>
</head>
<body>
<div class="android-screen" id="root">
${html}
</div>
<div class="toast-container" id="toastContainer"></div>
<script>
// ===== Android Runtime (browser-side) =====
function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Expose globally for transpiled code
window.showToast = showToast;
window.View = { VISIBLE: 'visible', GONE: 'gone', INVISIBLE: 'invisible' };

// ===== User Kotlin (transpiled to JS) =====
try {
${js}
} catch(e) {
  console.error('Runtime error:', e);
  showToast('Runtime error: ' + e.message);
}
</script>
</body>
</html>`
}

/** Recursively converts a UIElement AST node to an HTML string with inline CSS. */
function astToHtml(el: UIElement, resources: ResourceTable): string {
  const style = attrsToCss(el, resources)
  const idAttr = el.id ? `id="${el.id}"` : ''

  switch (el.type) {
    case 'LinearLayout':
    case 'ViewGroup':
    case 'CoordinatorLayout':
    case 'ConstraintLayout':
    case 'RelativeLayout': {
      const flexDirection = el.attrs.orientation === 'horizontal' ? 'row' : 'column'
      const childrenHtml = el.children.map(c => astToHtml(c, resources)).join('\n')
      return `<div ${idAttr} style="${style} display:flex; flex-direction:${flexDirection};">${childrenHtml}</div>`
    }
    case 'FrameLayout': {
      const childrenHtml = el.children.map(c => astToHtml(c, resources)).join('\n')
      return `<div ${idAttr} style="${style} position:relative;">${childrenHtml}</div>`
    }
    case 'ScrollView':
    case 'NestedScrollView': {
      const childrenHtml = el.children.map(c => astToHtml(c, resources)).join('\n')
      return `<div ${idAttr} style="${style} overflow-y:auto; display:flex; flex-direction:column; flex:1;">${childrenHtml}</div>`
    }
    case 'HorizontalScrollView': {
      const childrenHtml = el.children.map(c => astToHtml(c, resources)).join('\n')
      return `<div ${idAttr} style="${style} overflow-x:auto; display:flex; flex-direction:row; flex:1;">${childrenHtml}</div>`
    }
    case 'TextView': {
      const text = el.attrs.text || ''
      const textStyle = el.attrs.textStyle || ''
      let extraStyle = ''
      if (textStyle.includes('bold')) extraStyle += 'font-weight:bold;'
      if (textStyle.includes('italic')) extraStyle += 'font-style:italic;'
      if (el.attrs.gravity?.includes('center')) extraStyle += 'text-align:center;align-self:center;'
      else if (el.attrs.gravity?.includes('right')) extraStyle += 'text-align:right;'
      return `<div ${idAttr} style="${style} ${extraStyle}">${escapeHtml(text) || '&nbsp;'}</div>`
    }
    case 'Button': {
      const text = el.attrs.text || ''
      const enabled = el.attrs.enabled !== false
      return `<button ${idAttr} style="${style} background:${enabled ? '#6200ee' : '#ccc'};color:#fff;border:none;border-radius:4px;padding:8px 16px;font-size:14px;cursor:${enabled ? 'pointer' : 'not-allowed'};font-weight:500;" ${enabled ? '' : 'disabled'}>${escapeHtml(text)}</button>`
    }
    case 'EditText': {
      const hint = el.attrs.hint || ''
      const inputType = el.attrs.inputType || ''
      const type = inputType.includes('password') ? 'password' : inputType.includes('number') ? 'number' : 'text'
      return `<input ${idAttr} type="${type}" placeholder="${escapeHtml(hint)}" style="${style} border:1px solid #9ca3af;border-radius:4px;padding:8px 12px;font-size:14px;outline:none;" />`
    }
    case 'ImageView': {
      const alt = el.attrs.contentDescription || ''
      const w = el.attrs.layoutWidth
      const h = el.attrs.layoutHeight
      let dims = ''
      if (w === 'match_parent') dims += 'width:100%;'
      else if (w?.endsWith('dp')) dims += `width:${parseDimension(w)};`
      else dims += 'min-width:48px;'
      if (h === 'match_parent') dims += 'height:100%;'
      else if (h?.endsWith('dp')) dims += `height:${parseDimension(h)};`
      else dims += 'min-height:48px;'
      return `<div ${idAttr} style="${style} ${dims} display:flex;align-items:center;justify-content:center;background:#e5e7eb;border:1px dashed #9ca3af;font-size:10px;color:#6b7280;">${escapeHtml(alt) || '🖼️'}</div>`
    }
    case 'CheckBox': {
      const text = el.attrs.text || ''
      const checked = el.attrs.checked ? 'checked' : ''
      return `<label ${idAttr} style="${style} display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" ${checked} />${escapeHtml(text)}</label>`
    }
    case 'RadioButton': {
      const text = el.attrs.text || ''
      const checked = el.attrs.checked ? 'checked' : ''
      return `<label ${idAttr} style="${style} display:flex;align-items:center;gap:6px;font-size:14px;"><input type="radio" ${checked} />${escapeHtml(text)}</label>`
    }
    case 'Switch':
    case 'ToggleButton': {
      const text = el.attrs.text || ''
      const checked = el.attrs.checked ? 'checked' : ''
      return `<label ${idAttr} style="${style} display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" ${checked} />${escapeHtml(text)}</label>`
    }
    case 'ProgressBar': {
      const indet = el.attrs.indeterminate
      if (indet) {
        return `<div ${idAttr} style="${style} padding:8px;"><div style="height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;"><div style="width:40%;height:100%;background:#6200ee;animation:pbar 1.5s linear infinite;"></div></div></div><style>@keyframes pbar{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}</style>`
      }
      const max = parseInt(el.attrs.max || '100', 10)
      const progress = parseInt(el.attrs.progress || '0', 10)
      const pct = max > 0 ? (progress / max) * 100 : 0
      return `<div ${idAttr} style="${style} padding:8px;"><div style="height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:#6200ee;"></div></div></div>`
    }
    case 'SeekBar': {
      const max = parseInt(el.attrs.max || '100', 10)
      const progress = parseInt(el.attrs.progress || '0', 10)
      return `<div ${idAttr} style="${style} padding:8px;"><input type="range" min="0" max="${max}" value="${progress}" style="width:100%;" /></div>`
    }
    case 'CardView': {
      const radius = el.attrs.cardCornerRadius || '4dp'
      const childrenHtml = el.children.map(c => astToHtml(c, resources)).join('\n')
      return `<div ${idAttr} style="${style} background:#fff;border-radius:${parseDimension(radius)};box-shadow:0 2px 8px rgba(0,0,0,0.15);padding:16px;">${childrenHtml}</div>`
    }
    case 'View': {
      return `<div ${idAttr} style="${style}"></div>`
    }
    default: {
      // Unknown view type — render children if any
      if (el.children.length > 0) {
        const childrenHtml = el.children.map(c => astToHtml(c, resources)).join('\n')
        return `<div ${idAttr} style="${style}">${childrenHtml}</div>`
      }
      return `<div ${idAttr} style="${style} border:1px dashed #d1d5db;padding:4px;font-size:10px;color:#9ca3af;">&lt;${el.type}&gt;</div>`
    }
  }
}

/** Converts ViewAttributes to CSS string. */
function attrsToCss(el: UIElement, resources: ResourceTable): string {
  const a = el.attrs
  const parts: string[] = []

  // Width/Height
  if (a.layoutWidth === 'match_parent' || a.layoutWidth === 'fill_parent') parts.push('width:100%')
  else if (a.layoutWidth?.endsWith('dp')) parts.push(`width:${parseDimension(a.layoutWidth)}`)
  if (a.layoutHeight === 'match_parent' || a.layoutHeight === 'fill_parent') parts.push('height:100%')
  else if (a.layoutHeight?.endsWith('dp')) parts.push(`height:${parseDimension(a.layoutHeight)}`)

  // Padding
  if (a.padding) parts.push(`padding:${parseDimension(a.padding)}`)
  if (a.paddingLeft) parts.push(`padding-left:${parseDimension(a.paddingLeft)}`)
  if (a.paddingRight) parts.push(`padding-right:${parseDimension(a.paddingRight)}`)
  if (a.paddingTop) parts.push(`padding-top:${parseDimension(a.paddingTop)}`)
  if (a.paddingBottom) parts.push(`padding-bottom:${parseDimension(a.paddingBottom)}`)

  // Margin
  if (a.layoutMargin) parts.push(`margin:${parseDimension(a.layoutMargin)}`)
  if (a.layoutMarginLeft) parts.push(`margin-left:${parseDimension(a.layoutMarginLeft)}`)
  if (a.layoutMarginRight) parts.push(`margin-right:${parseDimension(a.layoutMarginRight)}`)
  if (a.layoutMarginTop) parts.push(`margin-top:${parseDimension(a.layoutMarginTop)}`)
  if (a.layoutMarginBottom) parts.push(`margin-bottom:${parseDimension(a.layoutMarginBottom)}`)

  // Background
  if (a.background) {
    if (a.background.startsWith('@color/')) parts.push(`background:${resolveColor(a.background, resources.colors)}`)
    else if (a.background.startsWith('#')) parts.push(`background:${a.background}`)
    else if (a.background.startsWith('@drawable/')) parts.push('background:#f3f4f6')
  }

  // Text size and color
  if (a.textSize) parts.push(`font-size:${parseDimension(a.textSize)}`)
  if (a.textColor) parts.push(`color:${resolveColor(a.textColor, resources.colors)}`)

  // Gravity (layout)
  if (a.layoutGravity) {
    if (a.layoutGravity.includes('center')) parts.push('align-self:center')
    else if (a.layoutGravity.includes('right')) parts.push('align-self:flex-end')
    else if (a.layoutGravity.includes('left')) parts.push('align-self:flex-start')
  }

  // Weight
  if (a.layoutWeight) parts.push(`flex-grow:${parseFloat(a.layoutWeight)}`)

  // Min dimensions
  if (a.minWidth) parts.push(`min-width:${parseDimension(a.minWidth)}`)
  if (a.minHeight) parts.push(`min-height:${parseDimension(a.minHeight)}`)

  // Visibility
  if (a.visibility === 'gone') parts.push('display:none')
  else if (a.visibility === 'invisible') parts.push('visibility:hidden')

  // Default min size so empty views are visible
  if (!parts.some(p => p.startsWith('min-width')) && !parts.some(p => p.startsWith('width'))) parts.push('min-width:16px')
  if (!parts.some(p => p.startsWith('min-height')) && !parts.some(p => p.startsWith('height'))) parts.push('min-height:16px')

  return parts.join(';')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
