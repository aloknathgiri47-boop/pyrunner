'use client'

/**
 * Multi-file project store.
 *
 * This is the foundation layer for the multi-language coding platform upgrade.
 * It models a VS Code-style file tree:
 *
 *   Project
 *   ├── main.py            (entry file, marked with ★)
 *   ├── utils.py
 *   └── src/
 *       ├── helper.py
 *       └── calculator.py
 *
 * Design notes:
 * - Files and folders share the same `id` space (cuid-like string).
 * - `parentId` is null for top-level nodes, otherwise points to a folder id.
 * - The active file is the one currently shown in the editor.
 * - The entry file is the one that gets executed when Run is pressed
 *   (for Python, this is the file passed to `python3 <entry>`).
 * - All state is persisted to IndexedDB via project-persistence.ts.
 * - The store deliberately does NOT contain "user" or "auth" — that comes in
 *   Phase 2. For Phase 1, everything stays local.
 *
 * The store is intentionally framework-agnostic; React components subscribe
 * via the `useProjectStore` hook (Zustand).
 */
import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import {
  openDB, type IDBPDatabase,
} from 'idb'
import type { Language } from './languages'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type NodeType = 'file' | 'folder'

export interface FileNode {
  id: string
  type: 'file'
  name: string
  parentId: string | null
  content: string
  /** Programming language for this file (drives syntax highlighting + runner). */
  language: Language
  /** Last-saved content snapshot — used to compute "dirty" status. */
  savedContent: string
  createdAt: number
  updatedAt: number
}

export interface FolderNode {
  id: string
  type: 'folder'
  name: string
  parentId: string | null
  expanded: boolean
  createdAt: number
  updatedAt: number
}

export type TreeNode = FileNode | FolderNode

export interface ProjectState {
  /** Map of node id → node (files AND folders). */
  nodes: Record<string, TreeNode>
  /** Ordered list of child ids for each parent. Top-level: key = 'root'. */
  childrenByParent: Record<string, string[]>
  /** Currently-open file id (null = no file open). */
  activeFileId: string | null
  /** Entry file id — passed to the runner. Marked with ★ in the UI. */
  entryFileId: string | null
  /** Project name (used for downloads / future cloud save). */
  name: string
  /** Default language for new files created without an explicit extension. */
  defaultLanguage: Language
  /** Incremented every time a node changes — used as a cheap dirty flag. */
  revision: number
  /** IDB has loaded initial state. */
  hydrated: boolean
}

/* ------------------------------------------------------------------ */
/* Defaults                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_PYTHON = `# PyRunner — Python 3 playground
# Press Run (or Ctrl/Cmd+Enter) to execute.
# Add more files with the + button in the explorer →
# Set any file as the entry (★) by right-clicking it.

def greet(name: str) -> str:
    return f"Hello, {name}!"

print(greet("world"))

# Interactive: type your name in the input bar below
# the console when prompted, then press Enter.
name = input("What's your name? ")
print(f"Nice to meet you, {name}!")
`

/* ------------------------------------------------------------------ */
/* IndexedDB persistence layer                                       */
/* ------------------------------------------------------------------ */
/* We can't use the standard zustand `persist` middleware with a
 * synchronous localStorage adapter here because:
 *   1. Multi-file projects can exceed localStorage's 5 MB quota.
 *   2. We want to persist a single source of truth, not a denormalized
 *      `{ code, language }` like the legacy localStorage key.
 *
 * So we wire up a custom async `StateStorage` adapter backed by idb.
 */

const DB_NAME = 'pyrunner'
const STORE_NAME = 'project'
const DB_VERSION = 1
const KEY = 'main'

let dbPromise: Promise<IDBPDatabase> | null = null
function getDB() {
  if (typeof indexedDB === 'undefined') return null
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

const idbStorage: StateStorage = {
  async getItem(name: string) {
    const db = getDB()
    if (!db) return null
    try {
      const tx = (await db).transaction(STORE_NAME, 'readonly')
      const val = await tx.objectStore(STORE_NAME).get(name)
      return (val as string | undefined) ?? null
    } catch {
      return null
    }
  },
  async setItem(name: string, value: string) {
    const db = getDB()
    if (!db) return
    try {
      const tx = (await db).transaction(STORE_NAME, 'readwrite')
      await tx.objectStore(STORE_NAME).put(value, name)
      await tx.done
    } catch {
      /* ignore quota errors — best-effort persistence */
    }
  },
  async removeItem(name: string) {
    const db = getDB()
    if (!db) return
    try {
      const tx = (await db).transaction(STORE_NAME, 'readwrite')
      await tx.objectStore(STORE_NAME).delete(name)
      await tx.done
    } catch {
      /* ignore */
    }
  },
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function genId() {
  // Lightweight unique id — no external dep needed.
  return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

function now() {
  return Date.now()
}

/** Detect language from a filename's extension. */
export function detectLanguageFromName(name: string, fallback: Language = 'python'): Language {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, Language> = {
    py: 'python',
    java: 'java',
    c: 'c',
    h: 'c',
    cpp: 'cpp', cxx: 'cpp', cc: 'cpp', hpp: 'cpp',
    r: 'r',
    js: 'javascript', mjs: 'javascript', cjs: 'javascript',
    php: 'php',
    cs: 'csharp',
    dart: 'dart',
    html: 'html', htm: 'html',
    sql: 'sql',
    kt: 'kotlin', kts: 'kotlin',
    go: 'go',
    ts: 'typescript', tsx: 'typescript',
    rs: 'rust',
    rb: 'ruby',
    swift: 'swift',
    lua: 'lua',
    pl: 'perl',
    ps1: 'powershell',
    sh: 'bash', bash: 'bash',
    f90: 'fortran', f95: 'fortran', f: 'fortran',
    cbl: 'cobol', cob: 'cobol',
  }
  return map[ext] ?? fallback
}

/** Filename suffix for a given language (used when creating new files). */
export function defaultFilenameForLanguage(lang: Language): string {
  const map: Record<Language, string> = {
    python: 'main.py',
    java: 'Main.java',
    c: 'main.c',
    cpp: 'main.cpp',
    r: 'main.R',
    javascript: 'main.js',
    php: 'main.php',
    csharp: 'main.cs',
    dart: 'main.dart',
    flutter: 'main.dart',
    html: 'index.html',
    sql: 'main.sql',
    kotlin: 'main.kt',
    go: 'main.go',
    typescript: 'main.ts',
    rust: 'main.rs',
    ruby: 'main.rb',
    swift: 'main.swift',
    lua: 'main.lua',
    perl: 'main.pl',
    powershell: 'main.ps1',
    bash: 'script.sh',
    fortran: 'main.f90',
    cobol: 'main.cbl',
  }
  return map[lang] ?? 'main.py'
}

function sanitizeName(name: string): string {
  // Allow letters, digits, dot, dash, underscore, space. Strip path separators
  // (no / or \) and other shell-unsafe characters.
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '').trim()
  return cleaned || 'untitled'
}

function getUniqueName(
  baseName: string,
  siblings: TreeNode[],
): string {
  // If "main.py" doesn't exist among siblings, use it. Otherwise, try
  // "main_1.py", "main_2.py", etc.
  const taken = new Set(siblings.map((s) => s.name))
  if (!taken.has(baseName)) return baseName
  const dot = baseName.lastIndexOf('.')
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName
  const ext = dot > 0 ? baseName.slice(dot) : ''
  for (let i = 1; i < 1000; i++) {
    const candidate = `${stem}_${i}${ext}`
    if (!taken.has(candidate)) return candidate
  }
  return `${stem}_${Date.now()}${ext}`
}

/* ------------------------------------------------------------------ */
/* Store definition                                                   */
/* ------------------------------------------------------------------ */

interface ProjectActions {
  /** Mark store as hydrated (called after rehydrate from IDB). */
  markHydrated: () => void

  /* File / folder CRUD ------------------------------------------------ */
  createFile: (opts: {
    name?: string
    parentId?: string | null
    content?: string
    language?: Language
    makeActive?: boolean
    makeEntry?: boolean
  }) => string  // returns the new file id

  createFolder: (opts: {
    name?: string
    parentId?: string | null
  }) => string  // returns the new folder id

  renameNode: (id: string, newName: string) => void
  deleteNode: (id: string) => void
  moveNode: (id: string, newParentId: string | null) => void

  setActiveFile: (id: string | null) => void
  setEntryFile: (id: string | null) => void
  setFolderExpanded: (id: string, expanded: boolean) => void
  toggleFolderExpanded: (id: string) => void

  /** Update the active file's content (called by the editor on every keystroke). */
  setActiveFileContent: (content: string) => void

  /** Mark the active file's `savedContent` as equal to its current `content`
   *  (i.e. clear its dirty flag). Called after Save. */
  markActiveFileSaved: () => void

  /** Mark every file as saved (used after bulk operations). */
  markAllSaved: () => void

  /** Replace the entire project (used by Import / Open shared link). */
  loadProject: (snapshot: ProjectSnapshot) => void

  /** Reset to a fresh Python project. */
  resetToDefault: () => void

  /** Rename the whole project. */
  setName: (name: string) => void
}

export interface ProjectSnapshot {
  name: string
  defaultLanguage: Language
  nodes: Record<string, TreeNode>
  childrenByParent: Record<string, string[]>
  activeFileId: string | null
  entryFileId: string | null
}

/* ------------------------------------------------------------------ */
/* Initial state                                                      */
/* ------------------------------------------------------------------ */

function buildInitialProject(): ProjectState {
  const fileId = genId()
  const nodes: Record<string, TreeNode> = {
    [fileId]: {
      id: fileId,
      type: 'file',
      name: 'main.py',
      parentId: null,
      content: DEFAULT_PYTHON,
      language: 'python',
      savedContent: DEFAULT_PYTHON,
      createdAt: now(),
      updatedAt: now(),
    },
  }
  return {
    nodes,
    childrenByParent: { root: [fileId] },
    activeFileId: fileId,
    entryFileId: fileId,
    name: 'Untitled Project',
    defaultLanguage: 'python',
    revision: 0,
    hydrated: false,
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                              */
/* ------------------------------------------------------------------ */

export const useProjectStore = create<ProjectState & ProjectActions>()(
  persist(
    (set, get) => ({
      ...buildInitialProject(),

      markHydrated: () => set({ hydrated: true }),

      createFile: ({
        name,
        parentId = null,
        content = '',
        language,
        makeActive = true,
        makeEntry = false,
      }) => {
        const state = get()
        const parentKey = parentId ?? 'root'
        const siblings = (state.childrenByParent[parentKey] ?? [])
          .map((id) => state.nodes[id])
          .filter(Boolean)
        const finalName = sanitizeName(
          name || defaultFilenameForLanguage(language ?? state.defaultLanguage),
        )
        const uniqueName = getUniqueName(finalName, siblings)
        const detectedLang = language ?? detectLanguageFromName(uniqueName, state.defaultLanguage)
        const id = genId()
        const ts = now()
        const newNode: FileNode = {
          id,
          type: 'file',
          name: uniqueName,
          parentId,
          content,
          language: detectedLang,
          savedContent: content,
          createdAt: ts,
          updatedAt: ts,
        }
        set((s) => ({
          nodes: { ...s.nodes, [id]: newNode },
          childrenByParent: {
            ...s.childrenByParent,
            [parentKey]: [...(s.childrenByParent[parentKey] ?? []), id],
          },
          activeFileId: makeActive ? id : s.activeFileId,
          entryFileId: makeEntry ? id : s.entryFileId,
          revision: s.revision + 1,
        }))
        return id
      },

      createFolder: ({ name, parentId = null }) => {
        const state = get()
        const parentKey = parentId ?? 'root'
        const siblings = (state.childrenByParent[parentKey] ?? [])
          .map((id) => state.nodes[id])
          .filter(Boolean)
        const finalName = sanitizeName(name || 'New Folder')
        const uniqueName = getUniqueName(finalName, siblings)
        const id = genId()
        const ts = now()
        const newNode: FolderNode = {
          id,
          type: 'folder',
          name: uniqueName,
          parentId,
          expanded: true,
          createdAt: ts,
          updatedAt: ts,
        }
        set((s) => ({
          nodes: { ...s.nodes, [id]: newNode },
          childrenByParent: {
            ...s.childrenByParent,
            [parentKey]: [...(s.childrenByParent[parentKey] ?? []), id],
            [id]: [],
          },
          revision: s.revision + 1,
        }))
        return id
      },

      renameNode: (id, newName) => {
        const cleaned = sanitizeName(newName)
        if (!cleaned) return
        set((s) => {
          const node = s.nodes[id]
          if (!node) return s
          return {
            nodes: {
              ...s.nodes,
              [id]: { ...node, name: cleaned, updatedAt: now() },
            },
            revision: s.revision + 1,
          }
        })
      },

      deleteNode: (id) => {
        set((s) => {
          const node = s.nodes[id]
          if (!node) return s
          const parentKey = node.parentId ?? 'root'
          const newNodes = { ...s.nodes }
          const newChildren = { ...s.childrenByParent }

          // Recursively collect all descendant ids (for folders).
          const toDelete: string[] = [id]
          const stack = [id]
          while (stack.length) {
            const cur = stack.pop()!
            const kids = newChildren[cur] ?? []
            for (const k of kids) {
              toDelete.push(k)
              stack.push(k)
            }
          }
          for (const d of toDelete) {
            delete newNodes[d]
            delete newChildren[d]
          }
          newChildren[parentKey] = (newChildren[parentKey] ?? []).filter((x) => x !== id)

          // If we deleted the active file, pick the next available file.
          let newActive = s.activeFileId
          if (toDelete.includes(s.activeFileId ?? '')) {
            const allFiles = Object.values(newNodes).filter((n) => n.type === 'file') as FileNode[]
            newActive = allFiles[0]?.id ?? null
          }
          let newEntry = s.entryFileId
          if (toDelete.includes(s.entryFileId ?? '')) {
            const allFiles = Object.values(newNodes).filter((n) => n.type === 'file') as FileNode[]
            newEntry = allFiles[0]?.id ?? null
          }

          return {
            nodes: newNodes,
            childrenByParent: newChildren,
            activeFileId: newActive,
            entryFileId: newEntry,
            revision: s.revision + 1,
          }
        })
      },

      moveNode: (id, newParentId) => {
        set((s) => {
          const node = s.nodes[id]
          if (!node) return s
          if (id === newParentId) return s // can't move into self
          // Prevent moving a folder into its own descendant.
          let cur: string | null = newParentId
          while (cur) {
            if (cur === id) return s
            cur = s.nodes[cur]?.parentId ?? null
          }
          const oldParentKey = node.parentId ?? 'root'
          const newParentKey = newParentId ?? 'root'
          if (oldParentKey === newParentKey) return s
          return {
            nodes: {
              ...s.nodes,
              [id]: { ...node, parentId: newParentId, updatedAt: now() },
            },
            childrenByParent: {
              ...s.childrenByParent,
              [oldParentKey]: (s.childrenByParent[oldParentKey] ?? []).filter((x) => x !== id),
              [newParentKey]: [...(s.childrenByParent[newParentKey] ?? []), id],
            },
            revision: s.revision + 1,
          }
        })
      },

      setActiveFile: (id) => set({ activeFileId: id, revision: get().revision + 1 }),

      setEntryFile: (id) => set({ entryFileId: id, revision: get().revision + 1 }),

      setFolderExpanded: (id, expanded) => {
        set((s) => {
          const node = s.nodes[id]
          if (!node || node.type !== 'folder') return s
          return {
            nodes: { ...s.nodes, [id]: { ...node, expanded } },
            revision: s.revision + 1,
          }
        })
      },

      toggleFolderExpanded: (id) => {
        set((s) => {
          const node = s.nodes[id]
          if (!node || node.type !== 'folder') return s
          return {
            nodes: { ...s.nodes, [id]: { ...node, expanded: !node.expanded } },
            revision: s.revision + 1,
          }
        })
      },

      setActiveFileContent: (content) => {
        set((s) => {
          if (!s.activeFileId) return s
          const node = s.nodes[s.activeFileId]
          if (!node || node.type !== 'file') return s
          if (node.content === content) return s // no-op
          return {
            nodes: {
              ...s.nodes,
              [node.id]: { ...node, content, updatedAt: now() },
            },
            revision: s.revision + 1,
          }
        })
      },

      markActiveFileSaved: () => {
        set((s) => {
          if (!s.activeFileId) return s
          const node = s.nodes[s.activeFileId]
          if (!node || node.type !== 'file') return s
          return {
            nodes: {
              ...s.nodes,
              [node.id]: { ...node, savedContent: node.content },
            },
          }
        })
      },

      markAllSaved: () => {
        set((s) => {
          const newNodes = { ...s.nodes }
          for (const id in newNodes) {
            const n = newNodes[id]
            if (n.type === 'file') {
              newNodes[id] = { ...n, savedContent: n.content }
            }
          }
          return { nodes: newNodes }
        })
      },

      loadProject: (snapshot) => {
        set({
          ...snapshot,
          revision: get().revision + 1,
          hydrated: true,
        })
      },

      resetToDefault: () => {
        const fresh = buildInitialProject()
        set({
          ...fresh,
          revision: get().revision + 1,
          hydrated: true,
        })
      },

      setName: (name) => set({ name, revision: get().revision + 1 }),
    }),
    {
      name: 'pyrunner-project',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        nodes: s.nodes,
        childrenByParent: s.childrenByParent,
        activeFileId: s.activeFileId,
        entryFileId: s.entryFileId,
        name: s.name,
        defaultLanguage: s.defaultLanguage,
      }),
      onRehydrateStorage: () => (state) => {
        // Mark as hydrated once IDB has loaded the saved state.
        if (state) state.markHydrated()
      },
    },
  ),
)

/* ------------------------------------------------------------------ */
/* Selector helpers                                                   */
/* ------------------------------------------------------------------ */

/** Get the currently active file node (or null). */
export function useActiveFile(): FileNode | null {
  return useProjectStore((s) => {
    if (!s.activeFileId) return null
    const n = s.nodes[s.activeFileId]
    return n && n.type === 'file' ? n : null
  })
}

/** Get the entry file node (or null). Falls back to the active file if no entry is set. */
export function useEntryFile(): FileNode | null {
  return useProjectStore((s) => {
    const id = s.entryFileId ?? s.activeFileId
    if (!id) return null
    const n = s.nodes[id]
    return n && n.type === 'file' ? n : null
  })
}

/** Get a flat list of all files (for export / search / runner payload). */
export function useAllFiles(): FileNode[] {
  return useProjectStore((s) =>
    Object.values(s.nodes).filter((n): n is FileNode => n.type === 'file'),
  )
}

/** Get the language of the active file (used to drive the editor + runner). */
export function useActiveLanguage(): Language {
  return useProjectStore((s) => {
    if (!s.activeFileId) return s.defaultLanguage
    const n = s.nodes[s.activeFileId]
    return n && n.type === 'file' ? n.language : s.defaultLanguage
  })
}

/** True if any file has unsaved changes (dirty flag). */
export function useIsDirty(): boolean {
  return useProjectStore((s) => {
    for (const id in s.nodes) {
      const n = s.nodes[id]
      if (n.type === 'file' && n.content !== n.savedContent) return true
    }
    return false
  })
}

/** Get a snapshot of the entire project (for export / share / save). */
export function getProjectSnapshot(): ProjectSnapshot {
  const s = useProjectStore.getState()
  return {
    name: s.name,
    defaultLanguage: s.defaultLanguage,
    nodes: s.nodes,
    childrenByParent: s.childrenByParent,
    activeFileId: s.activeFileId,
    entryFileId: s.entryFileId,
  }
}

/** Build a flat `path → content` map of all files for the runner.
 *  Paths include folder prefixes, e.g. `src/helper.py`. */
export function getFilesForRunner(): Record<string, string> {
  const s = useProjectStore.getState()
  const out: Record<string, string> = {}
  for (const id in s.nodes) {
    const n = s.nodes[id]
    if (n.type !== 'file') continue
    const path = buildPath(s.nodes, id)
    out[path] = n.content
  }
  return out
}

/** Build the slash-joined path for a node, e.g. `src/helper.py`. */
export function buildPath(
  nodes: Record<string, TreeNode>,
  id: string,
): string {
  const parts: string[] = []
  let cur: string | null = id
  while (cur) {
    const n = nodes[cur]
    if (!n) break
    parts.unshift(n.name)
    cur = n.parentId
  }
  return parts.join('/')
}

/** Get the path of the entry file (or active file as fallback). */
export function getEntryFilePath(): string | null {
  const s = useProjectStore.getState()
  const id = s.entryFileId ?? s.activeFileId
  if (!id) return null
  const n = s.nodes[id]
  if (!n || n.type !== 'file') return null
  return buildPath(s.nodes, id)
}
