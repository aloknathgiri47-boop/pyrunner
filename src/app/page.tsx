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
} from 'lucide-react'

import PyEditor from '@/components/py-editor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface OutputChunk {
  id: number
  stream: 'stdout' | 'stderr' | 'input' | 'system' | 'image'
  text: string
  // For input chunks: did the user enter this? For output chunks: was the
  // server hint that this looks like an input prompt?
  isPrompt?: boolean
  // For image chunks: data URL (data:image/png;base64,...)
  src?: string
}

interface RunResult {
  code: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  durationMs: number
  error?: string
}

const STORAGE_KEY = 'pyrunner:state:v2'

interface PersistedState {
  code: string
}

const DEFAULT_CODE = `# PyRunner — Python 3 playground
# Press Run (or Ctrl/Cmd+Enter) to execute.

def greet(name: str) -> str:
    return f"Hello, {name}!"

print(greet("world"))

# Try the interactive example! Code with input() will
# prompt you directly in the console below.
name = input("What's your name? ")
print(f"Nice to meet you, {name}!")
`

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
    return { code: parsed.code }
  } catch {
    return null
  }
}

function loadFromUrlHash(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (!hash || hash.length < 2) return null
  try {
    const params = new URLSearchParams(hash.slice(1))
    const codeB64 = params.get('c')
    if (!codeB64) return null
    const decode = (s: string) => {
      const padded = s.replace(/-/g, '+').replace(/_/g, '/')
      const pad =
        padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
      const b64 = padded + pad
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return new TextDecoder('utf-8').decode(bytes)
    }
    return decode(codeB64)
  } catch {
    return null
  }
}

function encodeToHash(code: string): string {
  const encode = (s: string) => {
    const bytes = new TextEncoder().encode(s)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  const params = new URLSearchParams()
  params.set('c', encode(code))
  return `#${params.toString()}`
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

function getInitialCode(): string {
  if (typeof window === 'undefined') return DEFAULT_CODE
  // URL hash takes priority, then localStorage, then default.
  const fromHash = loadFromUrlHash()
  if (fromHash) return fromHash
  const persisted = loadState()
  if (persisted) return persisted.code
  return DEFAULT_CODE
}

export default function Home() {
  const { setTheme, resolvedTheme } = useTheme()
  // Lazy initializer: runs once on the client during the very first render.
  // On the server it returns DEFAULT_CODE (window is undefined). This avoids
  // any useEffect-based hydration that would trip react-hooks/set-state-in-effect.
  // suppressHydrationWarning on <html> covers the resulting markup difference.
  const [code, setCode] = useState<string>(() => getInitialCode())
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null)

  const [chunks, setChunks] = useState<OutputChunk[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [awaitingInput, setAwaitingInput] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const chunkIdRef = useRef(0)
  const consoleEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const isRunningRef = useRef(false)

  // No hydration effect needed — the lazy initializer handles it.

  // ---- Persist code (debounced) ----
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ code } satisfies PersistedState),
        )
      } catch {
        /* ignore */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [code])

  // ---- WebSocket connection (lazy: only connect when running) ----
  const ensureSocket = useCallback((): Socket => {
    if (socketRef.current) return socketRef.current
    // Use polling+websocket transports so the XTransformPort query parameter
    // is preserved during the initial HTTP handshake (websocket-only skips
    // the polling handshake and the query gets dropped by the gateway).
    const sock = io('/?XTransformPort=3003', {
      transports: ['polling', 'websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 10_000,
    })

    sock.on('connect', () => {
      /* ready */
    })

    sock.on('connect_error', (err: { message: string }) => {
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

    sock.on('exit', (res: RunResult) => {
      setResult(res)
      setIsRunning(false)
      isRunningRef.current = false
      setAwaitingInput(false)
      const ok =
        res.code === 0 && !res.timedOut && !res.error
      if (ok) {
        toast.success('Program finished', {
          description: `Exit 0 · ${res.durationMs}ms`,
        })
      } else if (res.timedOut) {
        toast.error('Timed out', { description: `Killed after ${res.durationMs}ms` })
      } else if (res.code !== null && res.code !== 0) {
        toast.error(`Exited with code ${res.code}`, {
          description: `${res.durationMs}ms`,
        })
      } else if (res.error) {
        toast.error('Failed to run', { description: res.error })
      }
    })

    sock.on('timeout', ({ durationMs }: { durationMs: number }) => {
      toast.error('Timed out', { description: `Killed after ${durationMs}ms` })
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
    if (isRunningRef.current) return
    if (!code.trim()) {
      toast.info('Nothing to run', { description: 'Write some Python first.' })
      return
    }
    isRunningRef.current = true
    setIsRunning(true)
    setResult(null)
    setChunks([])
    setAwaitingInput(false)
    chunkIdRef.current = 0

    const sock = ensureSocket()
    const emitRun = () => sock.emit('run', { code, timeout: 15000 })
    if (sock.connected) {
      emitRun()
    } else {
      // Wait for connection (could take a few hundred ms with polling transport)
      sock.once('connect', emitRun)
      sock.connect()
      // Safety timeout: if we never connect, surface the error
      setTimeout(() => {
        if (isRunningRef.current && !sock.connected) {
          toast.error('Cannot connect to Python runner', {
            description: 'Check that the runner service is available.',
          })
          isRunningRef.current = false
          setIsRunning(false)
        }
      }, 5000)
    }
  }, [code, ensureSocket])

  // ---- Submit input line ----
  const handleSubmitInput = useCallback(() => {
    const text = inputValue
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
    setCode('')
    setChunks([])
    setResult(null)
    setActiveExampleId(null)
    toast.info('Editor cleared')
  }, [])

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
      const hash = encodeToHash(code)
      const newUrl = `${window.location.pathname}${hash}`
      window.history.replaceState(null, '', newUrl)
      await navigator.clipboard.writeText(window.location.href)
      setShared(true)
      toast.success('Share link copied to clipboard', {
        description: 'Anyone with the link can run this snippet.',
      })
      setTimeout(() => setShared(false), 1500)
    } catch {
      toast.error('Failed to create share link')
    }
  }, [code])

  const handleDownload = useCallback(() => {
    const blob = new Blob([code], { type: 'text/x-python;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'snippet.py'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Downloaded snippet.py')
  }, [code])

  const handleSelectExample = useCallback((ex: Snippet) => {
    setCode(ex.code)
    setActiveExampleId(ex.id)
    setChunks([])
    setResult(null)
    toast.success(`Loaded "${ex.name}"`, { description: ex.description })
  }, [])

  // resolvedTheme is undefined on first render (SSR); default to dark to
  // match the ThemeProvider's `defaultTheme='dark'` setting.
  const editorTheme: 'light' | 'dark' =
    resolvedTheme === 'light' ? 'light' : 'dark'

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

  // ---- Keyboard shortcut: Ctrl/Cmd+Enter runs ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleRun()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleRun])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col bg-background text-foreground">
        {/* ============ Header ============ */}
        <header className="flex h-14 flex-none items-center justify-between border-b border-border bg-card/40 px-3 sm:px-4 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-rose-500 shadow-sm">
              <FileCode2 className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold tracking-tight">
                  PyRunner
                </h1>
                <Badge
                  variant="secondary"
                  className="hidden sm:inline-flex bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                >
                  Python 3.12
                </Badge>
              </div>
              <p className="hidden sm:block text-xs text-muted-foreground truncate">
                Interactive Python console with live input()
              </p>
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
                className="w-64 max-h-[400px] overflow-y-auto"
              >
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Load an example
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EXAMPLES.map((ex) => (
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
                  {resolvedTheme === 'light' ? (
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

        {/* ============ Main split: editor | console ============ */}
        <main className="flex-1 min-h-0 overflow-hidden">
          <PanelGroup direction="horizontal" className="h-full">
            {/* ---- Editor ---- */}
            <Panel defaultSize={55} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="flex-none flex h-9 items-center gap-2 border-b border-border bg-muted/30 px-3">
                  <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    code.py
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <PyEditor
                    value={code}
                    onChange={setCode}
                    onRun={handleRun}
                    theme={editorTheme}
                  />
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1.5 bg-border hover:bg-emerald-500/50 transition-colors flex items-center justify-center group">
              <div className="h-10 w-0.5 rounded-full bg-border group-hover:bg-emerald-500" />
            </PanelResizeHandle>

            {/* ---- Interactive Console ---- */}
            <Panel defaultSize={45} minSize={25}>
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
                          <span className="text-xs">Starting Python…</span>
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
            <span className="hidden md:inline">15s timeout · interactive stdin</span>
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
      <h3 className="text-sm font-medium mb-1 text-zinc-200">Interactive console</h3>
      <p className="text-xs text-zinc-400 max-w-[300px] leading-relaxed">
        Write your Python code on the left and press{' '}
        <kbd className="font-mono px-1 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-200">
          Run
        </kbd>
        . <code className="text-emerald-400">input()</code> prompts appear
        inline, and <code className="text-emerald-400">matplotlib</code> figures
        render as images — try the examples menu.
      </p>
    </div>
  )
}
