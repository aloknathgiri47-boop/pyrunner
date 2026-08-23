'use client'

/**
 * VS Code-style File Explorer.
 *
 * Renders the project's file tree from the Zustand store, with inline
 * rename and a context menu (right-click or click the "⋯" button) for
 * file/folder actions:
 *
 *   - Set as entry file (★)
 *   - Rename
 *   - Delete
 *   - New File / New Folder (when right-clicking a folder)
 *
 * The explorer is intentionally minimalist — it matches the existing
 * dark/light theme via shadcn/ui tokens (bg-muted, text-foreground, etc.).
 *
 * On mobile, the parent should wrap this in a Sheet/Drawer; this
 * component itself is layout-agnostic.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  FileCode2,
  Folder,
  FolderOpen,
  Plus,
  Star,
  Trash2,
  Pencil,
  FilePlus2,
  FolderPlus,
  MoreVertical,
} from 'lucide-react'
import {
  useProjectStore,
  useActiveLanguage,
  useActiveProject,
  type TreeNode,
  type FileNode,
  type FolderNode,
} from '@/lib/project-store'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Language } from '@/lib/languages'

/* ------------------------------------------------------------------ */
/* Per-extension icon + color                                         */
/* ------------------------------------------------------------------ */

const FILE_ICON: Record<string, { color: string; icon: typeof FileIcon }> = {
  py: { color: 'text-emerald-500', icon: FileCode2 },
  java: { color: 'text-orange-500', icon: FileCode2 },
  c: { color: 'text-blue-500', icon: FileCode2 },
  h: { color: 'text-blue-500', icon: FileCode2 },
  cpp: { color: 'text-purple-500', icon: FileCode2 },
  cc: { color: 'text-purple-500', icon: FileCode2 },
  cxx: { color: 'text-purple-500', icon: FileCode2 },
  hpp: { color: 'text-purple-500', icon: FileCode2 },
  r: { color: 'text-cyan-500', icon: FileCode2 },
  R: { color: 'text-cyan-500', icon: FileCode2 },
  js: { color: 'text-yellow-500', icon: FileCode2 },
  mjs: { color: 'text-yellow-500', icon: FileCode2 },
  cjs: { color: 'text-yellow-500', icon: FileCode2 },
  php: { color: 'text-indigo-500', icon: FileCode2 },
  cs: { color: 'text-pink-500', icon: FileCode2 },
  dart: { color: 'text-teal-500', icon: FileCode2 },
  html: { color: 'text-orange-500', icon: FileCode2 },
  htm: { color: 'text-orange-500', icon: FileCode2 },
  sql: { color: 'text-amber-500', icon: FileCode2 },
  kt: { color: 'text-purple-500', icon: FileCode2 },
  kts: { color: 'text-purple-500', icon: FileCode2 },
  go: { color: 'text-cyan-500', icon: FileCode2 },
  ts: { color: 'text-blue-500', icon: FileCode2 },
  tsx: { color: 'text-blue-500', icon: FileCode2 },
  rs: { color: 'text-orange-500', icon: FileCode2 },
  rb: { color: 'text-red-500', icon: FileCode2 },
  swift: { color: 'text-orange-500', icon: FileCode2 },
  lua: { color: 'text-indigo-500', icon: FileCode2 },
  pl: { color: 'text-green-500', icon: FileCode2 },
  ps1: { color: 'text-sky-500', icon: FileCode2 },
  sh: { color: 'text-zinc-500', icon: FileCode2 },
  bash: { color: 'text-zinc-500', icon: FileCode2 },
  f90: { color: 'text-violet-500', icon: FileCode2 },
  f95: { color: 'text-violet-500', icon: FileCode2 },
  f: { color: 'text-violet-500', icon: FileCode2 },
  cbl: { color: 'text-rose-500', icon: FileCode2 },
  cob: { color: 'text-rose-500', icon: FileCode2 },
}

function getFileIconColor(name: string): string {
  const ext = name.split('.').pop() ?? ''
  return FILE_ICON[ext]?.color ?? 'text-muted-foreground'
}

export function FileIconFor({ name }: { name: string }) {
  const ext = name.split('.').pop() ?? ''
  const Icon = FILE_ICON[ext]?.icon ?? FileIcon
  return <Icon className={`h-3.5 w-3.5 ${getFileIconColor(name)}`} />
}

/* ------------------------------------------------------------------ */
/* Tree row                                                           */
/* ------------------------------------------------------------------ */

interface RowProps {
  node: TreeNode
  depth: number
}

function TreeRow({ node, depth }: RowProps) {
  const activeFileId = useProjectStore((s) => s.projects[s.selectedLanguage].activeFileId)
  const entryFileId = useProjectStore((s) => s.projects[s.selectedLanguage].entryFileId)
  const setActiveFile = useProjectStore((s) => s.setActiveFile)
  const toggleFolder = useProjectStore((s) => s.toggleFolderExpanded)
  const renameNode = useProjectStore((s) => s.renameNode)
  const deleteNode = useProjectStore((s) => s.deleteNode)
  const setEntryFile = useProjectStore((s) => s.setEntryFile)
  const createFile = useProjectStore((s) => s.createFile)
  const createFolder = useProjectStore((s) => s.createFolder)
  // The currently-selected language (drives the default filename + extension
  // when creating new files inside this folder). Defaults to the project's
  // defaultLanguage when there is no active file.
  const activeLanguage = useActiveLanguage()
  // Active project (the selected language's isolated workspace).
  const project = useActiveProject()
  const nodes = project.nodes
  const childrenByParent = project.childrenByParent

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isRenaming])

  const isActive = node.type === 'file' && node.id === activeFileId
  const isEntry = node.type === 'file' && node.id === entryFileId

  const startRename = () => {
    setRenameValue(node.name)
    setIsRenaming(true)
  }
  const commitRename = () => {
    if (renameValue.trim() && renameValue !== node.name) {
      renameNode(node.id, renameValue)
    }
    setIsRenaming(false)
  }
  const cancelRename = () => {
    setRenameValue(node.name)
    setIsRenaming(false)
  }

  if (isRenaming) {
    return (
      <div
        className="flex items-center px-2 py-0.5"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <Input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            else if (e.key === 'Escape') cancelRename()
          }}
          className="h-6 text-xs py-0 px-1.5"
        />
      </div>
    )
  }

  const childIds = node.type === 'folder' ? (childrenByParent[node.id] ?? []) : []
  const childNodes = childIds.map((id) => nodes[id]).filter(Boolean)

  return (
    <>
      <div
        className={`group flex items-center gap-1 px-2 py-0.5 cursor-pointer text-xs select-none ${
          isActive
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'hover:bg-muted/60'
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => {
          if (node.type === 'folder') {
            toggleFolder(node.id)
          } else {
            setActiveFile(node.id)
          }
        }}
        onDoubleClick={(e) => {
          if (node.type === 'folder') {
            e.preventDefault()
            startRename()
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (node.type === 'file') setActiveFile(node.id)
            else toggleFolder(node.id)
          } else if (e.key === 'F2') {
            e.preventDefault()
            startRename()
          } else if (e.key === 'Delete') {
            e.preventDefault()
            deleteNode(node.id)
          }
        }}
      >
        {/* Expand / collapse chevron (folders only) */}
        <span className="w-3.5 flex-none flex items-center justify-center">
          {node.type === 'folder' ? (
            node.expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )
          ) : null}
        </span>

        {/* File / folder icon */}
        <span className="flex-none">
          {node.type === 'folder' ? (
            node.expanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-amber-500" />
            )
          ) : (
            <FileIconFor name={node.name} />
          )}
        </span>

        {/* Name */}
        <span className={`truncate flex-1 ${isActive ? 'font-medium' : ''}`}>
          {node.name}
        </span>

        {/* Entry file marker */}
        {isEntry && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-none" />
            </TooltipTrigger>
            <TooltipContent>Entry file (passed to runner)</TooltipContent>
          </Tooltip>
        )}

        {/* Dirty dot (file has unsaved changes) */}
        {node.type === 'file' && node.content !== node.savedContent && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-none"
            title="Unsaved changes"
          />
        )}

        {/* Per-row context menu (file) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex-none p-0.5 rounded hover:bg-muted"
              aria-label="File actions"
            >
              <MoreVertical className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            {node.type === 'folder' && (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    createFile({ parentId: node.id, language: activeLanguage })
                  }}
                >
                  <FilePlus2 className="h-3.5 w-3.5 mr-2" /> New File
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    createFolder({ parentId: node.id })
                  }}
                >
                  <FolderPlus className="h-3.5 w-3.5 mr-2" /> New Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {node.type === 'file' && !isEntry && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setEntryFile(node.id)
                }}
              >
                <Star className="h-3.5 w-3.5 mr-2" /> Set as entry file
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                startRename()
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-2" /> Rename (F2)
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`Delete "${node.name}"?${node.type === 'folder' ? ' All contents will be removed.' : ''}`)) {
                  deleteNode(node.id)
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete (Del)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {node.type === 'folder' && node.expanded && childNodes.map((child) => (
        <TreeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Top-level toolbar                                                  */
/* ------------------------------------------------------------------ */

interface ToolbarProps {
  onCommandPalette?: () => void
}

function ExplorerToolbar({ onCommandPalette: _ }: ToolbarProps) {
  const createFile = useProjectStore((s) => s.createFile)
  const createFolder = useProjectStore((s) => s.createFolder)
  // The currently-selected language drives the default filename + extension
  // for every newly created file. This matches the active file's language
  // (which is set by clicking one of the language tabs in the header).
  const activeLanguage = useActiveLanguage()
  return (
    <div className="flex items-center justify-between px-2 py-1 border-b border-border">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Explorer
      </span>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => createFile({ language: activeLanguage })}
              aria-label="New file"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New file ({activeLanguage})</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => createFolder({})}
              aria-label="New folder"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New folder</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export interface FileExplorerProps {
  /** Called when the user picks a file from the quick-switcher (Ctrl+P). */
  onCommandPalette?: () => void
  className?: string
}

export default function FileExplorer({
  onCommandPalette,
  className,
}: FileExplorerProps) {
  // Read from the active (selected) language's project.
  const project = useActiveProject()
  const childrenByParent = project.childrenByParent
  const nodes = project.nodes
  const projectName = project.name
  const setName = useProjectStore((s) => s.setName)
  const isDirty = useProjectStore((s) => {
    const p = s.projects[s.selectedLanguage]
    return Object.values(p.nodes).some(
      (n) => n.type === 'file' && n.content !== n.savedContent,
    )
  })

  const topLevel = useMemo(
    () => (childrenByParent['root'] ?? []).map((id) => nodes[id]).filter(Boolean),
    [childrenByParent, nodes],
  )

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(projectName)

  return (
    <div className={`flex flex-col h-full bg-card/30 ${className ?? ''}`}>
      <ExplorerToolbar onCommandPalette={onCommandPalette} />

      {/* Project name (click to rename) */}
      <div className="px-2 py-1 border-b border-border">
        {editingName ? (
          <Input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => {
              if (nameInput.trim()) setName(nameInput.trim())
              setEditingName(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (nameInput.trim()) setName(nameInput.trim())
                setEditingName(false)
              } else if (e.key === 'Escape') {
                setNameInput(projectName)
                setEditingName(false)
              }
            }}
            className="h-6 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameInput(projectName)
              setEditingName(true)
            }}
            className="flex items-center gap-1.5 text-xs font-medium hover:text-emerald-500 transition-colors w-full text-left"
            title="Click to rename project"
          >
            <FileCode2 className="h-3.5 w-3.5 text-emerald-500 flex-none" />
            <span className="truncate flex-1">{projectName}</span>
            {isDirty && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-none" title="Unsaved changes" />
            )}
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {topLevel.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground px-3">
            No files yet.
            <br />
            <button
              type="button"
              onClick={() => useProjectStore.getState().createFile({ language: useProjectStore.getState().defaultLanguage })}
              className="text-emerald-500 hover:underline mt-1"
            >
              Create your first file →
            </button>
          </div>
        ) : (
          topLevel.map((node) => (
            <TreeRow key={node.id} node={node} depth={0} />
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-2 py-1 border-t border-border text-[10px] text-muted-foreground">
        <span className="font-mono">★</span> = entry file · <span className="font-mono">F2</span> rename ·{' '}
        <span className="font-mono">Del</span> remove
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Helper: language badge color for a file (used in tabs/breadcrumbs) */
/* ------------------------------------------------------------------ */

export function languageBadgeClass(lang: Language): string {
  const map: Record<Language, string> = {
    python: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    java: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    c: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    cpp: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    r: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    javascript: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    php: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    csharp: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    dart: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    flutter: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    html: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    sql: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    kotlin: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    go: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    typescript: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    rust: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    ruby: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    swift: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    lua: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    perl: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    powershell: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    bash: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    fortran: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    cobol: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  }
  return map[lang]
}

export type { FileNode, FolderNode, TreeNode }
