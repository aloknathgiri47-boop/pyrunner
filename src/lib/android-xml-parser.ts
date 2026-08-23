/**
 * Android XML Parser — parses Android layout XML into a clean AST.
 * 
 * The AST is an intermediate representation that can be rendered to:
 *   - React (in the IDE preview)
 *   - HTML/CSS (in the standalone preview page)
 *   - QR-code-able static HTML
 */

export interface UIElement {
  type: ViewType
  id?: string  // from android:id="@+id/xxx" → "xxx"
  attrs: ViewAttributes
  children: UIElement[]
}

export type ViewType =
  | 'LinearLayout' | 'FrameLayout' | 'RelativeLayout'
  | 'ConstraintLayout' | 'CoordinatorLayout'
  | 'ScrollView' | 'NestedScrollView' | 'HorizontalScrollView'
  | 'TextView' | 'Button' | 'EditText' | 'ImageView'
  | 'CheckBox' | 'RadioButton' | 'Switch' | 'ToggleButton'
  | 'ProgressBar' | 'SeekBar' | 'Spinner'
  | 'CardView' | 'MaterialCardView'
  | 'View' | 'ViewGroup'
  | string  // allow unknown types (will be warned about)

export interface ViewAttributes {
  text?: string
  hint?: string
  textSize?: string
  textColor?: string
  textStyle?: string  // "bold" | "italic" | "bold|italic"
  background?: string
  padding?: string
  paddingLeft?: string
  paddingRight?: string
  paddingTop?: string
  paddingBottom?: string
  layoutWidth?: string  // "match_parent" | "wrap_content" | "<n>dp"
  layoutHeight?: string
  layoutMargin?: string
  layoutMarginLeft?: string
  layoutMarginRight?: string
  layoutMarginTop?: string
  layoutMarginBottom?: string
  gravity?: string
  layoutGravity?: string
  orientation?: string  // "vertical" | "horizontal"
  visibility?: string  // "visible" | "gone" | "invisible"
  enabled?: boolean
  checked?: boolean
  inputType?: string
  src?: string
  contentDescription?: string
  layoutWeight?: string
  minWidth?: string
  minHeight?: string
  elevation?: string
  cardCornerRadius?: string
  max?: string  // ProgressBar
  progress?: string
  indeterminate?: boolean
}

/** Maps XML tag name → ViewType (strips Android package prefixes). */
function normalizeType(tag: string): ViewType {
  // Strip package prefix: "androidx.appcompat.widget.AppCompatButton" → "Button"
  const parts = tag.split('.')
  const simpleName = parts[parts.length - 1]
  // Common mappings
  const map: Record<string, ViewType> = {
    'AppCompatTextView': 'TextView',
    'AppCompatButton': 'Button',
    'AppCompatEditText': 'EditText',
    'AppCompatImageView': 'ImageView',
    'AppCompatCheckBox': 'CheckBox',
    'SwitchCompat': 'Switch',
    'LinearLayoutCompat': 'LinearLayout',
    'MaterialCardView': 'CardView',
    'NestedScrollView': 'ScrollView',
  }
  return map[simpleName] || simpleName
}

/** Extracts the short ID from android:id="@+id/counterText" → "counterText". */
function extractId(rawId: string | null): string | undefined {
  if (!rawId) return undefined
  // @+id/xxx or @id/xxx → xxx
  const match = rawId.match(/^@\+?id\/(.+)$/)
  return match ? match[1] : undefined
}

/** Parses an XML attribute value, resolving @string/ and @color/ references. */
function resolveValue(value: string | null, resources: ResourceTable): string | undefined {
  if (!value) return undefined
  if (value.startsWith('@string/')) {
    const name = value.slice('@string/'.length)
    return resources.strings[name] || value
  }
  if (value.startsWith('@color/')) {
    const name = value.slice('@color/'.length)
    return resources.colors[name] || value
  }
  // Unescape Android string entities
  return value
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
}

export interface ResourceTable {
  strings: Record<string, string>
  colors: Record<string, string>
}

/** Parses a DOM Element into a UIElement AST node. */
function parseElement(el: Element, resources: ResourceTable): UIElement {
  const type = normalizeType(el.tagName)
  const id = extractId(el.getAttribute('android:id'))

  const get = (name: string): string | undefined => resolveValue(el.getAttribute(name), resources)

  const attrs: ViewAttributes = {}
  const text = get('android:text')
  if (text !== undefined) attrs.text = text
  const hint = get('android:hint')
  if (hint !== undefined) attrs.hint = hint
  const textSize = get('android:textSize')
  if (textSize !== undefined) attrs.textSize = textSize
  const textColor = get('android:textColor')
  if (textColor !== undefined) attrs.textColor = textColor
  const textStyle = el.getAttribute('android:textStyle')
  if (textStyle) attrs.textStyle = textStyle
  const bg = get('android:background')
  if (bg !== undefined) attrs.background = bg
  const padding = el.getAttribute('android:padding')
  if (padding) attrs.padding = padding
  const pL = el.getAttribute('android:paddingLeft'); if (pL) attrs.paddingLeft = pL
  const pR = el.getAttribute('android:paddingRight'); if (pR) attrs.paddingRight = pR
  const pT = el.getAttribute('android:paddingTop'); if (pT) attrs.paddingTop = pT
  const pB = el.getAttribute('android:paddingBottom'); if (pB) attrs.paddingBottom = pB
  const lw = el.getAttribute('android:layout_width'); if (lw) attrs.layoutWidth = lw
  const lh = el.getAttribute('android:layout_height'); if (lh) attrs.layoutHeight = lh
  const margin = el.getAttribute('android:layout_margin'); if (margin) attrs.layoutMargin = margin
  const mL = el.getAttribute('android:layout_marginLeft'); if (mL) attrs.layoutMarginLeft = mL
  const mR = el.getAttribute('android:layout_marginRight'); if (mR) attrs.layoutMarginRight = mR
  const mT = el.getAttribute('android:layout_marginTop'); if (mT) attrs.layoutMarginTop = mT
  const mB = el.getAttribute('android:layout_marginBottom'); if (mB) attrs.layoutMarginBottom = mB
  const gravity = el.getAttribute('android:gravity'); if (gravity) attrs.gravity = gravity
  const layoutGravity = el.getAttribute('android:layout_gravity'); if (layoutGravity) attrs.layoutGravity = layoutGravity
  const orientation = el.getAttribute('android:orientation'); if (orientation) attrs.orientation = orientation
  const visibility = el.getAttribute('android:visibility'); if (visibility) attrs.visibility = visibility
  const enabled = el.getAttribute('android:enabled'); if (enabled !== null) attrs.enabled = enabled !== 'false'
  const checked = el.getAttribute('android:checked'); if (checked !== null) attrs.checked = checked === 'true'
  const inputType = el.getAttribute('android:inputType'); if (inputType) attrs.inputType = inputType
  const src = get('android:src') || get('app:srcCompat'); if (src !== undefined) attrs.src = src
  const cd = el.getAttribute('android:contentDescription'); if (cd) attrs.contentDescription = cd
  const weight = el.getAttribute('android:layout_weight'); if (weight) attrs.layoutWeight = weight
  const minW = el.getAttribute('android:minWidth'); if (minW) attrs.minWidth = minW
  const minH = el.getAttribute('android:minHeight'); if (minH) attrs.minHeight = minH
  const elev = el.getAttribute('android:elevation'); if (elev) attrs.elevation = elev
  const cr = el.getAttribute('app:cardCornerRadius') || el.getAttribute('android:cardCornerRadius'); if (cr) attrs.cardCornerRadius = cr
  const max = el.getAttribute('android:max'); if (max) attrs.max = max
  const progress = el.getAttribute('android:progress'); if (progress) attrs.progress = progress
  const indet = el.getAttribute('android:indeterminate'); if (indet !== null) attrs.indeterminate = indet === 'true'

  const children = Array.from(el.children)
    .filter(c => c.tagName !== '?xml' && !c.tagName.startsWith('#'))
    .map(c => parseElement(c, resources))

  return { type, id, attrs, children }
}

/** Main entry: parse XML string + resources into a UIElement AST. */
export function parseLayoutXml(xml: string, resources: ResourceTable): { ast: UIElement | null; error: string | null } {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      return { ast: null, error: `XML parse error: ${parserError.textContent?.slice(0, 300)}` }
    }
    const root = doc.documentElement
    if (!root) return { ast: null, error: 'Empty XML document' }
    return { ast: parseElement(root, resources), error: null }
  } catch (e) {
    return { ast: null, error: `Failed to parse XML: ${(e as Error).message}` }
  }
}

/** Extracts resource tables from strings.xml and colors.xml content. */
export function parseResources(files: Record<string, string>): ResourceTable {
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
  return rt
}

/** Convert dp/sp to px (1:1 approximation for web). */
export function parseDimension(dim: string): string {
  if (!dim) return '0'
  return dim.replace(/dp$/i, 'px').replace(/sp$/i, 'px').replace(/dip$/i, 'px')
}

/** Resolve a color value: @color/ → hex, #RGB → #RRGGBB, #ARGB → #RGBA. */
export function resolveColor(value: string, colors: Record<string, string>): string {
  if (!value) return ''
  if (value.startsWith('@color/')) {
    const name = value.slice('@color/'.length)
    return colors[name] || '#000000'
  }
  if (value.startsWith('#')) {
    if (value.length === 4) {
      const r = value[1], g = value[2], b = value[3]
      return `#${r}${r}${g}${g}${b}${b}`
    }
    if (value.length === 9) {
      // #AARRGGBB → #RRGGBBAA (Android ARGB → CSS RGBA)
      const a = value.slice(1, 3), r = value.slice(3, 5), g = value.slice(5, 7), b = value.slice(7, 9)
      return `#${r}${g}${b}${a}`
    }
    return value
  }
  return value
}
