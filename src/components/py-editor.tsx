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
import { r } from '@codemirror/legacy-modes/mode/r'
import { oneDark } from '@codemirror/theme-one-dark'

interface PyEditorProps {
  value: string
  onChange: (val: string) => void
  onRun?: () => void
  theme?: 'light' | 'dark'
  readOnly?: boolean
  language?: 'python' | 'java' | 'c' | 'cpp' | 'r' | 'javascript'
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
      language === 'c' || language === 'cpp' ? cpp() :
      language === 'r' ? StreamLanguage.define(r) :
      language === 'javascript' ? javascript() :
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
