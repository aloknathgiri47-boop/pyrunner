'use client'

import { useMemo, Fragment } from 'react'

interface AndroidLayoutPreviewProps {
  files: Record<string, string>
  layoutPath: string
}

interface ResourceTable {
  strings: Record<string, string>
  colors: Record<string, string>
}

export default function AndroidLayoutPreview({ files, layoutPath }: AndroidLayoutPreviewProps) {
  const { layoutXml, resources, error } = useMemo(() => {
    const xml = files[layoutPath]
    if (!xml) return { layoutXml: '', resources: null, error: `Layout file not found: ${layoutPath}` }
    const rt: ResourceTable = { strings: {}, colors: {} }
    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith('/values/strings.xml') || path === 'strings.xml') {
        const re = /<string\s+name="([^"]+)"[^>]*>([^<]*)<\/string>/g
        let m
        while ((m = re.exec(content)) !== null) rt.strings[m[1]] = m[2]
      }
      if (path.endsWith('/values/colors.xml') || path === 'colors.xml') {
        const re = /<color\s+name="([^"]+)">([^<]+)<\/color>/g
        let m
        while ((m = re.exec(content)) !== null) rt.colors[m[1]] = m[2].trim()
      }
    }
    return { layoutXml: xml, resources: rt, error: null }
  }, [files, layoutPath])

  if (error) return <div className="flex h-full items-center justify-center text-rose-400 text-sm p-4 text-center">{error}</div>

  let docElement: Element | null = null
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(layoutXml, 'text/xml')
    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      return <div className="flex h-full items-center justify-center text-rose-400 text-sm p-4 text-center">XML parse error: {parserError.textContent?.slice(0, 200)}</div>
    }
    docElement = doc.documentElement
  } catch (e) {
    return <div className="flex h-full items-center justify-center text-rose-400 text-sm p-4 text-center">Failed to parse XML: {(e as Error).message}</div>
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-zinc-900 p-4 overflow-auto">
      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-3">Android Layout Preview</div>
      <div className="relative bg-zinc-950 rounded-[2rem] border-4 border-zinc-800 shadow-2xl" style={{ width: 360, height: 720, overflow: 'hidden' }}>
        <div className="bg-zinc-900 text-zinc-400 text-[10px] font-mono px-4 py-1 flex justify-between">
          <span>9:41</span><span>📶 🔋 ▮▮▮</span>
        </div>
        <div className="bg-white text-black" style={{ width: '100%', height: 'calc(100% - 24px)', overflow: 'auto' }}>
          {renderView(docElement, resources!)}
        </div>
      </div>
      <div className="text-[10px] text-zinc-500 mt-3 max-w-[360px] text-center">
        Visual approximation — not a real emulator. Layout: <code className="text-zinc-400">{layoutPath.split('/').pop()}</code>
      </div>
    </div>
  )
}

function renderView(el: Element, rt: ResourceTable, depth = 0): React.ReactNode {
  if (!el) return null
  const tag = el.tagName
  if (tag === '?xml' || tag.startsWith('#')) return null
  const children = Array.from(el.children)

  switch (tag) {
    case 'LinearLayout':
    case 'androidx.appcompat.widget.LinearLayoutCompat':
    case 'ViewGroup':
      return renderLinearLayout(el, rt, children, depth)
    case 'FrameLayout':
      return renderFrameLayout(el, rt, children, depth)
    case 'RelativeLayout':
    case 'androidx.constraintlayout.widget.ConstraintLayout':
    case 'androidx.coordinatorlayout.widget.CoordinatorLayout':
      return renderLinearLayout(el, rt, children, depth)
    case 'ScrollView':
    case 'androidx.core.widget.NestedScrollView':
    case 'HorizontalScrollView':
      return renderScrollView(el, rt, children, depth)
    case 'TextView':
    case 'androidx.appcompat.widget.AppCompatTextView':
      return renderTextView(el, rt)
    case 'Button':
    case 'androidx.appcompat.widget.AppCompatButton':
    case 'android.widget.Button':
      return renderButton(el, rt)
    case 'EditText':
    case 'androidx.appcompat.widget.AppCompatEditText':
      return renderEditText(el, rt)
    case 'ImageView':
    case 'androidx.appcompat.widget.AppCompatImageView':
      return renderImageView(el, rt)
    case 'CheckBox':
      return renderCheckBox(el, rt)
    case 'RadioButton':
      return renderRadioButton(el, rt)
    case 'Switch':
    case 'ToggleButton':
    case 'androidx.appcompat.widget.SwitchCompat':
      return renderSwitch(el, rt)
    case 'ProgressBar':
      return renderProgressBar(el, rt)
    case 'SeekBar':
      return renderSeekBar(el, rt)
    case 'CardView':
    case 'androidx.cardview.widget.CardView':
    case 'com.google.android.material.card.MaterialCardView':
      return renderCardView(el, rt, children, depth)
    case 'View':
      return <div key={`v-${depth}-${Math.random()}`} style={parseViewStyle(el, rt)} />
    case 'include': {
      const layoutRef = el.getAttribute('layout')
      return <div key={`inc-${depth}`} style={{ padding: 8, background: '#f3f4f6', border: '1px dashed #9ca3af', margin: 4, fontSize: 11, color: '#6b7280' }}>&lt;include layout="{layoutRef}" /&gt;</div>
    }
    default:
      if (children.length > 0) {
        return <div key={`unk-${depth}-${Math.random()}`} style={parseContainerStyle(el, rt)}>{children.map((c, i) => <Fragment key={i}>{renderView(c, rt, depth + 1)}</Fragment>)}</div>
      }
      return <div key={`unk2-${depth}-${Math.random()}`} style={{ ...parseViewStyle(el, rt), border: '1px dashed #d1d5db', padding: 4, fontSize: 10, color: '#9ca3af' }}>&lt;{tag}&gt;</div>
  }
}

function renderLinearLayout(el: Element, rt: ResourceTable, children: Element[], depth: number): React.ReactNode {
  const orientation = el.getAttribute('android:orientation') || 'vertical'
  const style = parseContainerStyle(el, rt)
  const flexDirection = orientation === 'horizontal' ? 'row' : 'column'
  return <div key={`ll-${depth}-${Math.random()}`} style={{ ...style, display: 'flex', flexDirection }}>{children.map((c, i) => <Fragment key={i}>{renderView(c, rt, depth + 1)}</Fragment>)}</div>
}
function renderFrameLayout(el: Element, rt: ResourceTable, children: Element[], depth: number): React.ReactNode {
  const style = parseContainerStyle(el, rt)
  return <div key={`fl-${depth}-${Math.random()}`} style={{ ...style, position: 'relative' }}>{children.map((c, i) => <Fragment key={i}>{renderView(c, rt, depth + 1)}</Fragment>)}</div>
}
function renderScrollView(el: Element, rt: ResourceTable, children: Element[], depth: number): React.ReactNode {
  const style = parseContainerStyle(el, rt)
  return <div key={`sv-${depth}-${Math.random()}`} style={{ ...style, overflow: 'auto', display: 'flex', flexDirection: 'column', flex: 1 }}>{children.map((c, i) => <Fragment key={i}>{renderView(c, rt, depth + 1)}</Fragment>)}</div>
}
function renderTextView(el: Element, rt: ResourceTable): React.ReactNode {
  const style = parseViewStyle(el, rt)
  const text = resolveString(el.getAttribute('android:text') || '', rt)
  const textSize = el.getAttribute('android:textSize')
  const textColor = el.getAttribute('android:textColor')
  const textStyle = el.getAttribute('android:textStyle') || ''
  const gravity = el.getAttribute('android:gravity') || el.getAttribute('android:textAlignment') || ''
  const finalStyle: React.CSSProperties = { ...style }
  if (textSize) finalStyle.fontSize = parseDimension(textSize)
  if (textColor) finalStyle.color = resolveColor(textColor, rt)
  if (textStyle.includes('bold')) finalStyle.fontWeight = 'bold'
  if (textStyle.includes('italic')) finalStyle.fontStyle = 'italic'
  if (gravity.includes('center')) { finalStyle.textAlign = 'center'; finalStyle.alignSelf = 'center' }
  else if (gravity.includes('right')) finalStyle.textAlign = 'right'
  return <div style={finalStyle}>{text || '\u00A0'}</div>
}
function renderButton(el: Element, rt: ResourceTable): React.ReactNode {
  const style = parseViewStyle(el, rt)
  const text = resolveString(el.getAttribute('android:text') || '', rt)
  const enabled = el.getAttribute('android:enabled') !== 'false'
  return <button style={{ ...style, background: enabled ? '#6200ee' : '#ccc', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 14, cursor: enabled ? 'pointer' : 'not-allowed', fontWeight: 500 }} disabled={!enabled}>{text}</button>
}
function renderEditText(el: Element, rt: ResourceTable): React.ReactNode {
  const style = parseViewStyle(el, rt)
  const hint = resolveString(el.getAttribute('android:hint') || '', rt)
  const inputType = el.getAttribute('android:inputType') || ''
  const isPassword = inputType.includes('password')
  const isNumber = inputType.includes('number')
  return <input type={isPassword ? 'password' : isNumber ? 'number' : 'text'} placeholder={hint} style={{ ...style, border: '1px solid #9ca3af', borderRadius: 4, padding: '8px 12px', fontSize: 14, outline: 'none' }} />
}
function renderImageView(el: Element, rt: ResourceTable): React.ReactNode {
  const style = parseViewStyle(el, rt)
  const src = el.getAttribute('android:src') || el.getAttribute('app:srcCompat') || ''
  const contentDescription = el.getAttribute('android:contentDescription') || ''
  const width = el.getAttribute('android:layout_width') || 'wrap_content'
  const height = el.getAttribute('android:layout_height') || 'wrap_content'
  const finalStyle: React.CSSProperties = { ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e5e7eb', border: '1px dashed #9ca3af', fontSize: 10, color: '#6b7280' }
  if (width === 'match_parent') finalStyle.width = '100%'
  else if (width.endsWith('dp')) finalStyle.width = parseDimension(width)
  else finalStyle.minWidth = 48
  if (height === 'match_parent') finalStyle.height = '100%'
  else if (height.endsWith('dp')) finalStyle.height = parseDimension(height)
  else finalStyle.minHeight = 48
  return <div style={finalStyle}>{contentDescription ? `🖼️ ${contentDescription}` : (src ? `🖼️ ${src}` : '🖼️')}</div>
}
function renderCheckBox(el: Element, rt: ResourceTable): React.ReactNode {
  const style = parseViewStyle(el, rt)
  const text = resolveString(el.getAttribute('android:text') || '', rt)
  const checked = el.getAttribute('android:checked') === 'true'
  return <label style={{ ...style, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}><input type="checkbox" defaultChecked={checked} readOnly /><span>{text}</span></label>
}
function renderRadioButton(el: Element, rt: ResourceTable): React.ReactNode {
  const style = parseViewStyle(el, rt)
  const text = resolveString(el.getAttribute('android:text') || '', rt)
  const checked = el.getAttribute('android:checked') === 'true'
  return <label style={{ ...style, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}><input type="radio" defaultChecked={checked} readOnly /><span>{text}</span></label>
}
function renderSwitch(el: Element, rt: ResourceTable): React.ReactNode {
  const style = parseViewStyle(el, rt)
  const text = resolveString(el.getAttribute('android:text') || '', rt)
  const checked = el.getAttribute('android:checked') === 'true'
  return <label style={{ ...style, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}><input type="checkbox" defaultChecked={checked} readOnly /><span>{text}</span></label>
}
function renderProgressBar(el: Element, rt: ResourceTable): React.ReactNode {
  const style = parseViewStyle(el, rt)
  const indeterminate = el.getAttribute('android:indeterminate') === 'true' || !el.getAttribute('android:max')
  const max = parseInt(el.getAttribute('android:max') || '100', 10)
  const progress = parseInt(el.getAttribute('android:progress') || '0', 10)
  const pct = max > 0 ? (progress / max) * 100 : 0
  if (indeterminate) {
    return <div style={{ ...style, padding: 8 }}><div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}><div style={{ width: '40%', height: '100%', background: '#6200ee', animation: 'progress 1.5s linear infinite' }} /></div><style>{`@keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`}</style></div>
  }
  return <div style={{ ...style, padding: 8 }}><div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: '#6200ee' }} /></div></div>
}
function renderSeekBar(el: Element, rt: ResourceTable): React.ReactNode {
  const style = parseViewStyle(el, rt)
  const max = parseInt(el.getAttribute('android:max') || '100', 10)
  const progress = parseInt(el.getAttribute('android:progress') || '0', 10)
  return <div style={{ ...style, padding: 8 }}><input type="range" min={0} max={max} defaultValue={progress} readOnly style={{ width: '100%' }} /></div>
}
function renderCardView(el: Element, rt: ResourceTable, children: Element[], depth: number): React.ReactNode {
  const style = parseContainerStyle(el, rt)
  const radius = el.getAttribute('app:cardCornerRadius') || el.getAttribute('android:cardCornerRadius') || '4dp'
  return <div key={`cv-${depth}-${Math.random()}`} style={{ ...style, background: 'white', borderRadius: parseDimension(radius), boxShadow: '0 2px 8px rgba(0,0,0,0.15)', padding: 16 }}>{children.map((c, i) => <Fragment key={i}>{renderView(c, rt, depth + 1)}</Fragment>)}</div>
}

function parseContainerStyle(el: Element, rt: ResourceTable): React.CSSProperties { return parseViewStyle(el, rt) }

function parseViewStyle(el: Element, rt: ResourceTable): React.CSSProperties {
  const style: React.CSSProperties = {}
  const width = el.getAttribute('android:layout_width')
  const height = el.getAttribute('android:layout_height')
  if (width === 'match_parent' || width === 'fill_parent') style.width = '100%'
  else if (width && width.endsWith('dp')) style.width = parseDimension(width)
  if (height === 'match_parent' || height === 'fill_parent') style.height = '100%'
  else if (height && height.endsWith('dp')) style.height = parseDimension(height)
  const padding = el.getAttribute('android:padding')
  if (padding) style.padding = parseDimension(padding)
  const pL = el.getAttribute('android:paddingLeft'); if (pL) style.paddingLeft = parseDimension(pL)
  const pR = el.getAttribute('android:paddingRight'); if (pR) style.paddingRight = parseDimension(pR)
  const pT = el.getAttribute('android:paddingTop'); if (pT) style.paddingTop = parseDimension(pT)
  const pB = el.getAttribute('android:paddingBottom'); if (pB) style.paddingBottom = parseDimension(pB)
  const margin = el.getAttribute('android:layout_margin')
  if (margin) style.margin = parseDimension(margin)
  const mL = el.getAttribute('android:layout_marginLeft'); if (mL) style.marginLeft = parseDimension(mL)
  const mR = el.getAttribute('android:layout_marginRight'); if (mR) style.marginRight = parseDimension(mR)
  const mT = el.getAttribute('android:layout_marginTop'); if (mT) style.marginTop = parseDimension(mT)
  const mB = el.getAttribute('android:layout_marginBottom'); if (mB) style.marginBottom = parseDimension(mB)
  const bg = el.getAttribute('android:background')
  if (bg) {
    if (bg.startsWith('@color/')) style.background = resolveColor(bg, rt)
    else if (bg.startsWith('#')) style.background = bg
    else if (bg.startsWith('@drawable/')) style.background = '#f3f4f6'
  }
  const vis = el.getAttribute('android:visibility')
  if (vis === 'gone') style.display = 'none'
  else if (vis === 'invisible') style.visibility = 'hidden'
  const gravity = el.getAttribute('android:layout_gravity')
  if (gravity) {
    if (gravity.includes('center')) style.alignSelf = 'center'
    else if (gravity.includes('right')) style.alignSelf = 'flex-end'
    else if (gravity.includes('left')) style.alignSelf = 'flex-start'
  }
  const weight = el.getAttribute('android:layout_weight')
  if (weight) style.flexGrow = parseFloat(weight)
  const minW = el.getAttribute('android:minWidth'); if (minW) style.minWidth = parseDimension(minW)
  const minH = el.getAttribute('android:minHeight'); if (minH) style.minHeight = parseDimension(minH)
  if (!style.minWidth && !style.width) style.minWidth = 16
  if (!style.minHeight && !style.height) style.minHeight = 16
  return style
}

function parseDimension(dim: string): string {
  if (!dim) return '0'
  return dim.replace(/dp$/i, 'px').replace(/sp$/i, 'px').replace(/dip$/i, 'px')
}

function resolveString(value: string, rt: ResourceTable): string {
  if (!value) return ''
  if (value.startsWith('@string/')) {
    const name = value.slice('@string/'.length)
    return rt.strings[name] || value
  }
  return value.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}

function resolveColor(value: string, rt: ResourceTable): string {
  if (!value) return ''
  if (value.startsWith('@color/')) {
    const name = value.slice('@color/'.length)
    return rt.colors[name] || '#000000'
  }
  if (value.startsWith('#')) {
    if (value.length === 4) {
      const r = value[1], g = value[2], b = value[3]
      return `#${r}${r}${g}${g}${b}${b}`
    }
    if (value.length === 9) {
      const a = value.slice(1, 3), r = value.slice(3, 5), g = value.slice(5, 7), b = value.slice(7, 9)
      return `#${r}${g}${b}${a}`
    }
    return value
  }
  return value
}
