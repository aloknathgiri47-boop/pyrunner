'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { toast } from 'sonner'
import JSZip from 'jszip'
import {
  Play, Square, Trash2, Download, Loader2, CircleAlert, CircleCheck,
  FileCode2, FilePlus, FolderPlus, ChevronRight, ChevronDown, Pencil,
  Package, Eye, X, Smartphone,
} from 'lucide-react'

import PyEditor from '@/components/py-editor'
import AndroidLayoutPreview from '@/components/android-layout-preview'
import { Button } from '@/components/ui/button'
import { KOTLIN_ANDROID_TEMPLATE } from '@/lib/examples'
import { parseLayoutXml, parseResources } from '@/lib/android-xml-parser'
import { transpileKotlin } from '@/lib/kotlin-transpiler'
import { generatePreviewHtml } from '@/lib/preview-generator'

type EditorLanguage = 'kotlin' | 'xml'
type Status = 'idle' | 'validating' | 'building' | 'success' | 'error'
interface OutputChunk { id: number; stream: 'stdout' | 'stderr' | 'system'; text: string }
interface RunResult { code: number | null; signal: string | null; timedOut: boolean; durationMs: number; error?: string }

const STORAGE_KEY = 'pyrunner:kotlin-android-project:v1'

function loadProject(): Record<string, string> {
  if (typeof window === 'undefined') return { ...KOTLIN_ANDROID_TEMPLATE }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...KOTLIN_ANDROID_TEMPLATE }
    const parsed = JSON.parse(raw)
    return (parsed && typeof parsed === 'object') ? parsed : { ...KOTLIN_ANDROID_TEMPLATE }
  } catch { return { ...KOTLIN_ANDROID_TEMPLATE } }
}
function saveProject(files: Record<string, string>) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(files)) } catch {}
}

function languageForFile(path: string): EditorLanguage {
  return (path.endsWith('.kt') || path.endsWith('.kts')) ? 'kotlin' : 'xml'
}

interface TreeNode { name: string; path: string; isFolder: boolean; children?: TreeNode[] }

function buildTree(files: Record<string, string>): TreeNode {
  const root: TreeNode = { name: '', path: '', isFolder: true, children: [] }
  const folderMap = new Map<string, TreeNode>([['', root]])
  for (const path of Object.keys(files).sort()) {
    const parts = path.split('/')
    let curPath = '', parent = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i], isLast = i === parts.length - 1
      curPath = curPath ? `${curPath}/${part}` : part
      if (isLast) parent.children!.push({ name: part, path, isFolder: false })
      else {
        let folder = folderMap.get(curPath)
        if (!folder) { folder = { name: part, path: curPath, isFolder: true, children: [] }; folderMap.set(curPath, folder); parent.children!.push(folder) }
        parent = folder
      }
    }
  }
  function sort(n: TreeNode) { if (!n.children) return; n.children.sort((a, b) => a.isFolder !== b.isFolder ? (a.isFolder ? -1 : 1) : a.name.localeCompare(b.name)); n.children.forEach(sort) }
  sort(root)
  return root
}

export default function KotlinAndroidIDE({ editorTheme }: { editorTheme: 'light' | 'dark' }) {
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({})
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [chunks, setChunks] = useState<OutputChunk[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['app', 'app/src', 'app/src/main']))
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [newItemParent, setNewItemParent] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemIsFolder, setNewItemIsFolder] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewRenderKey, setPreviewRenderKey] = useState(0)
  // QR + interactive preview state
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const socketRef = useRef<Socket | null>(null)
  const chunkIdRef = useRef(0)
  const consoleEndRef = useRef<HTMLDivElement | null>(null)
  const isRunningRef = useRef(false)

  useEffect(() => {
    const files = loadProject()
    setProjectFiles(files)
    const ma = Object.keys(files).find(p => p.endsWith('MainActivity.kt'))
    if (ma) { setActiveFilePath(ma); setOpenTabs([ma]) }
  }, [])

  useEffect(() => { const t = setTimeout(() => saveProject(projectFiles), 400); return () => clearTimeout(t) }, [projectFiles])
  useEffect(() => { if (consoleEndRef.current) consoleEndRef.current.scrollIntoView({ block: 'end' }) }, [chunks])

  const ensureSocket = useCallback((): Socket => {
    if (socketRef.current) return socketRef.current
    const sock = io('/?XTransformPort=3003', { transports: ['polling', 'websocket'], forceNew: true, reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 500, timeout: 10_000 })
    sock.on('output', (msg: { stream: string; data: string }) => {
      const stream = msg.stream === 'stderr' ? 'stderr' : msg.stream === 'system' ? 'system' : 'stdout'
      const id = ++chunkIdRef.current
      setChunks(prev => [...prev, { id, stream, text: msg.data }])
    })
    sock.on('exit', (res: RunResult) => {
      setResult(res); setIsRunning(false); isRunningRef.current = false
      if (res.code === 0) { setStatus('success'); toast.success('Validation passed', { description: 'See console for details.' }) }
      else { setStatus('error'); toast.error(`Exited with code ${res.code}`, { description: 'Check the console for the full error output.', duration: 6000 }) }
    })
    sock.on('connect_error', (err: { message: string }) => { if (!isRunningRef.current) return; toast.error('Cannot connect to runner', { description: err.message }); setIsRunning(false); isRunningRef.current = false; setStatus('error') })
    socketRef.current = sock
    return sock
  }, [])

  const runAction = useCallback((action: 'validate' | 'build') => {
    if (isRunningRef.current) return
    if (Object.keys(projectFiles).length === 0) { toast.error('No files in project'); return }
    isRunningRef.current = true; setIsRunning(true)
    setStatus(action === 'validate' ? 'validating' : 'building')
    setResult(null); setChunks([]); chunkIdRef.current = 0
    setShowPreview(false); setPreviewRenderKey(k => k + 1)
    const sock = ensureSocket()
    const emit = () => sock.emit('run', { code: '', language: 'kotlin-android', action, files: projectFiles })
    if (sock.connected) emit()
    else { sock.once('connect', emit); if (!sock.active) sock.connect() }
    setTimeout(() => {
      if (Object.keys(projectFiles).some(p => p.includes('/layout/') && p.endsWith('.xml'))) {
        setShowPreview(true)
      }
    }, 2000)
  }, [projectFiles, ensureSocket])

  const handleStop = useCallback(() => { const sock = socketRef.current; if (sock) sock.emit('stop'); setIsRunning(false); isRunningRef.current = false; setStatus('idle'); toast.info('Execution stopped') }, [])
  const handleClearConsole = useCallback(() => { setChunks([]); setResult(null); setStatus('idle') }, [])

  /* ---- RUN: XML→AST + Kotlin→JS → upload → QR ---- */
  const handleRunWithPreview = useCallback(async () => {
    if (isRunningRef.current) return
    isRunningRef.current = true
    setIsRunning(true)
    setStatus('validating')
    setResult(null)
    setChunks([])
    chunkIdRef.current = 0

    const append = (stream: 'stdout' | 'stderr' | 'system', data: string) => {
      const id = ++chunkIdRef.current
      setChunks(prev => [...prev, { id, stream, text: data }])
    }

    try {
      // Step 1: Find layout XML + Kotlin files
      const layoutPath = Object.keys(projectFiles).find(p => p.includes('/layout/') && p.endsWith('.xml'))
      const kotlinPath = Object.keys(projectFiles).find(p => p.endsWith('MainActivity.kt') || p.endsWith('.kt'))

      if (!layoutPath) {
        append('stderr', 'Error: No layout XML file found in app/src/main/res/layout/\n')
        setStatus('error')
        isRunningRef.current = false; setIsRunning(false)
        return
      }

      const layoutXml = projectFiles[layoutPath]
      const kotlinCode = kotlinPath ? projectFiles[kotlinPath] : ''

      // Step 2: Parse resources (strings.xml, colors.xml)
      append('system', '=== Step 1/4: Parsing resources ===\n')
      const resources = parseResources(projectFiles)
      append('stdout', `✓ Loaded ${Object.keys(resources.strings).length} strings, ${Object.keys(resources.colors).length} colors\n`)

      // Step 3: Parse XML → AST
      append('system', '=== Step 2/4: Parsing XML layout ===\n')
      const { ast, error: xmlError } = parseLayoutXml(layoutXml, resources)
      if (xmlError || !ast) {
        append('stderr', `XML Error: ${xmlError}\n`)
        setStatus('error')
        isRunningRef.current = false; setIsRunning(false)
        toast.error('XML parse failed')
        return
      }
      append('stdout', `✓ Layout parsed: ${ast.type}\n`)

      // Step 4: Transpile Kotlin → JS
      append('system', '=== Step 3/4: Transpiling Kotlin → JavaScript ===\n')
      const transpiled = transpileKotlin(kotlinCode)
      if (transpiled.errors.length > 0) {
        append('stderr', `Kotlin transpile errors:\n`)
        transpiled.errors.forEach(e => append('stderr', `  ❌ ${e}\n`))
        append('stderr', `\nSupported APIs:\n  Button.setOnClickListener\n  TextView.text = "...\")\n  EditText.text.toString()\n  Toast.makeText(this, "...", ...).show()\n  View.VISIBLE / View.GONE\n  button.isEnabled = false\n`)
        setStatus('error')
        isRunningRef.current = false; setIsRunning(false)
        toast.error('Kotlin transpile failed')
        return
      }
      if (transpiled.js) {
        append('stdout', `✓ Kotlin transpiled (${transpiled.js.length} chars)\n`)
        if (transpiled.warnings.length > 0) {
          transpiled.warnings.forEach(w => append('stderr', `⚠  ${w}\n`))
        }
      }

      // Step 5: Generate HTML
      append('system', '=== Step 4/4: Generating interactive preview ===\n')
      const html = generatePreviewHtml(ast, transpiled, resources)
      setPreviewHtml(html)
      append('stdout', `✓ Generated HTML (${html.length} bytes)\n`)

      // Step 6: Upload to preview server → get URL + QR
      append('system', '=== Uploading to preview server ===\n')
      const res = await fetch('/api/android-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      })
      const data = await res.json()
      if (!data.success) {
        append('stderr', `Upload failed: ${data.error}\n`)
        setStatus('error')
        isRunningRef.current = false; setIsRunning(false)
        toast.error('Preview upload failed')
        return
      }

      append('stdout', `✓ Preview URL: ${data.previewUrl}\n`)
      append('system', `\n✓ Done! Scan the QR code to open on your phone.\n`)
      setPreviewUrl(data.previewUrl)
      setStatus('success')
      setShowPreview(true)
      toast.success('Interactive preview ready!')
    } catch (e) {
      append('stderr', `\nError: ${(e as Error).message}\n`)
      setStatus('error')
      toast.error('Preview generation failed', { description: (e as Error).message })
    } finally {
      isRunningRef.current = false
      setIsRunning(false)
    }
  }, [projectFiles])

  const handleDownloadZip = useCallback(async () => {
    try {
      const zip = new JSZip()
      for (const [path, content] of Object.entries(projectFiles)) zip.file(path, content)
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'kotlin-android-project.zip'
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success('Project downloaded', { description: 'kotlin-android-project.zip' })
    } catch (e) { toast.error('Failed to create ZIP', { description: (e as Error).message }) }
  }, [projectFiles])

  const openFile = useCallback((path: string) => { setActiveFilePath(path); setOpenTabs(prev => prev.includes(path) ? prev : [...prev, path]) }, [])
  const closeTab = useCallback((path: string) => {
    setOpenTabs(prev => { const idx = prev.indexOf(path); const next = prev.filter(p => p !== path); if (activeFilePath === path) setActiveFilePath(next[idx] || next[idx - 1] || next[0] || null); return next })
  }, [activeFilePath])
  const updateFileContent = useCallback((path: string, content: string) => setProjectFiles(prev => ({ ...prev, [path]: content })), [])
  const deleteFile = useCallback((path: string) => { setProjectFiles(prev => { const n = { ...prev }; delete n[path]; return n }); setOpenTabs(prev => prev.filter(p => p !== path)); if (activeFilePath === path) setActiveFilePath(null); toast.success(`Deleted ${path}`) }, [activeFilePath])
  const renameFile = useCallback((oldPath: string, newName: string) => {
    if (!newName.trim()) return
    const parts = oldPath.split('/'); parts[parts.length - 1] = newName.trim()
    const newPath = parts.join('/')
    if (oldPath === newPath) return
    setProjectFiles(prev => { const n = { ...prev }; n[newPath] = n[oldPath]; delete n[oldPath]; return n })
    setOpenTabs(prev => prev.map(p => p === oldPath ? newPath : p))
    if (activeFilePath === oldPath) setActiveFilePath(newPath)
    setRenamingPath(null); toast.success(`Renamed to ${newName}`)
  }, [activeFilePath])

  const createNewItem = useCallback(() => {
    if (!newItemName.trim() || newItemParent === null) return
    const name = newItemName.trim(), parent = newItemParent || ''
    const fullPath = parent ? `${parent}/${name}` : name
    setProjectFiles(prev => {
      if (newItemIsFolder) { if (prev[fullPath] !== undefined) return prev; return { ...prev, [`${fullPath}/.gitkeep`]: '' } }
      if (prev[fullPath] !== undefined) return prev
      const isKotlin = name.endsWith('.kt') || name.endsWith('.kts')
      const isXml = name.endsWith('.xml')
      const starter = isKotlin ? `// ${name}\n\n` : isXml ? `<?xml version="1.0" encoding="utf-8"?>\n<!-- ${name} -->\n` : ''
      return { ...prev, [fullPath]: starter }
    })
    if (!newItemIsFolder) openFile(fullPath)
    setNewItemName(''); setNewItemParent(null); toast.success(`Created ${newItemIsFolder ? 'folder' : 'file'}: ${name}`)
  }, [newItemName, newItemParent, newItemIsFolder, openFile])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runAction('validate') }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [runAction])

  const tree = useMemo(() => buildTree(projectFiles), [projectFiles])
  const activeContent = activeFilePath ? projectFiles[activeFilePath] || '' : ''
  const activeLanguage: EditorLanguage = activeFilePath ? languageForFile(activeFilePath) : 'kotlin'
  const layoutFiles = useMemo(() => Object.keys(projectFiles).filter(p => p.includes('/layout/') && p.endsWith('.xml')), [projectFiles])
  const currentPreviewLayout = layoutFiles[0] || null
  const statusLabel = { idle: 'Ready', validating: 'Validating...', building: 'Building...', success: 'Build Successful', error: 'Error' }[status]

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex-none flex h-12 items-center gap-1.5 border-b border-border bg-muted/30 px-3 overflow-x-auto">
        <Button onClick={handleRunWithPreview} disabled={isRunning} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white flex-none">
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          <span className="hidden sm:inline">Run</span>
        </Button>
        {isRunning && <Button onClick={handleStop} variant="destructive" size="sm" className="gap-1.5 flex-none"><Square className="h-3.5 w-3.5" /><span className="hidden sm:inline">Stop</span></Button>}
        <div className="w-px h-6 bg-border mx-1 flex-none" />
        {layoutFiles.length > 0 && (
          <Button onClick={() => { setShowPreview(!showPreview); setPreviewRenderKey(k => k + 1) }} variant={showPreview ? 'secondary' : 'ghost'} size="sm" className="gap-1.5 flex-none" title="Render layout visually">
            <Eye className="h-4 w-4" /><span className="hidden sm:inline">{showPreview ? 'Hide Preview' : 'Preview Layout'}</span>
          </Button>
        )}
        <div className="flex-1" />
        <Button onClick={handleDownloadZip} variant="ghost" size="sm" className="gap-1.5 flex-none">
          <Download className="h-4 w-4" /><span className="hidden sm:inline">Download ZIP</span>
        </Button>
        <div className="flex items-center gap-2 ml-2 flex-none"><StatusBadge status={status} label={statusLabel} /></div>
      </div>

      {/* 3-pane layout */}
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal" className="h-full">
          {/* File explorer */}
          <Panel defaultSize={20} minSize={12}>
            <div className="h-full flex flex-col bg-card/30">
              <div className="flex-none flex h-9 items-center justify-between border-b border-border px-2 bg-muted/30">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Project Files</span>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => { setNewItemParent(''); setNewItemIsFolder(false); setNewItemName('') }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="New File"><FilePlus className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { setNewItemParent(''); setNewItemIsFolder(true); setNewItemName('') }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="New Folder"><FolderPlus className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-auto py-1 text-xs">
                <FileTreeNode node={tree} depth={0} activeFilePath={activeFilePath} expandedFolders={expandedFolders}
                  onToggleFolder={(path) => setExpandedFolders(prev => { const n = new Set(prev); if (n.has(path)) n.delete(path); else n.add(path); return n })}
                  onOpenFile={openFile} onDeleteFile={deleteFile} onRenameFile={(p) => setRenamingPath(p)}
                  onNewItem={(parent, isFolder) => { setNewItemParent(parent); setNewItemIsFolder(isFolder); setNewItemName('') }}
                  renamingPath={renamingPath} onRenameSubmit={renameFile} onRenameCancel={() => setRenamingPath(null)}
                  newItemParent={newItemParent} newItemName={newItemName} newItemIsFolder={newItemIsFolder}
                  onNewItemSubmit={createNewItem} onNewItemCancel={() => { setNewItemParent(null); setNewItemName('') }} onNewItemChange={setNewItemName} />
              </div>
            </div>
          </Panel>
          <PanelResizeHandle className="w-1.5 bg-border hover:bg-emerald-500/50 transition-colors" />
          {/* Editor with tabs */}
          <Panel defaultSize={showPreview ? 35 : 55} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="flex-none flex h-9 items-center border-b border-border bg-muted/30 overflow-x-auto">
                {openTabs.length === 0 ? <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">No file open</span> :
                  openTabs.map(tab => (
                    <div key={tab} className={`flex items-center gap-1.5 px-3 h-full border-r border-border cursor-pointer group ${activeFilePath === tab ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`} onClick={() => setActiveFilePath(tab)}>
                      <FileCode2 className="h-3 w-3 flex-none" />
                      <span className="text-xs truncate max-w-[180px]">{tab.split('/').pop()}</span>
                      <button onClick={(e) => { e.stopPropagation(); closeTab(tab) }} className="opacity-50 hover:opacity-100 hover:bg-muted rounded p-0.5" title="Close tab">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
              </div>
              <div className="flex-1 min-h-0">
                {activeFilePath ? (
                  <PyEditor key={activeFilePath} value={activeContent} onChange={(val) => updateFileContent(activeFilePath, val)} onRun={() => runAction('validate')} theme={editorTheme} language={activeLanguage} />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                    <div className="text-center"><FileCode2 className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>Open a file from the explorer to start editing</p></div>
                  </div>
                )}
              </div>
            </div>
          </Panel>
          <PanelResizeHandle className="w-1.5 bg-border hover:bg-emerald-500/50 transition-colors" />
          {/* Console */}
          <Panel defaultSize={showPreview ? 20 : 25} minSize={15}>
            <div className="h-full flex flex-col bg-card/30">
              <div className="flex-none flex h-9 items-center justify-between border-b border-border px-3 bg-muted/30">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Build Output</span>
                <button onClick={handleClearConsole} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Clear console"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto bg-[#0a0b10] dark:bg-[#0a0b10]">
                {chunks.length === 0 && !isRunning ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground px-6 text-center">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Click <span className="text-emerald-400 font-mono">Run</span> to validate, <span className="text-blue-400 font-mono">Preview Layout</span> to render UI, or <span className="text-emerald-400 font-mono">Download ZIP</span> for Android Studio.</p>
                  </div>
                ) : (
                  <div className="px-3 py-2.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', tabSize: 4 }}>
                    {chunks.map(chunk => <ConsoleLine key={chunk.id} chunk={chunk} />)}
                    {isRunning && chunks.length === 0 && <div className="flex items-center gap-2 text-muted-foreground py-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="text-xs">Starting...</span></div>}
                    <div ref={consoleEndRef} />
                  </div>
                )}
              </div>
            </div>
          </Panel>
          {/* Layout Preview */}
          {showPreview && currentPreviewLayout && (
            <>
              <PanelResizeHandle className="w-1.5 bg-border hover:bg-emerald-500/50 transition-colors" />
              <Panel defaultSize={25} minSize={15}>
                <div className="h-full flex flex-col bg-card/30">
                  <div className="flex-none flex h-9 items-center justify-between border-b border-border px-3 bg-muted/30">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Eye className="h-3 w-3" /> Layout Preview</span>
                    <button onClick={() => setShowPreview(false)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Close preview"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto">
                    <AndroidLayoutPreview key={previewRenderKey} files={projectFiles} layoutPath={currentPreviewLayout} />
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* Interactive Preview Panel (in the preview area) */}
      {showPreview && previewHtml && (
        <div className="absolute inset-0 z-40 bg-black/90 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-xl overflow-hidden shadow-2xl" style={{ width: 400, height: 800, maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-zinc-900 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Interactive Preview</span>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-1 rounded hover:bg-zinc-800 text-zinc-400" title="Close">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <iframe
              srcDoc={previewHtml}
              title="Android Preview"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface FileTreeNodeProps {
  node: TreeNode; depth: number; activeFilePath: string | null; expandedFolders: Set<string>
  onToggleFolder: (path: string) => void; onOpenFile: (path: string) => void; onDeleteFile: (path: string) => void
  onRenameFile: (path: string) => void; onNewItem: (parent: string, isFolder: boolean) => void
  renamingPath: string | null; onRenameSubmit: (oldPath: string, newName: string) => void; onRenameCancel: () => void
  newItemParent: string | null; newItemName: string; newItemIsFolder: boolean
  onNewItemSubmit: () => void; onNewItemCancel: () => void; onNewItemChange: (val: string) => void
}

function FileTreeNode(props: FileTreeNodeProps) {
  const { node, depth, activeFilePath, expandedFolders, onToggleFolder, onOpenFile, onDeleteFile, onRenameFile, onNewItem, renamingPath, onRenameSubmit, onRenameCancel, newItemParent, newItemName, newItemIsFolder, onNewItemSubmit, onNewItemCancel, onNewItemChange } = props
  if (!node.children) return null
  return (
    <>
      {node.children.map(child => {
        if (!child.isFolder && child.name === '.gitkeep') return null
        const indent = depth * 12 + 8
        const isExpanded = expandedFolders.has(child.path)
        return (
          <div key={child.path}>
            <div className={`flex items-center gap-1 pr-2 py-0.5 cursor-pointer group ${activeFilePath === child.path ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'hover:bg-muted/50'}`} style={{ paddingLeft: indent }} onClick={() => child.isFolder ? onToggleFolder(child.path) : onOpenFile(child.path)}>
              {child.isFolder ? (isExpanded ? <ChevronDown className="h-3 w-3 flex-none text-muted-foreground" /> : <ChevronRight className="h-3 w-3 flex-none text-muted-foreground" />) : <span className="w-3 flex-none" />}
              {child.isFolder ? <svg className="h-3.5 w-3.5 flex-none text-amber-500" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" /></svg> : <FileCode2 className={`h-3.5 w-3.5 flex-none ${child.name.endsWith('.kt') ? 'text-rose-500' : child.name.endsWith('.xml') ? 'text-blue-500' : child.name.endsWith('.kts') ? 'text-purple-500' : 'text-muted-foreground'}`} />}
              {renamingPath === child.path ? <input autoFocus type="text" defaultValue={child.name} onBlur={(e) => onRenameSubmit(child.path, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onRenameSubmit(child.path, (e.target as HTMLInputElement).value); if (e.key === 'Escape') onRenameCancel() }} onClick={(e) => e.stopPropagation()} className="flex-1 bg-background border border-border rounded px-1 py-0 text-xs outline-none" /> : <span className="flex-1 truncate text-xs">{child.name}</span>}
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                {child.isFolder && (<><button onClick={(e) => { e.stopPropagation(); onNewItem(child.path, false) }} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="New file"><FilePlus className="h-3 w-3" /></button><button onClick={(e) => { e.stopPropagation(); onNewItem(child.path, true) }} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="New folder"><FolderPlus className="h-3 w-3" /></button></>)}
                {!child.isFolder && <button onClick={(e) => { e.stopPropagation(); onRenameFile(child.path) }} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Rename"><Pencil className="h-3 w-3" /></button>}
                <button onClick={(e) => { e.stopPropagation(); onDeleteFile(child.path) }} className="p-0.5 rounded hover:bg-rose-500/20 text-muted-foreground hover:text-rose-500" title="Delete"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
            {newItemParent === child.path && child.isFolder && (
              <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: (depth + 1) * 12 + 8 }}>
                <span className="w-3 flex-none" />
                {newItemIsFolder ? <svg className="h-3.5 w-3.5 flex-none text-amber-500" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" /></svg> : <FileCode2 className="h-3.5 w-3.5 flex-none text-muted-foreground" />}
                <input autoFocus type="text" value={newItemName} onChange={(e) => onNewItemChange(e.target.value)} onBlur={onNewItemSubmit} onKeyDown={(e) => { if (e.key === 'Enter') onNewItemSubmit(); if (e.key === 'Escape') onNewItemCancel() }} placeholder={newItemIsFolder ? 'folder name' : 'file.ext'} className="flex-1 bg-background border border-border rounded px-1 py-0 text-xs outline-none" />
              </div>
            )}
            {child.isFolder && isExpanded && child.children && <FileTreeNode {...props} node={child} depth={depth + 1} />}
          </div>
        )
      })}
    </>
  )
}

function ConsoleLine({ chunk }: { chunk: OutputChunk }) {
  const baseStyle: React.CSSProperties = { fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', tabSize: 4 }
  if (chunk.stream === 'stderr') return <span className="text-rose-400" style={baseStyle}>{chunk.text}</span>
  if (chunk.stream === 'system') return <span className="text-amber-400" style={baseStyle}>{chunk.text}</span>
  return <span className="text-zinc-100" style={baseStyle}>{chunk.text}</span>
}

function StatusBadge({ status, label }: { status: Status; label: string }) {
  const tone = status === 'success' ? 'success' : status === 'error' ? 'error' : status === 'validating' || status === 'building' ? 'running' : 'idle'
  const cls = tone === 'success' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : tone === 'error' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : tone === 'running' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-muted text-muted-foreground'
  const icon = tone === 'success' ? <CircleCheck className="h-3 w-3" /> : tone === 'error' ? <CircleAlert className="h-3 w-3" /> : tone === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> : null
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{icon}{label}</span>
}
