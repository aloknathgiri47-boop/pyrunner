/**
 * Kotlin Transpiler — converts a SUBSET of Android Kotlin code into browser JavaScript.
 *
 * Supported patterns:
 *   val x = findViewById<Button>(R.id.xxx)     → const x = document.getElementById('xxx')
 *   x.text = "hello"                            → x.textContent = "hello"
 *   x.text = someVar                           → x.textContent = someVar
 *   x.text.toString()                           → x.value  (for EditText)
 *   x.setOnClickListener { ... }               → x.addEventListener('click', () => { ... })
 *   x.isEnabled = false                         → x.disabled = true
 *   x.visibility = View.VISIBLE                 → x.style.display = ''
 *   x.visibility = View.GONE                    → x.style.display = 'none'
 *   x.visibility = View.INVISIBLE               → x.style.visibility = 'hidden'
 *   Toast.makeText(this, "msg", ...).show()     → showToast("msg")
 *   if (condition) { ... }                      → if (condition) { ... }
 *
 * Unsupported APIs produce clear errors.
 */

export interface TranspileResult {
  js: string
  errors: string[]
  warnings: string[]
}

// Known supported APIs
const SUPPORTED_APIS = [
  'findViewById',
  'setOnClickListener',
  'setOnCheckedChangeListener',
  'text',
  'isEnabled',
  'visibility',
  'View.VISIBLE',
  'View.GONE',
  'View.INVISIBLE',
  'Toast.makeText',
  'Toast.LENGTH_SHORT',
  'Toast.LENGTH_LONG',
  'View',
  'R.id',
]

// APIs that are explicitly NOT supported
const UNSUPPORTED_APIS: Record<string, string> = {
  'Intent': 'Intent (use click listeners instead)',
  'startActivity': 'startActivity (not supported in web preview)',
  'finish': 'finish (not supported in web preview)',
  'SharedPreferences': 'SharedPreferences (not supported in web preview)',
  'RoomDatabase': 'Room (not supported in web preview)',
  'ViewModel': 'ViewModel (not supported in web preview)',
  'LiveData': 'LiveData (not supported in web preview)',
  'Coroutine': 'Coroutines (not supported in web preview)',
  'launch': 'Coroutine launch (not supported in web preview)',
  'async': 'Coroutine async (not supported in web preview)',
  'Handler': 'Handler (not supported in web preview)',
  'Looper': 'Looper (not supported in web preview)',
  'Fragment': 'Fragment (not supported in web preview)',
  'FragmentManager': 'FragmentManager (not supported in web preview)',
  'Navigation': 'Navigation component (not supported in web preview)',
  'WorkManager': 'WorkManager (not supported in web preview)',
  'Service': 'Service (not supported in web preview)',
  'BroadcastReceiver': 'BroadcastReceiver (not supported in web preview)',
  'ContentProvider': 'ContentProvider (not supported in web preview)',
  'Cursor': 'Cursor/database (not supported in web preview)',
  'SQLiteDatabase': 'SQLite (not supported in web preview)',
  'HttpURLConnection': 'HTTP networking (not supported in web preview)',
  'OkHttpClient': 'OkHttp networking (not supported in web preview)',
  'Retrofit': 'Retrofit networking (not supported in web preview)',
  'Glide': 'Glide image loading (not supported in web preview)',
  'Picasso': 'Picasso image loading (not supported in web preview)',
  'Coil': 'Coil image loading (not supported in web preview)',
}

function checkUnsupported(code: string, errors: string[], lines: string[]): void {
  for (const [api, message] of Object.entries(UNSUPPORTED_APIS)) {
    const regex = new RegExp(`\\b${api.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    const lineIdx = lines.findIndex(l => regex.test(l))
    if (lineIdx >= 0) {
      errors.push(`Line ${lineIdx + 1}: Unsupported API: ${message}`)
    }
  }
}

export function transpileKotlin(kotlinCode: string): TranspileResult {
  const errors: string[] = []
  const warnings: string[] = []
  const jsLines: string[] = []

  // Remove package and import lines (they're for Android, not JS)
  const lines = kotlinCode.split('\n')
  const codeLines = lines.filter(l => {
    const trimmed = l.trim()
    if (trimmed.startsWith('package ')) return false
    if (trimmed.startsWith('import ')) return false
    return true
  })

  // Check for unsupported APIs first
  checkUnsupported(kotlinCode, errors, lines)
  if (errors.length > 0) {
    return { js: '', errors, warnings }
  }

  // Find the onCreate or main body
  // We transpile everything inside onCreate's body, or the main() body
  let inOnCreate = false
  let braceDepth = 0
  let foundOnCreate = false

  for (let i = 0; i < codeLines.length; i++) {
    let line = codeLines[i]
    const originalLine = line
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('//')) {
      jsLines.push(line)
      continue
    }

    // Skip class declarations and braces
    if (trimmed.startsWith('class ')) {
      jsLines.push(`// ${trimmed}`)
      continue
    }

    // Detect onCreate
    if (trimmed.includes('override fun onCreate') || trimmed.includes('fun onCreate')) {
      inOnCreate = true
      foundOnCreate = true
      continue
    }

    // Detect main function
    if (trimmed.match(/^fun\s+main\s*\(/)) {
      inOnCreate = true
      foundOnCreate = true
      continue
    }

    // Skip setContentView
    if (trimmed.includes('setContentView')) {
      jsLines.push(`// setContentView (layout is auto-loaded)`)
      continue
    }

    // Skip super.onCreate
    if (trimmed.includes('super.onCreate') || trimmed.includes('super.')) {
      continue
    }

    // Skip class-level property declarations (lateinit var, private var, etc.)
    if (trimmed.match(/^(private |public |internal |protected )?(lateinit )?(var|val)\s+/) && !inOnCreate) {
      jsLines.push(`// ${trimmed} (class property)`)
      continue
    }

    // Track braces
    const openBraces = (line.match(/{/g) || []).length
    const closeBraces = (line.match(/}/g) || []).length

    if (inOnCreate || braceDepth === 0) {
      // Transpile the line
      const transpiled = transpileLine(line, errors, i + 1)
      jsLines.push(transpiled)
    }

    braceDepth += openBraces - closeBraces
    if (braceDepth <= 0 && inOnCreate) {
      inOnCreate = false
    }
  }

  if (!foundOnCreate && errors.length === 0) {
    // If no onCreate found, transpile all lines directly
    const result = transpileKotlinDirect(kotlinCode, errors)
    return { js: result, errors, warnings }
  }

  return { js: jsLines.join('\n'), errors, warnings }
}

function transpileLine(line: string, errors: string[], lineNum: number): string {
  let result = line

  // findViewById<Button>(R.id.xxx) → document.getElementById('xxx')
  result = result.replace(
    /(\w+)\s*=\s*findViewById<\w+>\s*\(\s*R\.id\.(\w+)\s*\)/g,
    "$1 = document.getElementById('$2')"
  )
  // Also handle: val button = findViewById<Button>(R.id.button)
  result = result.replace(
    /(?:val|var)\s+(\w+)\s*=\s*findViewById<\w+>\s*\(\s*R\.id\.(\w+)\s*\)/g,
    "const $1 = document.getElementById('$2')"
  )

  // .text.toString() → .value (for EditText inputs)
  result = result.replace(/(\w+)\.text\.toString\(\)/g, '$1.value')

  // .text = "something" → .textContent = "something"
  // But NOT .text.toString() (already handled above)
  result = result.replace(/(\w+)\.text\s*=\s*(?!toString)/g, '$1.textContent = ')

  // .isEnabled = true/false → .disabled = false/true
  result = result.replace(
    /(\w+)\.isEnabled\s*=\s*(true|false)/g,
    (_, varName, val) => `${varName}.disabled = ${val === 'true' ? 'false' : 'true'}`
  )

  // .visibility = View.VISIBLE → .style.display = ''
  result = result.replace(/(\w+)\.visibility\s*=\s*View\.VISIBLE/g, "$1.style.display = ''")
  // .visibility = View.GONE → .style.display = 'none'
  result = result.replace(/(\w+)\.visibility\s*=\s*View\.GONE/g, "$1.style.display = 'none'")
  // .visibility = View.INVISIBLE → .style.visibility = 'hidden'
  result = result.replace(/(\w+)\.visibility\s*=\s*View\.INVISIBLE/g, "$1.style.visibility = 'hidden'")

  // Toast.makeText(this, "msg", Toast.LENGTH_SHORT).show() → showToast("msg")
  result = result.replace(
    /Toast\.makeText\s*\(\s*(?:this|context)\s*,\s*([^,]+)\s*,\s*Toast\.LENGTH_\w+\s*\)\.show\s*\(\s*\)/g,
    'showToast($1)'
  )

  // .setOnClickListener { ... } → .addEventListener('click', () => { ... })
  // This is tricky because the body can span multiple lines
  // We handle single-line listeners here; multi-line ones are handled by the brace tracking
  result = result.replace(
    /(\w+)\.setOnClickListener\s*\{/g,
    "$1.addEventListener('click', () => {"
  )

  // .setOnCheckedChangeListener { _, isChecked -> ... } → .addEventListener('change', (e) => { const isChecked = e.target.checked; ... })
  result = result.replace(
    /(\w+)\.setOnCheckedChangeListener\s*\{\s*([^,]+),\s*(\w+)\s*->/g,
    "$1.addEventListener('change', (e) => { const $3 = e.target.checked;"
  )

  // Kotlin string templates: "Hello $name" → `Hello ${name}`
  // Only for strings in quotes (not for assignments that were already transpiled)
  result = result.replace(/"([^"]*\$[^"]*)"/g, (match, content) => {
    // Replace $variable with ${variable} inside the string
    const jsContent = content.replace(/\$(\w+)/g, '${$1}')
    return '`' + jsContent + '`'
  })

  // val/var → const/let
  result = result.replace(/\bval\b/g, 'const')
  result = result.replace(/\bvar\b/g, 'let')

  // true/false stay the same
  // null stays the same

  return result
}

/** Direct transpilation for code without onCreate (e.g., simple scripts). */
function transpileKotlinDirect(code: string, errors: string[]): string {
  const lines = code.split('\n')
  const jsLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('package ') || line.trim().startsWith('import ')) {
      continue
    }
    jsLines.push(transpileLine(line, errors, i + 1))
  }

  return jsLines.join('\n')
}
