'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import CodeMirror, {
  EditorView,
  type Extension,
} from '@uiw/react-codemirror'
import { StreamLanguage } from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { javascript } from '@codemirror/lang-javascript'
import { php as phpLang } from '@codemirror/lang-php'
import { html as htmlLang } from '@codemirror/lang-html'
import { sql as sqlLang } from '@codemirror/lang-sql'
import { xml as xmlLang } from '@codemirror/lang-xml'
import { rust as rustLang } from '@codemirror/lang-rust'
import { r } from '@codemirror/legacy-modes/mode/r'
import { ruby as rubyLang } from '@codemirror/legacy-modes/mode/ruby'
import { go } from '@codemirror/legacy-modes/mode/go'
import { clike } from '@codemirror/legacy-modes/mode/clike'
import { oneDark } from '@codemirror/theme-one-dark'

interface PyEditorProps {
  value: string
  onChange: (val: string) => void
  onRun?: () => void
  theme?: 'light' | 'dark'
  readOnly?: boolean
  language?: 'python' | 'java' | 'c' | 'cpp' | 'r' | 'javascript' | 'php' | 'csharp' | 'dart' | 'flutter' | 'html' | 'sql' | 'kotlin' | 'kotlin-android' | 'xml' | 'go' | 'typescript' | 'rust' | 'ruby'
}

// Dart keywords for syntax highlighting via clike mode
const dartKeywords = {
  'abstract': true, 'as': true, 'assert': true, 'async': true, 'await': true,
  'break': true, 'case': true, 'catch': true, 'class': true, 'const': true,
  'continue': true, 'default': true, 'deferred': true, 'do': true, 'dynamic': true,
  'else': true, 'enum': true, 'export': true, 'extends': true, 'extension': true,
  'external': true, 'factory': true, 'false': true, 'final': true, 'finally': true,
  'for': true, 'Function': true, 'get': true, 'hide': true, 'if': true,
  'implements': true, 'import': true, 'in': true, 'interface': true, 'is': true,
  'library': true, 'mixin': true, 'new': true, 'null': true, 'on': true,
  'operator': true, 'part': true, 'rethrow': true, 'return': true, 'set': true,
  'show': true, 'static': true, 'super': true, 'switch': true, 'sync': true,
  'this': true, 'throw': true, 'true': true, 'try': true, 'typedef': true,
  'var': true, 'void': true, 'while': true, 'with': true, 'yield': true,
  'print': true, 'main': true, 'int': true, 'double': true, 'String': true,
  'bool': true, 'List': true, 'Map': true, 'Set': true, 'Future': true,
  'Stream': true, 'stdout': true, 'stdin': true,
}

// Kotlin keywords for syntax highlighting via clike mode
const kotlinKeywords = {
  'as': true, 'by': true, 'class': true, 'data': true, 'do': true, 'else': true,
  'false': true, 'for': true, 'fun': true, 'if': true, 'in': true, 'is': true,
  'null': true, 'object': true, 'package': true, 'return': true, 'super': true,
  'this': true, 'throw': true, 'true': true, 'try': true, 'typealias': true,
  'val': true, 'var': true, 'when': true, 'while': true, 'break': true,
  'continue': true, 'import': true, 'interface': true, 'enum': true, 'sealed': true,
  'annotation': true, 'companion': true, 'abstract': true, 'final': true, 'open': true,
  'override': true, 'private': true, 'public': true, 'protected': true, 'internal': true,
  'suspend': true, 'inline': true, 'reified': true, 'operator': true, 'infix': true,
  'tailrec': true, 'external': true, 'lateinit': true, 'init': true, 'constructor': true,
  'out': true, 'vararg': true, 'get': true, 'set': true, 'field': true, 'it': true,
  'String': true, 'Int': true, 'Long': true, 'Short': true, 'Byte': true,
  'Double': true, 'Float': true, 'Boolean': true, 'Char': true, 'Unit': true,
  'Any': true, 'Nothing': true, 'List': true, 'Map': true, 'Set': true, 'Array': true,
  'MutableList': true, 'MutableMap': true, 'MutableSet': true, 'Pair': true,
  'Triple': true, 'Result': true, 'println': true, 'print': true, 'main': true,
}

const customLightTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#ffffff',
      color: '#0f172a',
      fontSize: '14px',
      height: '100%',
    },
    '.cm-gutters': {
      backgroundColor: '#fafafa',
      color: '#94a3b8',
      border: 'none',
      borderRight: '1px solid #e2e8f0',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#f1f5f9',
      color: '#475569',
    },
    '.cm-activeLine': {
      backgroundColor: '#f8fafc',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-content': {
      fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
      padding: '12px 0',
    },
    '.cm-cursor': {
      borderLeftColor: '#0f172a',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: '#dbeafe !important',
    },
  },
  { dark: false },
)

const customDarkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#0f1117',
      color: '#e5e7eb',
      fontSize: '14px',
      height: '100%',
    },
    '.cm-gutters': {
      backgroundColor: '#0a0b10',
      color: '#4b5563',
      border: 'none',
      borderRight: '1px solid #1f2937',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#16181f',
      color: '#9ca3af',
    },
    '.cm-activeLine': {
      backgroundColor: '#16181f',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-content': {
      fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
      padding: '12px 0',
    },
    '.cm-cursor': {
      borderLeftColor: '#e5e7eb',
    },
  },
  { dark: true },
)

export default function PyEditor({
  value,
  onChange,
  onRun,
  theme = 'dark',
  readOnly = false,
  language = 'python',
}: PyEditorProps) {
  const runRef = useRef(onRun)
  useEffect(() => {
    runRef.current = onRun
  }, [onRun])

  const extensions = useMemo<Extension[]>(() => {
    // For C and C++ we use the cpp() extension.
    // For R we use the legacy StreamLanguage mode.
    // For JavaScript we use javascript() (supports both CommonJS and ESM).
    const langExt =
      language === 'java' ? java() :
      language === 'c' || language === 'cpp' || language === 'csharp' ? cpp() :
      language === 'r' ? StreamLanguage.define(r) :
      language === 'javascript' ? javascript() :
      language === 'php' ? phpLang() :
      language === 'dart' || language === 'flutter' ? StreamLanguage.define(clike({ keywords: dartKeywords })) :
      language === 'html' ? htmlLang() :
      language === 'sql' ? sqlLang() :
      language === 'go' ? StreamLanguage.define(go) :
      language === 'typescript' ? javascript({ typescript: true }) :
      language === 'rust' ? rustLang() :
      language === 'ruby' ? StreamLanguage.define(rubyLang) :
      language === 'kotlin' || language === 'kotlin-android' ? StreamLanguage.define(clike({ keywords: kotlinKeywords })) :
      language === 'xml' ? xmlLang() :
      python()
    const exts: Extension[] = [
      langExt,
      EditorView.lineWrapping,
      EditorView.editable.of(!readOnly),
      EditorView.theme({
        '.cm-scroller': {
          fontFamily:
            'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
        },
      }),
    ]
    return exts
  }, [readOnly, language])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl/Cmd+Enter triggers Run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      runRef.current?.()
    }
  }, [])

  // Attach a window-level listener so the shortcut works even when the editor
  // itself doesn't have focus but the page does.
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const baseTheme = theme === 'dark' ? oneDark : 'light'
  const customTheme = theme === 'dark' ? customDarkTheme : customLightTheme

  return (
    <div className="h-full w-full overflow-hidden">
      <CodeMirror
        value={value}
        height="100%"
        theme={baseTheme}
        extensions={[...extensions, customTheme]}
        onChange={onChange}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: true,
          tabSize: 4,
        }}
        style={{ height: '100%' }}
        className="h-full text-sm"
      />
    </div>
  )
}
