'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
} from 'lucide-react'

import PyEditor from '@/components/py-editor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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

interface RunResult {
  stdout: string
  stderr: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  durationMs: number
  error?: string
}

const STORAGE_KEY = 'pyrunner:state:v1'

interface PersistedState {
  code: string
  stdin: string
  activeExampleId: string | null
}

const DEFAULT_CODE = `# PyRunner — Python 3 playground
# Press Run (or Ctrl/Cmd+Enter) to execute.

def greet(name: str) -> str:
    return f"Hello, {name}!"

print(greet("world"))

# Quick demo: compute prime numbers below 50
def primes(limit: int):
    is_prime = [True] * (limit + 1)
    is_prime[0] = is_prime[1] = False
    for i in range(2, int(limit**0.5) + 1):
        if is_prime[i]:
            for j in range(i*i, limit + 1, i):
                is_prime[j] = False
    return [i for i, p in enumerate(is_prime) if p]

print("Primes below 50:", primes(50))
`

function loadState(): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (typeof parsed.code !== 'string') return null
    return {
      code: parsed.code,
      stdin: typeof parsed.stdin === 'string' ? parsed.stdin : '',
      activeExampleId: parsed.activeExampleId ?? null,
    }
  } catch {
    return null
  }
}

function loadFromUrlHash(): { code: string; stdin: string } | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (!hash || hash.length < 2) return null
  try {
    // Format: #c=<base64>&i=<base64>
    const params = new URLSearchParams(hash.slice(1))
    const codeB64 = params.get('c')
    const stdinB64 = params.get('i')
    if (!codeB64) return null
    // Decode URL-safe base64 -> UTF-8 string
    const decode = (s: string) => {
      const padded = s.replace(/-/g, '+').replace(/_/g, '/')
      const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
      const b64 = padded + pad
      const bin = atob(b64)
      // Convert binary string -> UTF-8
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return new TextDecoder('utf-8').decode(bytes)
    }
    return {
      code: decode(codeB64),
      stdin: stdinB64 ? decode(stdinB64) : '',
    }
  } catch {
    return null
  }
}

function encodeToHash(code: string, stdin: string): string {
  const encode = (s: string) => {
    const bytes = new TextEncoder().encode(s)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  const params = new URLSearchParams()
  params.set('c', encode(code))
  if (stdin) params.set('i', encode(stdin))
  return `#${params.toString()}`
}

export default function Home() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [code, setCode] = useState<string>(DEFAULT_CODE)
  const [stdin, setStdin] = useState<string>('')
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null)

  const [result, setResult] = useState<RunResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const outputEndRef = useRef<HTMLDivElement | null>(null)

  // ---- Hydration: load from URL hash first, then localStorage, then defaults ----
  useEffect(() => {
    setMounted(true)
    const fromHash = loadFromUrlHash()
    if (fromHash) {
      setCode(fromHash.code)
      setStdin(fromHash.stdin)
      return
    }
    const persisted = loadState()
    if (persisted) {
      setCode(persisted.code)
      setStdin(persisted.stdin)
      setActiveExampleId(persisted.activeExampleId)
    }
  }, [])

  // ---- Persist to localStorage (debounced) ----
  useEffect(() => {
    if (!mounted) return
    const t = setTimeout(() => {
      try {
        const state: PersistedState = { code, stdin, activeExampleId }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        /* storage full or blocked — ignore */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [code, stdin, activeExampleId, mounted])

  // ---- Auto-scroll output to bottom on new result ----
  useEffect(() => {
    if (result && outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ block: 'end' })
    }
  }, [result])

  // ---- Run handler ----
  const handleRun = useCallback(async () => {
    if (isRunning) return
    setIsRunning(true)
    setResult(null)

    const controller = new AbortController()
    abortRef.current = controller

    const startedAt = performance.now()
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, stdin, timeout: 15000 }),
        signal: controller.signal,
      })
      const data = (await res.json()) as RunResult
      setResult(data)
      const elapsed = Math.round(performance.now() - startedAt)
      const ok =
        data.exitCode === 0 &&
        !data.timedOut &&
        !data.error &&
        data.stderr.trim() === ''
      if (ok) {
        toast.success('Ran successfully', {
          description: `Exit 0 · ${data.durationMs}ms`,
        })
      } else if (data.timedOut) {
        toast.error('Timed out', {
          description: `Killed after ${data.durationMs}ms`,
        })
      } else if (data.exitCode !== 0 && data.exitCode !== null) {
        toast.error(`Exited with code ${data.exitCode}`, {
          description: `Took ${data.durationMs}ms`,
        })
      } else if (data.error) {
        toast.error('Failed to run', { description: data.error })
      } else {
        // exit 0 but stderr non-empty — still completed
        toast.success('Finished with warnings', {
          description: `Exit 0 · ${data.durationMs}ms`,
        })
      }
      void elapsed
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        toast.info('Run cancelled')
      } else {
        toast.error('Network error', {
          description: (e as Error).message,
        })
        setResult({
          stdout: '',
          stderr: `Network error: ${(e as Error).message}`,
          exitCode: null,
          signal: null,
          timedOut: false,
          durationMs: 0,
          error: 'NETWORK',
        })
      }
    } finally {
      setIsRunning(false)
      abortRef.current = null
    }
  }, [code, stdin, isRunning])

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
  }, [])

  const handleClear = useCallback(() => {
    setResult(null)
  }, [])

  const handleClearAll = useCallback(() => {
    setCode('')
    setStdin('')
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
      const hash = encodeToHash(code, stdin)
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
  }, [code, stdin])

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
    setStdin(ex.stdin ?? '')
    setActiveExampleId(ex.id)
    setResult(null)
    toast.success(`Loaded "${ex.name}"`, { description: ex.description })
  }, [])

  const editorTheme: 'light' | 'dark' =
    mounted && resolvedTheme === 'light' ? 'light' : 'dark'

  const status = useMemo(() => {
    if (isRunning) return { label: 'Running', tone: 'running' as const }
    if (!result) return { label: 'Ready', tone: 'idle' as const }
    if (result.timedOut) return { label: 'Timed out', tone: 'error' as const }
    if (result.error) return { label: 'Error', tone: 'error' as const }
    if (result.exitCode === 0 && result.stderr.trim() === '')
      return { label: 'Success', tone: 'success' as const }
    if (result.exitCode === 0)
      return { label: 'Done (with warnings)', tone: 'warning' as const }
    return { label: `Exit ${result.exitCode}`, tone: 'error' as const }
  }, [isRunning, result])

  const lineCount = useMemo(() => code.split('\n').length, [code])
  const charCount = code.length

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
                Online Python compiler & playground
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
                  {mounted && resolvedTheme === 'light' ? (
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
              <Button
                onClick={handleCopy}
                variant="ghost"
                size="sm"
                className="gap-1.5"
              >
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
              <Button
                onClick={handleShare}
                variant="ghost"
                size="sm"
                className="gap-1.5"
              >
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
                onClick={handleDownload}
                variant="ghost"
                size="sm"
                className="gap-1.5"
              >
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
            <TooltipContent>Clear editor & input</TooltipContent>
          </Tooltip>
        </div>

        {/* ============ Main split: editor | output ============ */}
        <main className="flex-1 min-h-0 overflow-hidden">
          <PanelGroup direction="horizontal" className="h-full">
            {/* ---- Editor + Stdin ---- */}
            <Panel defaultSize={55} minSize={30}>
              <Tabs defaultValue="code" className="h-full flex flex-col">
                <div className="flex-none border-b border-border bg-muted/30">
                  <TabsList className="h-9 bg-transparent rounded-none p-0 gap-0">
                    <TabsTrigger
                      value="code"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 gap-2"
                    >
                      <FileCode2 className="h-3.5 w-3.5" />
                      code.py
                    </TabsTrigger>
                    <TabsTrigger
                      value="stdin"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 gap-2"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      stdin
                      {stdin.trim() && (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1 text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        >
                          {stdin.split('\n').length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent
                  value="code"
                  className="flex-1 mt-0 min-h-0 data-[state=inactive]:hidden"
                >
                  <PyEditor
                    value={code}
                    onChange={setCode}
                    onRun={handleRun}
                    theme={editorTheme}
                  />
                </TabsContent>
                <TabsContent
                  value="stdin"
                  className="flex-1 mt-0 min-h-0 data-[state=inactive]:hidden"
                >
                  <div className="h-full flex flex-col">
                    <div className="flex-none px-3 py-2 border-b border-border bg-muted/20 text-xs text-muted-foreground">
                      Text below is piped to <code className="font-mono">stdin</code> when you press Run.
                    </div>
                    <Textarea
                      value={stdin}
                      onChange={(e) => setStdin(e.target.value)}
                      placeholder="Type input here, one line per input() call..."
                      className="flex-1 min-h-0 resize-none rounded-none border-0 bg-background font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                      spellCheck={false}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </Panel>

            <PanelResizeHandle className="w-1.5 bg-border hover:bg-emerald-500/50 transition-colors flex items-center justify-center group">
              <div className="h-10 w-0.5 rounded-full bg-border group-hover:bg-emerald-500" />
            </PanelResizeHandle>

            {/* ---- Output panel ---- */}
            <Panel defaultSize={45} minSize={25}>
              <div className="h-full flex flex-col bg-card/30">
                {/* Output header */}
                <div className="flex-none flex h-9 items-center justify-between border-b border-border px-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Output
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
                            onClick={handleClear}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clear output</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Output body */}
                <div className="flex-1 min-h-0 overflow-auto">
                  {!result && !isRunning ? (
                    <EmptyOutput />
                  ) : (
                    <div className="flex flex-col">
                      {/* Status strip */}
                      {result && (
                        <div className="flex-none flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2 text-xs bg-muted/20">
                          <StatusMetric
                            icon={<Hash className="h-3.5 w-3.5" />}
                            label="Exit"
                            value={
                              result.exitCode === null
                                ? result.timedOut
                                  ? 'killed'
                                  : '—'
                                : String(result.exitCode)
                            }
                            tone={
                              result.exitCode === 0
                                ? 'success'
                                : result.exitCode === null
                                  ? 'muted'
                                  : 'error'
                            }
                          />
                          <StatusMetric
                            icon={<Clock className="h-3.5 w-3.5" />}
                            label="Time"
                            value={`${result.durationMs}ms`}
                          />
                          {result.signal && (
                            <StatusMetric
                              icon={<CircleAlert className="h-3.5 w-3.5" />}
                              label="Signal"
                              value={result.signal}
                              tone="warning"
                            />
                          )}
                        </div>
                      )}

                      {/* Stdout */}
                      <OutputBlock
                        title="stdout"
                        content={result?.stdout ?? ''}
                        loading={isRunning && !result}
                        kind="stdout"
                      />
                      {/* Stderr */}
                      <OutputBlock
                        title="stderr"
                        content={result?.stderr ?? ''}
                        loading={isRunning && !result}
                        kind="stderr"
                      />
                      <div ref={outputEndRef} />
                    </div>
                  )}
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
            <span className="hidden md:inline">15s timeout · 1MB output cap</span>
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
  status: { label: string; tone: 'idle' | 'running' | 'success' | 'warning' | 'error' }
}) {
  const styles = {
    idle: 'bg-muted text-muted-foreground',
    running: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    error: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  }[status.tone]

  const dot = {
    idle: 'bg-muted-foreground/60',
    running: 'bg-amber-500 animate-pulse',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-rose-500',
  }[status.tone]

  const icon =
    status.tone === 'success' ? (
      <CircleCheck className="h-3 w-3" />
    ) : status.tone === 'error' ? (
      <CircleAlert className="h-3 w-3" />
    ) : status.tone === 'running' ? (
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

function StatusMetric({
  icon,
  label,
  value,
  tone = 'muted',
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'muted' | 'success' | 'error' | 'warning'
}) {
  const toneClass = {
    muted: 'text-muted-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    error: 'text-rose-600 dark:text-rose-400',
    warning: 'text-amber-600 dark:text-amber-400',
  }[tone]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground/70">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${toneClass}`}>{value}</span>
    </span>
  )
}

function OutputBlock({
  title,
  content,
  loading,
  kind,
}: {
  title: string
  content: string
  loading: boolean
  kind: 'stdout' | 'stderr'
}) {
  const hasContent = content.length > 0
  const isError = kind === 'stderr'

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Running…
      </div>
    )
  }

  if (!hasContent && !isError) {
    // stdout empty is fine — show nothing
    return null
  }

  if (!hasContent && isError) {
    return null
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center justify-between px-3 py-1 bg-muted/10">
        <span
          className={`text-[10px] font-mono uppercase tracking-wider ${
            isError
              ? 'text-rose-500/80'
              : 'text-muted-foreground/70'
          }`}
        >
          {title}
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          {content.length} bytes
        </span>
      </div>
      <pre
        className={`whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[13px] leading-relaxed ${
          isError
            ? 'text-rose-600 dark:text-rose-400 bg-rose-500/5'
            : 'text-foreground'
        }`}
        style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
      >
        {content}
      </pre>
    </div>
  )
}

function EmptyOutput() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 blur-2xl bg-emerald-500/20 rounded-full" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20">
          <Play className="h-7 w-7 text-emerald-500" />
        </div>
      </div>
      <h3 className="text-sm font-medium mb-1">Ready to run</h3>
      <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">
        Write your Python code on the left and press{' '}
        <kbd className="font-mono px-1 py-0.5 rounded bg-muted text-[10px]">
          Run
        </kbd>{' '}
        to execute. Output will appear here.
      </p>
    </div>
  )
}
