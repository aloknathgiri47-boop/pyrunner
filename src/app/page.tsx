'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Play,
  Square,
  Trash2,
  Download,
  Copy,
  Check,
  Sun,
  Moon,
  FileCode2,
  Terminal,
  ChevronDown,
  Loader2,
  CircleAlert,
  CircleCheck,
  Clock,
  Hash,
  Keyboard,
  Share2,
  Eraser,
  CornerDownLeft,
  PanelLeft,
  Save,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
} from 'lucide-react'

import PyEditor from '@/components/py-editor'
import FileExplorer from '@/components/file-explorer'
import QuickSwitcher from '@/components/quick-switcher'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { EXAMPLES, type Snippet } from '@/lib/examples'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useProjectStore,
  useActiveFile,
  getFilesForRunner,
  getEntryFilePath,
} from '@/lib/project-store'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface OutputChunk {
  id: number
  stream: 'stdout' | 'stderr' | 'input' | 'system' | 'image' | 'server'
  text: string
  // For input chunks: did the user enter this? For output chunks: was the
  // server hint that this looks like an input prompt?
  isPrompt?: boolean
  // For image chunks: data URL (data:image/png;base64,...)
  src?: string
  // For server chunks: the port the server is listening on
  port?: number
}

interface RunResult {
  code: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  durationMs: number
  error?: string
}

const STORAGE_KEY = 'pyrunner:state:v3'

type Language = 'python' | 'java' | 'c' | 'cpp' | 'r' | 'javascript' | 'php' | 'csharp' | 'dart' | 'flutter' | 'html' | 'sql' | 'kotlin' | 'go' | 'typescript' | 'rust' | 'ruby' | 'swift' | 'lua' | 'perl' | 'powershell' | 'bash' | 'fortran' | 'cobol'

interface PersistedState {
  code: string
  language: Language
}

import { DEFAULT_CODE } from '@/lib/default-code'



/* ------------------------------------------------------------------ */
/* Persistence helpers                                                 */
/* ------------------------------------------------------------------ */

function loadState(): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (typeof parsed.code !== 'string') return null
    return {
      code: parsed.code,
      language: ['java','c','cpp','r','javascript','php','csharp','dart','flutter','html','sql','kotlin','go','typescript','rust','ruby','swift','lua','perl','powershell','bash','fortran','cobol'].includes(parsed.language) ? parsed.language : 'python',
    }
  } catch {
    return null
  }
}

function encodeToHash(code: string, language: Language): string {
  const encode = (s: string) => {
    const bytes = new TextEncoder().encode(s)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  const params = new URLSearchParams()
  params.set('c', encode(code))
  params.set('l', language)
  return `#${params.toString()}`
}

/**
 * Decode a URL hash (e.g. "#c=...&l=python") back into { code, language }.
 * Returns null if the hash is empty or malformed.
 *
 * Used both at initial mount (in getInitialState) and on browser Back/Forward
 * navigation (popstate), so refreshing the page or using the browser's
 * history buttons restores the exact code+language that was shared.
 */
function decodeFromHash(hash: string): { code: string; language: Language } | null {
  if (!hash || hash.length < 2) return null
  try {
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
    const codeB64 = params.get('c')
    const lang = params.get('l') ?? ''
    if (!codeB64) return null
    const decode = (s: string) => {
      const padded = s.replace(/-/g, '+').replace(/_/g, '/')
      const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
      const bin = atob(padded + pad)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return new TextDecoder('utf-8').decode(bytes)
    }
    return {
      code: decode(codeB64),
      language: (['java','c','cpp','r','javascript','php','csharp','dart','flutter','html','sql','kotlin','go','typescript','rust','ruby','swift','lua','perl','powershell','bash','fortran','cobol'].includes(lang) ? lang : 'python') as Language,
    }
  } catch {
    return null
  }
}

/**
 * Push a new browser history entry encoding the given code+language.
 *
 * This is what makes the browser's native Back/Forward buttons work:
 * each meaningful state transition (load example, switch language, share)
 * pushes a new entry, so the user can press Back to undo the last action.
 *
 * We use pushState (NOT replaceState) so the previous state stays on the
 * history stack. The popstate listener in the main component restores
 * the code+language when the user navigates with Back/Forward.
 *
 * No-op if the new hash equals the current hash, to avoid spurious
 * duplicate entries.
 */
function pushHistoryState(code: string, language: Language) {
  if (typeof window === 'undefined') return
  const newHash = encodeToHash(code, language)
  if (window.location.hash === newHash) return
  const newUrl = `${window.location.pathname}${window.location.search}${newHash}`
  window.history.pushState({ code, language }, '', newUrl)
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

function getInitialState(): { code: string; language: Language } {
  if (typeof window === 'undefined') return { code: DEFAULT_CODE, language: 'python' }
  // URL hash takes priority, then localStorage, then default.
  const fromHash = decodeFromHash(window.location.hash)
  if (fromHash) return fromHash
  const persisted = loadState()
  if (persisted) {
    return { code: persisted.code, language: persisted.language }
  }
  return { code: DEFAULT_CODE, language: 'python' }
}

export default function Home() {
  const { setTheme, resolvedTheme } = useTheme()

  // ---- Multi-file project store (replaces single-file useState) ----
  // The active file's content is the source of truth for the editor.
  // `code` and `language` are derived from it so all existing handlers
  // (handleRun, handleShare, handleDownload, etc.) keep working unchanged.
  const activeFile = useActiveFile()
  const selectedLanguage = useProjectStore((s) => s.selectedLanguage)
  const projectHydrated = useProjectStore((s) => s.hydrated)
  const setActiveFileContent = useProjectStore((s) => s.setActiveFileContent)
  const markActiveFileSaved = useProjectStore((s) => s.markActiveFileSaved)
  const entryFilePath = useProjectStore((s) => {
    const p = s.projects[s.selectedLanguage]
    if (!p.entryFileId) return null
    const n = p.nodes[p.entryFileId]
    return n && n.type === 'file' ? n.name : null
  })
  const isProjectDirty = useProjectStore((s) => {
    const p = s.projects[s.selectedLanguage]
    return Object.values(p.nodes).some(
      (n) => n.type === 'file' && n.content !== n.savedContent,
    )
  })

  // Use defaults on both server AND the first client render so the markup
  // matches exactly. After mount, we hydrate from IndexedDB / URL hash.
  // This is the canonical Next.js pattern for avoiding hydration mismatches
  // when initial state depends on browser-only APIs.
  const [code, setCode] = useState<string>(DEFAULT_CODE)
  const [language, setLanguage] = useState<Language>('python')
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null)

  // Sync derived `code` + `language` from the active file whenever it changes.
  // We do this in an effect (not directly during render) to avoid React
  // "cannot update a component while rendering a different component" warnings.
  // Also fires when `selectedLanguage` changes so that switching language tabs
  // immediately updates the editor to show the new language's active file.
  useEffect(() => {
    if (!projectHydrated) return
    if (activeFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode(activeFile.content)
      setLanguage(activeFile.language)
    } else {
      setCode('')
      setLanguage(selectedLanguage)
    }
  }, [activeFile?.id, activeFile?.content, activeFile?.language, projectHydrated, selectedLanguage])

  // Wrap setCode so it writes to the active file's content in the store,
  // while still updating local `code` state for immediate re-render.
  const setCodeWrapped = useCallback((newCode: string) => {
    setCode(newCode)
    setActiveFileContent(newCode)
  }, [setActiveFileContent])

  const [chunks, setChunks] = useState<OutputChunk[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [awaitingInput, setAwaitingInput] = useState(false)
  const [stdinText, setStdinText] = useState('')
  const [showStdin, setShowStdin] = useState(false)
  const [flutterPort, setFlutterPort] = useState<number | null>(null)
  // Hydration flag: false during SSR and the very first client render,
  // true after mount. Used to gate rendering of any client-only UI
  // (like theme-dependent icons or persisted state).
  const [hydrated, setHydrated] = useState(false)

  // After mount: hydrate React state from URL hash (share-link mode).
  // Multi-file project state is hydrated by the project store (IndexedDB)
  // via Zustand's persist middleware — we don't touch that here.
  //
  // URL hash takes priority: if `#c=...&l=...` is present, we load that
  // snippet into the active file so share links continue to work.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true)
    // If a share-link hash is present, switch to the shared snippet's
    // language project and load the snippet into the active file.
    const fromHash = decodeFromHash(window.location.hash)
    if (fromHash && projectHydrated) {
      const state = useProjectStore.getState()
      // Switch to the shared snippet's language project first.
      state.setSelectedLanguage(fromHash.language)
      // Now load the snippet into the active file of that language's project.
      const proj = state.projects[fromHash.language]
      const activeId = proj.activeFileId
      if (activeId) {
        const n = proj.nodes[activeId]
        if (n && n.type === 'file') {
          // Overwrite the active file's content with the shared snippet.
          state.setActiveFileContent(fromHash.code)
        }
      } else {
        // No active file — create one for the shared snippet.
        state.createFile({
          content: fromHash.code,
          language: fromHash.language,
          makeActive: true,
          makeEntry: true,
        })
      }
    }
  }, [projectHydrated])

  const socketRef = useRef<Socket | null>(null)
  const chunkIdRef = useRef(0)
  const consoleEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const isRunningRef = useRef(false)
  const languageRef = useRef<Language>(language)
  // True while we are restoring state from a popstate event (browser Back/Forward).
  // Prevents the debounced localStorage-persistence effect from pushing a
  // duplicate history entry — we only push entries on explicit user actions
  // (Share, Load example, Switch language).
  const isRestoringFromHistoryRef = useRef(false)

  // Keep languageRef in sync so the socket callbacks can read the current value
  useEffect(() => {
    languageRef.current = language
  }, [language])

  // ---- Browser Back/Forward support (popstate) ----
  // When the user presses the browser's Back or Forward button, the URL
  // hash changes and we restore the { code, language } encoded there.
  // We do NOT push a new history entry here (that would create a loop);
  // we only sync React state from the URL.
  useEffect(() => {
    const onPopState = () => {
      isRestoringFromHistoryRef.current = true
      const fromHash = decodeFromHash(window.location.hash)
      if (fromHash) {
        // Switch to the shared snippet's language project, then load the
        // snippet into the active file.
        const state = useProjectStore.getState()
        state.setSelectedLanguage(fromHash.language)
        state.setActiveFileContent(fromHash.code)
        setLanguage(fromHash.language)
      } else {
        // No hash → restore to the default Python project.
        useProjectStore.getState().setSelectedLanguage('python')
        setLanguage('python')
      }
      // Clear console output so the previous run's output doesn't linger.
      setChunks([])
      setResult(null)
      setActiveExampleId(null)
      // Reset the flag on the next tick so the debounced localStorage save
      // runs normally.
      setTimeout(() => { isRestoringFromHistoryRef.current = false }, 0)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [setCodeWrapped])

  // Legacy localStorage persistence is now replaced by the Zustand project
  // store + IndexedDB (see src/lib/project-store.ts). The store handles
  // debouncing internally and supports multi-file projects, which the old
  // `{ code, language }` JSON couldn't represent.

  // ---- WebSocket connection (lazy: only connect when running) ----
  const ensureSocket = useCallback((): Socket => {
    if (socketRef.current) return socketRef.current
    // Use polling+websocket transports so the XTransformPort query parameter
    // is preserved during the initial HTTP handshake (websocket-only skips
    // the polling handshake and the query gets dropped by the gateway).
    // Enable reconnection so if the runner restarts (watchdog auto-restart),
    // the client automatically reconnects without showing "xhr poll error".
    // When deployed on Vercel, connect to the Render runner URL directly.
    // When running locally (dev), use the gateway proxy.
    const runnerUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? 'https://codehubz-runner.onrender.com'
      : undefined
    const sock = io(runnerUrl ?? '/?XTransformPort=3003', {
      transports: ['polling', 'websocket'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10_000,
    })

    sock.on('connect', () => {
      /* ready */
    })

    sock.on('connect_error', (err: { message: string }) => {
      // Only show the error toast if we're actively trying to run code.
      // During reconnection attempts, socket.io fires many of these
      // and we don't want to spam the user.
      if (!isRunningRef.current) return
      toast.error('Cannot connect to runner', {
        description: err.message || 'WebSocket connection failed',
      })
      setIsRunning(false)
      isRunningRef.current = false
    })

    sock.on('started', () => {
      // Server has spawned the python process
      setAwaitingInput(false)
    })

    sock.on('output', (msg: { stream: string; data: string; promptLike?: boolean }) => {
      const stream = msg.stream === 'stderr' ? 'stderr' : 'stdout'
      const id = ++chunkIdRef.current
      setChunks((prev) => [
        ...prev,
        { id, stream, text: msg.data, isPrompt: msg.promptLike },
      ])
      // If the server hints this looks like an input prompt (no trailing newline),
      // focus the input bar.
      if (msg.promptLike) {
        setAwaitingInput(true)
        setTimeout(() => inputRef.current?.focus(), 30)
      } else if (stream === 'stdout') {
        // A newline ended, so the prompt is resolved.
        setAwaitingInput(false)
      }
    })

    sock.on('image', (msg: { data: string; mime?: string }) => {
      // Inline image (matplotlib figure rendered as PNG). The runner already
      // base64-encoded the bytes — we wrap it as a data URL for <img src>.
      const mime = msg.mime ?? 'image/png'
      const src = `data:${mime};base64,${msg.data}`
      const id = ++chunkIdRef.current
      setChunks((prev) => [
        ...prev,
        { id, stream: 'image', text: '', src },
      ])
    })

    sock.on('server', (msg: { port: number; host?: string }) => {
      if (languageRef.current === 'flutter' || languageRef.current === 'html') {
        // Set the port — this immediately renders the live iframe preview.
        setFlutterPort(msg.port)
        toast.success(languageRef.current === 'flutter' ? 'Flutter app is live!' : 'HTML preview is live!', {
          description: `Preview loaded in panel (port ${msg.port}).`,
          duration: 4000,
        })
      } else {
        const id = ++chunkIdRef.current
        setChunks((prev) => [
          ...prev,
          {
            id,
            stream: 'server',
            text: `Server started on port ${msg.port}`,
            port: msg.port,
          },
        ])
        toast.success('Server started', {
          description: `Listening on port ${msg.port} — click the link in the console to open it.`,
          duration: 8000,
        })
      }
    })

    sock.on('exit', (res: RunResult) => {
      setResult(res)
      setIsRunning(false)
      isRunningRef.current = false
      setAwaitingInput(false)
      const ok =
        res.code === 0 && !res.timedOut && !res.error
      if (ok) {
        toast.success('Program finished')
      } else if (res.timedOut) {
        toast.error('Timed out')
      } else if (res.code !== null && res.code !== 0) {
        toast.error(`Exited with code ${res.code}`)
      } else if (res.error) {
        toast.error('Failed to run', { description: res.error })
      }
    })

    sock.on('timeout', () => {
      toast.error('Timed out')
    })

    socketRef.current = sock
    return sock
  }, [])

  // ---- Auto-scroll console ----
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ block: 'end' })
    }
  }, [chunks])

  // ---- Focus input when awaitingInput turns true ----
  useEffect(() => {
    if (awaitingInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [awaitingInput])

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  // ---- Run handler ----
  const handleRun = useCallback(() => {
    if (isRunningRef.current) {
      return
    }
    // Kotlin Android uses its own multi-file project state — skip the empty-code guard.
    if (!code.trim()) {
      toast.info('Nothing to run', {
        description:
          language === 'java' ? 'Write some Java first.' :
          language === 'c' ? 'Write some C first.' :
          language === 'cpp' ? 'Write some C++ first.' :
          language === 'r' ? 'Write some R first.' :
          language === 'javascript' ? 'Write some JavaScript first.' :
          language === 'php' ? 'Write some PHP first.' :
          language === 'csharp' ? 'Write some C# first.' :
          language === 'dart' ? 'Write some Dart first.' :
          language === 'flutter' ? 'Write some Flutter code first.' :
          language === 'html' ? 'Write some HTML/CSS first.' :
          language === 'sql' ? 'Write some SQL first.' :
          language === 'kotlin' ? 'Write some Kotlin code first.' :
          language === 'go' ? 'Write some Go code first.' :
          language === 'typescript' ? 'Write some TypeScript code first.' :
          language === 'rust' ? 'Write some Rust code first.' :
          language === 'ruby' ? 'Write some Ruby code first.' :
          language === 'swift' ? 'Write some Swift code first.' :
          language === 'lua' ? 'Write some Lua code first.' :
          language === 'perl' ? 'Write some Perl code first.' :
          language === 'powershell' ? 'Write some PowerShell code first.' :
          language === 'bash' ? 'Write some Bash code first.' :
          language === 'fortran' ? 'Write some Fortran code first.' :
          language === 'cobol' ? 'Write some COBOL code first.' :
          'Write some Python first.',
      })
      return
    }
    isRunningRef.current = true
    setIsRunning(true)
    setResult(null)
    setChunks([])
    setAwaitingInput(false)
    setFlutterPort(null)
    chunkIdRef.current = 0

    const sock = ensureSocket()
    // Multi-file execution: send the full project file tree + entry file
    // path for every language. Each spawn* function in the runner knows
    // how to handle multi-file mode for its language (Python: PYTHONPATH,
    // JS: run entry directly, Java: compile *.java together, Go: go run .,
    // Rust: rustc entry resolves `mod helper;`, etc.).
    //
    // Flutter, HTML, and SQL are single-file-only (their spawn functions
    // don't use the `files` payload), so we skip the payload for them.
    const isMultiFileLanguage =
      language !== 'flutter' &&
      language !== 'html' &&
      language !== 'sql'
    const files = isMultiFileLanguage ? getFilesForRunner() : undefined
    const entryFile = isMultiFileLanguage ? getEntryFilePath() : undefined
    const emitRun = () => {
      sock.emit('run', {
      code,
      language,
      timeout: (language === 'flutter' || language === 'html') ? 120000 : 30000,
      stdin: stdinText,
      // Only send files+entryFile when we have at least 1 file AND an entry path.
      // The runner ignores these for single-file runs.
      ...(files && Object.keys(files).length >= 1 && entryFile ? { files, entryFile } : {}),
      })
    }
    if (sock.connected) {
      emitRun()
    } else {
      // Wait for connection. The runner might be restarting (watchdog
      // auto-restart), so give it extra time to come back up.
      sock.once('connect', emitRun)
      if (!sock.active) sock.connect()
      // Safety timeout: if we never connect after 10s, surface the error
      setTimeout(() => {
        if (isRunningRef.current && !sock.connected) {
          toast.error('Cannot connect to Python runner', {
            description: 'The runner service may be restarting. Try again in a moment.',
          })
          isRunningRef.current = false
          setIsRunning(false)
        }
      }, 10000)
    }
  }, [code, language, stdinText, ensureSocket])

  // ---- Submit input line ----
  const handleSubmitInput = useCallback(() => {
    // Read the value directly from the input element to avoid stale closures.
    // The `inputValue` state might be stale if the user types fast and the
    // useCallback hasn't re-rendered yet.
    const text = inputRef.current?.value ?? inputValue
    if (!text.trim()) return
    if (!isRunningRef.current) return
    const sock = socketRef.current
    if (!sock) return
    sock.emit('input', { text })
    // Echo the user input into the console so they can see what they typed.
    const id = ++chunkIdRef.current
    setChunks((prev) => [
      ...prev,
      { id, stream: 'input', text: text + '\n' },
    ])
    setInputValue('')
    // Clear the input element directly too (in case React state is stale)
    if (inputRef.current) inputRef.current.value = ''
    // Keep focus for the next prompt
    setTimeout(() => inputRef.current?.focus(), 20)
  }, [inputValue])

  const handleStop = useCallback(() => {
    const sock = socketRef.current
    if (sock) sock.emit('stop')
    isRunningRef.current = false
    setIsRunning(false)
    setAwaitingInput(false)
    toast.info('Execution stopped')
  }, [])

  const handleClearConsole = useCallback(() => {
    setChunks([])
    setResult(null)
  }, [])

  const handleClearAll = useCallback(() => {
    setCodeWrapped('')
    setChunks([])
    setResult(null)
    setActiveExampleId(null)
    toast.info('Editor cleared')
  }, [setCodeWrapped])

  // Switch language — switches the active project (per-language isolation).
  // Each language has its own completely separate workspace with its own
  // files, folders, and entry file. Switching to Java shows the Java
  // project's files; switching back to Python shows the Python project's
  // files. No files are mixed, deleted, renamed, or overwritten.
  // The editor's content + language are automatically derived from the
  // active file via the useEffect below.
  const handleLanguageChange = useCallback((lang: Language) => {
    if (lang === language) return
    // Switch the active project — the store's selectedLanguage changes,
    // which causes useActiveFile() to return the new language's active file.
    useProjectStore.getState().setSelectedLanguage(lang)
    setLanguage(lang)
    setChunks([])
    setResult(null)
    setActiveExampleId(null)
    // Push a history entry so the browser Back button returns to the
    // previous language.
    const newProj = useProjectStore.getState().projects[lang]
    const activeNode = newProj.activeFileId ? newProj.nodes[newProj.activeFileId] : null
    const newCode = activeNode && activeNode.type === 'file' ? activeNode.content : ''
    pushHistoryState(newCode, lang)
  }, [language])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Code copied to clipboard')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Failed to copy')
    }
  }, [code])

  const handleShare = useCallback(async () => {
    try {
      // Push a new history entry (NOT replaceState) so that pressing the
      // browser Back button returns the user to the previous snippet.
      pushHistoryState(code, language)
      await navigator.clipboard.writeText(window.location.href)
      setShared(true)
      // Mark the active file as saved (no longer dirty) since we just
      // shared it.
      markActiveFileSaved()
      toast.success('Share link copied to clipboard', {
        description: 'Anyone with the link can run this snippet.',
      })
      setTimeout(() => setShared(false), 1500)
    } catch {
      toast.error('Failed to create share link')
    }
  }, [code, language, markActiveFileSaved])

  const handleDownload = useCallback(() => {
    const ext =
      language === 'java' ? 'java' :
      language === 'c' ? 'c' :
      language === 'cpp' ? 'cpp' :
      language === 'r' ? 'R' :
      language === 'javascript' ? 'js' :
      language === 'php' ? 'php' :
      language === 'csharp' ? 'cs' :
      language === 'dart' ? 'dart' :
      language === 'flutter' ? 'dart' :
      language === 'html' ? 'html' :
      language === 'sql' ? 'sql' :
      language === 'kotlin' ? 'kt' :
      language === 'go' ? 'go' :
      language === 'typescript' ? 'ts' :
      language === 'rust' ? 'rs' :
      language === 'ruby' ? 'rb' :
      language === 'swift' ? 'swift' :
      language === 'lua' ? 'lua' :
      language === 'perl' ? 'pl' :
      language === 'powershell' ? 'ps1' :
      language === 'bash' ? 'sh' :
      language === 'fortran' ? 'f90' :
      language === 'cobol' ? 'cbl' :
      'py'
    const mime =
      language === 'java' ? 'text/x-java;charset=utf-8' :
      language === 'c' ? 'text/x-csrc;charset=utf-8' :
      language === 'cpp' ? 'text/x-c++src;charset=utf-8' :
      language === 'r' ? 'text/x-r;charset=utf-8' :
      language === 'javascript' ? 'text/javascript;charset=utf-8' :
      language === 'php' ? 'text/x-php;charset=utf-8' :
      language === 'csharp' ? 'text/x-csharp;charset=utf-8' :
      language === 'dart' ? 'text/x-dart;charset=utf-8' :
      language === 'flutter' ? 'text/x-dart;charset=utf-8' :
      language === 'html' ? 'text/html;charset=utf-8' :
      language === 'sql' ? 'application/sql;charset=utf-8' :
      language === 'kotlin' ? 'text/x-kotlin;charset=utf-8' :
      language === 'go' ? 'text/x-go;charset=utf-8' :
      language === 'typescript' ? 'text/typescript;charset=utf-8' :
      language === 'rust' ? 'text/rust;charset=utf-8' :
      language === 'ruby' ? 'text/x-ruby;charset=utf-8' :
      language === 'swift' ? 'text/swift;charset=utf-8' :
      language === 'lua' ? 'text/lua;charset=utf-8' :
      language === 'perl' ? 'text/perl;charset=utf-8' :
      language === 'powershell' ? 'text/powershell;charset=utf-8' :
      language === 'bash' ? 'text/x-sh;charset=utf-8' :
      language === 'fortran' ? 'text/fortran;charset=utf-8' :
      language === 'cobol' ? 'text/cobol;charset=utf-8' :
      'text/x-python;charset=utf-8'
    const blob = new Blob([code], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `snippet.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Downloaded snippet.${ext}`)
  }, [code, language])

  const handleSelectExample = useCallback((ex: Snippet) => {
    // Switch to the example's language project first (per-language isolation).
    // This ensures the example is loaded into the correct language's workspace
    // without overwriting files in other languages.
    const newLang = ex.language ?? language
    const state = useProjectStore.getState()
    state.setSelectedLanguage(newLang)
    setLanguage(newLang)
    // Load the example code into the active file of the new language's project.
    state.setActiveFileContent(ex.code)
    setActiveExampleId(ex.id)
    setChunks([])
    setResult(null)
    // Push a history entry so the browser Back button returns to the
    // previous snippet (not the example just loaded).
    pushHistoryState(ex.code, newLang)
    toast.success(`Loaded "${ex.name}"`, { description: ex.description })
  }, [language])

  // resolvedTheme is undefined during SSR; default to dark to match the
  // ThemeProvider's `defaultTheme='dark'` setting. After mount the actual
  // resolved theme will be applied.
  const editorTheme: 'light' | 'dark' =
    hydrated && resolvedTheme === 'light' ? 'light' : 'dark'

  const status = useMemo(() => {
    if (isRunning) {
      return awaitingInput
        ? { label: 'Awaiting input', tone: 'input' as const }
        : { label: 'Running', tone: 'running' as const }
    }
    if (!result) return { label: 'Ready', tone: 'idle' as const }
    if (result.timedOut) return { label: 'Timed out', tone: 'error' as const }
    if (result.error) return { label: 'Error', tone: 'error' as const }
    if (result.code === 0) return { label: 'Success', tone: 'success' as const }
    return { label: `Exit ${result.code}`, tone: 'error' as const }
  }, [isRunning, awaitingInput, result])

  const lineCount = useMemo(() => code.split('\n').length, [code])
  const charCount = code.length

  // ---- Quick file switcher state ----
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false)
  // ---- Mobile file explorer drawer state ----
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false)

  // ---- Keyboard shortcuts ----
  // Ctrl/Cmd+Enter  → Run
  // Ctrl/Cmd+S      → Save (marks the active file as saved)
  // Ctrl/Cmd+P      → Quick file switcher
  // Ctrl/Cmd+F      → Find in file (CodeMirror built-in; we just intercept browser's)
  // Ctrl/Cmd+H      → Replace (Phase 3 — for now, prevent browser history dialog)
  // Ctrl/Cmd+/      → Toggle comment (handled by CodeMirror's default binding)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'Enter') {
        e.preventDefault()
        handleRun()
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        markActiveFileSaved()
        toast.success('Saved')
      } else if (e.key === 'p' || e.key === 'P') {
        // Only trigger if NOT pressed inside an input/textarea (so users can
        // still type Ctrl+P for printing in textareas).
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        setQuickSwitcherOpen(true)
      }
      // Ctrl+F / Ctrl+H / Ctrl+/ — let CodeMirror's default keybindings handle these.
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleRun, markActiveFileSaved, setQuickSwitcherOpen])

  // ---- Unsaved-changes protection (beforeunload) ----
  // Warns the user before closing/refreshing the tab if there are unsaved changes.
  useEffect(() => {
    if (!isProjectDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Browsers ignore custom messages, but returning a string triggers the prompt.
      e.returnValue = 'You have unsaved changes. Leave anyway?'
      return e.returnValue
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isProjectDirty])

  return (
    <TooltipProvider delayDuration={300}>
      <QuickSwitcher open={quickSwitcherOpen} onOpenChange={setQuickSwitcherOpen} />
      <div className="flex h-screen flex-col bg-background text-foreground">
        {/* ============ Header ============ */}
        <header className="flex h-14 flex-none items-center justify-between border-b border-border bg-card/40 px-3 sm:px-4 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile: file explorer toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden flex-none"
              onClick={() => setMobileExplorerOpen(true)}
              aria-label="Open file explorer"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-rose-500 shadow-sm">
              <FileCode2 className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold tracking-tight">
                  CodeHubz
                </h1>
                <Badge
                  variant="secondary"
                  className={`hidden sm:inline-flex border ${
                    language === 'java'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                      : language === 'c'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                        : language === 'cpp'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                          : language === 'r'
                            ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                            : language === 'javascript'
                              ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
                              : language === 'php'
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                : language === 'csharp'
                                  ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20'
                                  : language === 'dart'
                                    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20'
                                    : language === 'flutter'
                                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                      : language === 'html'
                                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                                        : language === 'sql'
                                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                          : language === 'kotlin'
                                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                            : language === 'go'
                                              ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                                              : language === 'typescript'
                                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                                : language === 'rust'
                                                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                                                  : language === 'ruby'
                                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                                                    : language === 'swift'
                                                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                                                      : language === 'lua'
                                                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                                        : language === 'perl'
                                                          ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                                                          : language === 'powershell'
                                                            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                                                            : language === 'bash'
                                                              ? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                                                              : language === 'fortran'
                                                                ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
                                                                : language === 'cobol'
                                                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {language === 'java'
                    ? 'Java 21'
                    : language === 'c'
                      ? 'C (gcc 14)'
                      : language === 'cpp'
                        ? 'C++ (g++ 14)'
                        : language === 'r'
                          ? 'R 4.5'
                          : language === 'javascript'
                            ? 'Node.js 24'
                            : language === 'php'
                              ? 'PHP 8.4'
                              : language === 'csharp'
                                ? 'C# (.NET 8)'
                                : language === 'dart'
                                  ? 'Dart 3.13'
                                  : language === 'flutter'
                                    ? 'Flutter 3.47'
                                    : language === 'html'
                                      ? 'HTML/CSS'
                                      : language === 'sql'
                                        ? 'SQLite 3.53'
                                        : language === 'kotlin'
                                          ? 'Kotlin 2.0'
                                          : language === 'go'
                                            ? 'Go 1.23'
                                            : language === 'typescript'
                                              ? 'TypeScript 5'
                                              : language === 'rust'
                                                ? 'Rust 1.98'
                                                : language === 'ruby'
                                                  ? 'Ruby 3.3'
                                                  : language === 'swift'
                                                    ? 'Swift 5.10'
                                                    : language === 'lua'
                                                      ? 'Lua 5.4'
                                                      : language === 'perl'
                                                        ? 'Perl 5.40'
                                                        : language === 'powershell'
                                                          ? 'PowerShell 7'
                                                          : language === 'bash'
                                                            ? 'Bash 5.2'
                                                            : language === 'fortran'
                                                              ? 'Fortran 14'
                                                              : language === 'cobol'
                                                                ? 'COBOL 3.2'
                                                                : 'Python 3.12'}
                </Badge>
              </div>
              <p className="hidden sm:block text-xs text-muted-foreground truncate">
                {language === 'java'
                  ? 'Interactive Java console with live stdin'
                  : language === 'c'
                    ? 'Interactive C console with live stdin'
                    : language === 'cpp'
                      ? 'Interactive C++ console with live stdin'
                      : language === 'r'
                        ? 'Interactive R console with live stdin'
                        : language === 'javascript'
                          ? 'Interactive JavaScript console with live stdin'
                          : language === 'php'
                            ? 'Interactive PHP console with live stdin'
                            : language === 'csharp'
                              ? 'Interactive C# console with live stdin'
                              : language === 'dart'
                                ? 'Interactive Dart console with live stdin'
                                : language === 'flutter'
                                  ? 'Flutter widget tests (headless rendering)'
                                  : language === 'html'
                                    ? 'Live HTML/CSS/JS preview in iframe'
                                    : language === 'sql'
                                      ? 'Interactive SQLite SQL console'
                                      : language === 'kotlin'
                                        ? 'Interactive Kotlin/JVM console with live stdin'
                                        : language === 'go'
                                          ? 'Interactive Go console with live stdin'
                                          : language === 'typescript'
                                            ? 'Interactive TypeScript console with live stdin'
                                            : language === 'rust'
                                              ? 'Interactive Rust console with live stdin'
                                              : language === 'ruby'
                                                ? 'Interactive Ruby console with live stdin'
                                                : language === 'swift'
                                                  ? 'Interactive Swift console with live stdin'
                                                  : language === 'lua'
                                                    ? 'Interactive Lua console with live stdin'
                                                    : language === 'perl'
                                                      ? 'Interactive Perl console with live stdin'
                                                      : language === 'powershell'
                                                        ? 'Interactive PowerShell console with live stdin'
                                                        : language === 'bash'
                                                          ? 'Interactive Bash console with live stdin'
                                                          : language === 'fortran'
                                                            ? 'Interactive Fortran console with live stdin'
                                                            : language === 'cobol'
                                                              ? 'Interactive COBOL console with live stdin'
                                                              : 'Interactive Python console with live input()'}
              </p>
            </div>
          </div>

          {/* Language selector */}
          <div className="flex items-center gap-1 mr-1.5">
            <div className="flex items-center rounded-md border border-border bg-muted/50 p-0.5">
              <button
                type="button"
                onClick={() => handleLanguageChange('python')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'python'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Python
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('java')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'java'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Java
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('c')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'c'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('cpp')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'cpp'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                C++
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('r')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'r'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                R
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('javascript')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'javascript'
                    ? 'bg-yellow-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                JS
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('php')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'php'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                PHP
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('csharp')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'csharp'
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                C#
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('dart')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'dart'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Dart
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('flutter')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'flutter'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Flutter
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('html')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'html'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                HTML
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('sql')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'sql'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                SQL
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('kotlin')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'kotlin'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Kotlin
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('go')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'go'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Go
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('typescript')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'typescript'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                TS
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('rust')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'rust'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Rust
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('ruby')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'ruby'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Ruby
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('swift')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'swift'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Swift
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('lua')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'lua'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Lua
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('perl')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'perl'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Perl
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('powershell')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'powershell'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                PS
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('bash')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'bash'
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Bash
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('fortran')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'fortran'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Fortran
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('cobol')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  language === 'cobol'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                COBOL
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <FileCode2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Examples</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-72 max-h-[500px] overflow-y-auto"
              >
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Python examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === undefined).map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Java examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'java').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  C examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'c').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  C++ examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'cpp').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  R examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'r').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  JavaScript examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'javascript').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  PHP examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'php').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  C# examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'csharp').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Dart examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'dart').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Flutter examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'flutter').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  HTML/CSS examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'html').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  SQL examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'sql').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Kotlin examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'kotlin').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Go examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'go').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  TypeScript examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'typescript').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Rust examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'rust').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Ruby examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'ruby').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Swift examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'swift').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Lua examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'lua').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Perl examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'perl').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  PowerShell examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'powershell').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Bash examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'bash').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Fortran examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'fortran').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  COBOL examples
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.filter((ex) => ex.language === 'cobol').map((ex) => (
                  <DropdownMenuItem
                    key={ex.id}
                    onSelect={() => handleSelectExample(ex)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {ex.description}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-6 mx-0.5" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                  }
                  aria-label="Toggle theme"
                >
                  {/* Render a placeholder Sun icon during SSR/first render so
                      the markup matches what the server produced. After
                      hydration, show the correct icon based on resolvedTheme. */}
                  {hydrated && resolvedTheme === 'light' ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Sun className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ============ Toolbar ============ */}
        <div className="flex h-12 flex-none items-center gap-1.5 border-b border-border bg-muted/30 px-3 sm:px-4">
          <Button
            onClick={handleRun}
            disabled={isRunning}
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Run</span>
            <kbd className="hidden md:inline text-[10px] font-mono opacity-70 ml-1 px-1 py-0.5 rounded bg-black/10">
              ⌘↵
            </kbd>
          </Button>

          {isRunning && (
            <Button
              onClick={handleStop}
              variant="destructive"
              size="sm"
              className="gap-1.5"
            >
              <Square className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Stop</span>
            </Button>
          )}

          <Separator orientation="vertical" className="h-6 mx-0.5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleCopy} variant="ghost" size="sm" className="gap-1.5">
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="hidden md:inline">Copy</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy code</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleShare} variant="ghost" size="sm" className="gap-1.5">
                {shared ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                <span className="hidden md:inline">Share</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy shareable link</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  markActiveFileSaved()
                  toast.success('Saved')
                }}
                variant={isProjectDirty ? 'default' : 'ghost'}
                size="sm"
                className="gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span className="hidden md:inline">
                  {isProjectDirty ? 'Save' : 'Saved'}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save (Ctrl+S)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleDownload} variant="ghost" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" />
                <span className="hidden md:inline">Download</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download as .py</TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleClearAll}
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <Eraser className="h-4 w-4" />
                <span className="hidden md:inline">Clear</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear editor & console</TooltipContent>
          </Tooltip>
        </div>

        {/* ============ Main split: file explorer | editor | console ============ */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {/* Mobile file explorer drawer (Sheet) */}
          <Sheet open={mobileExplorerOpen} onOpenChange={setMobileExplorerOpen}>
            <SheetContent side="left" className="w-72 p-0 sm:max-w-xs">
              <FileExplorer onCommandPalette={() => { setMobileExplorerOpen(false); setQuickSwitcherOpen(true) }} />
            </SheetContent>
          </Sheet>

          <PanelGroup direction="horizontal" className="h-full">
            {/* ---- File Explorer (desktop only) ---- */}
            <Panel
              defaultSize={15}
              minSize={10}
              maxSize={30}
              className="hidden md:block"
            >
              <FileExplorer onCommandPalette={() => setQuickSwitcherOpen(true)} />
            </Panel>
            <PanelResizeHandle className="hidden md:flex w-1 bg-border hover:bg-emerald-500/50 transition-colors items-center justify-center group">
              <div className="h-10 w-0.5 rounded-full bg-border group-hover:bg-emerald-500" />
            </PanelResizeHandle>

            {/* ---- Editor ---- */}
            <Panel
              defaultSize={language === 'flutter' || language === 'html' ? 0 : 40}
              minSize={20}
            >
              <div className="h-full flex flex-col">
                <div className="flex-none flex h-9 items-center gap-2 border-b border-border bg-muted/30 px-3">
                  <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
                    {activeFile?.name ?? (language === 'java'
                      ? 'code.java'
                      : language === 'c'
                        ? 'code.c'
                        : language === 'cpp'
                          ? 'code.cpp'
                          : language === 'r'
                            ? 'code.R'
                            : language === 'javascript'
                              ? 'code.js'
                              : language === 'php'
                                ? 'code.php'
                                : language === 'csharp'
                                  ? 'code.cs'
                                  : language === 'dart'
                                    ? 'code.dart'
                                    : language === 'flutter'
                                      ? 'widget_test.dart'
                                      : language === 'html'
                                        ? 'index.html'
                                        : language === 'sql'
                                          ? 'query.sql'
                                          : language === 'kotlin'
                                            ? 'Main.kt'
                                            : language === 'go'
                                              ? 'main.go'
                                              : language === 'typescript'
                                                ? 'index.ts'
                                                : language === 'rust'
                                                  ? 'main.rs'
                                                  : language === 'ruby'
                                                    ? 'main.rb'
                                                    : language === 'swift'
                                                      ? 'main.swift'
                                                      : language === 'lua'
                                                        ? 'main.lua'
                                                        : language === 'perl'
                                                          ? 'main.pl'
                                                          : language === 'powershell'
                                                            ? 'main.ps1'
                                                            : language === 'bash'
                                                              ? 'script.sh'
                                                              : language === 'fortran'
                                                                ? 'main.f90'
                                                                : language === 'cobol'
                                                                  ? 'main.cbl'
                                                                  : 'code.py')}
                  </span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setShowStdin(!showStdin)}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors ${
                      showStdin
                        ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                    title="Toggle Program Input panel"
                  >
                    <Terminal className="h-3 w-3" />
                    Program Input
                    {stdinText.trim() && (
                      <span className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[9px] px-1 rounded">
                        {stdinText.split('\n').filter(l => l.trim()).length}
                      </span>
                    )}
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <PyEditor
                    value={code}
                    onChange={setCodeWrapped}
                    onRun={handleRun}
                    theme={editorTheme}
                    language={language}
                  />
                </div>
                {/* Program Input panel (collapsible) */}
                {showStdin && (
                  <div className="flex-none border-t border-border bg-muted/20">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/10">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Program Input (stdin) — one value per line
                      </span>
                      {stdinText && (
                        <button
                          type="button"
                          onClick={() => setStdinText('')}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <textarea
                      value={stdinText}
                      onChange={(e) => setStdinText(e.target.value)}
                      placeholder="Type input values here, one per line.&#10;Example:&#10;Arun&#10;20"
                      spellCheck={false}
                      className="w-full h-24 resize-none bg-background font-mono text-[13px] leading-relaxed px-3 py-2 outline-none placeholder:text-muted-foreground/50"
                      style={{
                        fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'break-word',
                      }}
                    />
                  </div>
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="w-1.5 bg-border hover:bg-emerald-500/50 transition-colors flex items-center justify-center group">
              <div className="h-10 w-0.5 rounded-full bg-border group-hover:bg-emerald-500" />
            </PanelResizeHandle>

            {/* ---- Right panel: Console OR Full-screen Preview (Flutter/HTML) ---- */}
            <Panel
              defaultSize={language === 'flutter' || language === 'html' ? 85 : 45}
              minSize={25}
            >
              {(language === 'flutter' || language === 'html') ? (
                /* Full-screen Preview (Flutter OR HTML/CSS) */
                <div className="relative h-full w-full overflow-hidden bg-white dark:bg-black">
                  {flutterPort ? (
                    <iframe
                      key={flutterPort}
                      src={`/?XTransformPort=${flutterPort}`}
                      title={language === 'flutter' ? 'Flutter Preview' : 'HTML Preview'}
                      className="absolute inset-0 h-full w-full border-0"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                    />
                  ) : isRunning ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/5">
                      <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                      <span className="text-xs text-muted-foreground">
                        {language === 'flutter'
                          ? 'Building Flutter web app...'
                          : 'Starting HTML preview server...'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {language === 'flutter'
                          ? 'Takes ~20-30 seconds. The app will appear here when ready.'
                          : 'The preview will appear here in a moment.'}
                      </span>
                    </div>
                  ) : result && !result.code ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/5">
                      <CircleAlert className="h-7 w-7 text-rose-500" />
                      <span className="text-xs text-rose-500">
                        {language === 'flutter' ? 'Build failed' : 'Preview failed to start'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Check the editor or your {language === 'flutter' ? 'Flutter' : 'HTML'} code for errors.
                      </span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/5 px-6 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <svg className="h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 12l10 10 10-10L12 2z" />
                        </svg>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Run</kbd> to {language === 'flutter' ? 'build and preview your Flutter app' : 'preview your HTML/CSS in a live iframe'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        The preview will fill this entire panel when ready.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Normal Interactive Console (non-Flutter languages) */
                <div className="h-full flex flex-col bg-card/30">
                  {/* Console header */}
                  <div className="flex-none flex h-9 items-center justify-between border-b border-border px-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Console
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={status} />
                      {result && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={handleClearConsole}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Clear console</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  {/* Console body */}
                  <div className="flex-1 min-h-0 overflow-auto bg-[#0a0b10] dark:bg-[#0a0b10]">
                    {chunks.length === 0 && !isRunning ? (
                      <EmptyConsole />
                    ) : (
                      <div
                        className="px-3 py-2.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                        style={{
                          fontFamily:
                            'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'break-word',
                          tabSize: 4,
                        }}
                      >
                        {chunks.map((chunk) => (
                          <ConsoleLine key={chunk.id} chunk={chunk} />
                        ))}
                        {isRunning && chunks.length === 0 && (
                          <div className="flex items-center gap-2 text-muted-foreground py-1">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span className="text-xs">Starting…</span>
                          </div>
                        )}
                        <div ref={consoleEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Input bar */}
                  <div className="flex-none border-t border-border bg-muted/20">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <div
                        className={`flex h-6 w-6 flex-none items-center justify-center rounded ${
                          awaitingInput
                            ? 'bg-amber-500/20 text-amber-500'
                            : isRunning
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {awaitingInput ? (
                          <CornerDownLeft className="h-3.5 w-3.5" />
                        ) : isRunning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <span className="text-xs font-mono">›</span>
                        )}
                      </div>
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleSubmitInput()
                          }
                        }}
                        disabled={!isRunning}
                        placeholder={
                          isRunning
                            ? awaitingInput
                              ? 'Type your answer and press Enter…'
                              : 'Waiting for program output…'
                            : 'Console input is enabled while a program is running'
                        }
                        spellCheck={false}
                        autoComplete="off"
                        className="flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
                        style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
                      />
                      {isRunning && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs"
                          onClick={handleSubmitInput}
                          disabled={!inputValue}
                        >
                          Send
                          <CornerDownLeft className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          </PanelGroup>
        </main>

        {/* ============ Footer ============ */}
        <footer className="flex-none flex h-7 items-center justify-between border-t border-border bg-muted/30 px-3 sm:px-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {lineCount} lines
            </span>
            <span className="hidden sm:inline opacity-50">·</span>
            <span className="hidden sm:inline">{charCount} chars</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1">
              <Keyboard className="h-3 w-3" />
              <kbd className="font-mono">Ctrl/⌘ + Enter</kbd>
              <span className="opacity-60">to run</span>
            </span>
            <span className="hidden md:inline opacity-50">·</span>
            <span className="hidden md:inline">30s timeout · interactive stdin</span>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StatusBadge({
  status,
}: {
  status: {
    label: string
    tone: 'idle' | 'running' | 'success' | 'error' | 'input'
  }
}) {
  const styles = {
    idle: 'bg-muted text-muted-foreground',
    running: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    error: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    input: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  }[status.tone]

  const dot = {
    idle: 'bg-muted-foreground/60',
    running: 'bg-amber-500 animate-pulse',
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    input: 'bg-amber-500 animate-pulse',
  }[status.tone]

  const icon =
    status.tone === 'success' ? (
      <CircleCheck className="h-3 w-3" />
    ) : status.tone === 'error' ? (
      <CircleAlert className="h-3 w-3" />
    ) : status.tone === 'running' || status.tone === 'input' ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : null

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${styles}`}
    >
      {icon ?? <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {status.label}
    </span>
  )
}

function ConsoleLine({ chunk }: { chunk: OutputChunk }) {
  // Image chunk (matplotlib figure rendered as inline PNG)
  if (chunk.stream === 'image' && chunk.src) {
    return (
      <span className="my-2 block">
        <img
          src={chunk.src}
          alt="matplotlib figure"
          className="max-w-full h-auto rounded-md border border-zinc-700/50 bg-white"
          style={{ display: 'block', maxHeight: '70vh' }}
        />
      </span>
    )
  }

  // Server chunk: clickable link that opens the running server via Caddy.
  // The URL uses ?XTransformPort=<port> so the gateway routes the request
  // to the user's running Flask/Django/http.server app.
  if (chunk.stream === 'server' && chunk.port) {
    const port = chunk.port
    const href = `/?XTransformPort=${port}`
    return (
      <span
        className="my-2 block rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2"
        style={{
          fontFamily:
            'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
        }}
      >
        <span className="text-emerald-400 font-semibold">▶ Server ready</span>
        <span className="text-zinc-300"> — listening on port </span>
        <span className="text-emerald-400 font-mono font-semibold">{port}</span>
        <span className="block mt-1">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 hover:underline underline-offset-2"
          >
            Open
            <span className="text-zinc-500">/?XTransformPort={port}</span>
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </a>
        </span>
        <span className="block mt-1 text-xs text-zinc-500">
          Use Stop to terminate the server.
        </span>
      </span>
    )
  }

  // Render with EXACT whitespace preservation.
  // white-space: pre-wrap preserves leading spaces, multiple consecutive
  // spaces, tabs, and line breaks exactly as the program produced them.
  // It also wraps long lines at the right edge instead of horizontal scroll.
  // overflow-wrap: break-word breaks very long unbreakable tokens (e.g.
  // long file paths in tracebacks) to prevent overflow.
  // tab-size: 4 renders tabs as 4 columns wide.
  const text = chunk.text
  const baseStyle: React.CSSProperties = {
    fontFamily:
      'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    tabSize: 4,
  }

  if (chunk.stream === 'input') {
    return (
      <span className="text-sky-400" style={baseStyle}>
        {text}
      </span>
    )
  }
  if (chunk.stream === 'stderr') {
    return (
      <span className="text-rose-400" style={baseStyle}>
        {text}
      </span>
    )
  }
  if (chunk.stream === 'system') {
    return (
      <span className="text-muted-foreground italic" style={baseStyle}>
        {text}
      </span>
    )
  }
  // stdout
  return (
    <span className="text-zinc-100" style={baseStyle}>
      {text}
    </span>
  )
}

function EmptyConsole() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 blur-2xl bg-emerald-500/20 rounded-full" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20">
          <Terminal className="h-7 w-7 text-emerald-500" />
        </div>
      </div>
      <h3 className="text-sm font-medium text-zinc-200">Interactive console</h3>
    </div>
  )
}
