'use client'

/**
 * Per-language project store.
 *
 * Every supported language gets its own completely isolated workspace:
 *
 *   projects.python  → main.py, utils.py, src/...
 *   projects.java    → Main.java, Helper.java, ...
 *   projects.cpp     → main.cpp, utils.cpp, ...
 *   projects.javascript → main.js, helpers.js, ...
 *   ... (24 languages total)
 *
 * The `selectedLanguage` field decides which project is "active" —
 * the FileExplorer, editor, and Run button all operate on the active
 * project's files. Switching language tabs swaps the active project
 * instantly, without mixing/deleting/renaming files across languages.
 *
 * Each language project starts with its own default entry file
 * (e.g. Python → main.py, Java → Main.java, C# → Program.cs).
 *
 * Design notes:
 * - Per-language state is stored in `projects: Record<Language, LanguageProject>`.
 * - All file/folder actions (createFile, renameNode, etc.) operate on
 *   `state.projects[state.selectedLanguage]` — the active project.
 * - Switching languages is just `setSelectedLanguage(lang)` — a single
 *   field update that causes all selectors to return the new project's data.
 * - The store is persisted to IndexedDB via Zustand's persist middleware.
 * - Migration: if the persisted state is in the old single-project format
 *   (version 0), it's migrated to the new per-language format by placing
 *   the old data into the Python project.
 */
import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { openDB, type IDBPDatabase } from 'idb'
import type { Language } from './languages'
import { ALL_LANGUAGES } from './languages'
import { getDefaultCode } from './default-code'

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

/**
 * A single language's isolated workspace.
 * Each language has its own set of files, folders, active file, entry file,
 * and project name — completely independent of other languages.
 */
export interface LanguageProject {
  /** Display name for this language's project (e.g. "Python Project"). */
  name: string
  /** Map of node id → node (files AND folders) for this language only. */
  nodes: Record<string, TreeNode>
  /** Ordered list of child ids for each parent. Top-level: key = 'root'. */
  childrenByParent: Record<string, string[]>
  /** Currently-open file id within this language's project. */
  activeFileId: string | null
  /** Entry file id — passed to the runner. Marked with ★. */
  entryFileId: string | null
}

export interface ProjectState {
  /** Per-language isolated workspaces. Keyed by Language. */
  projects: Record<Language, LanguageProject>
  /** The currently-selected language. Determines which project is "active". */
  selectedLanguage: Language
  /** Default language (used for first-time load and fallback). */
  defaultLanguage: Language
  /** Incremented every time a node changes — cheap dirty flag. */
  revision: number
  /** IDB has loaded initial state. */
  hydrated: boolean
}

/* ------------------------------------------------------------------ */
/* IndexedDB persistence layer                                       */
/* ------------------------------------------------------------------ */

const DB_NAME = 'pyrunner'
const STORE_NAME = 'project'
const DB_VERSION = 2  // Bumped from 1 for the per-language migration
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

/** Filename suffix for a given language (used when creating new files).
 *
 *  This map drives the "New file" button — when the active file is, say,
 *  a Java file, clicking "New file" creates `Main_1.java` (auto-incremented
 *  to avoid clashing with any existing `Main.java`).
 *
 *  Existing files are NEVER renamed automatically — this map is only
 *  consulted when a new file is created without an explicit name.
 */
export function defaultFilenameForLanguage(lang: Language): string {
  const map: Record<Language, string> = {
    python: 'main.py',
    java: 'Main.java',
    c: 'main.c',
    cpp: 'main.cpp',
    r: 'main.r',
    javascript: 'main.js',
    php: 'main.php',
    csharp: 'Program.cs',
    dart: 'main.dart',
    flutter: 'main.dart',
    html: 'index.html',
    sql: 'main.sql',
    kotlin: 'Main.kt',
    go: 'main.go',
    typescript: 'main.ts',
    rust: 'main.rs',
    ruby: 'main.rb',
    swift: 'main.swift',
    lua: 'main.lua',
    perl: 'main.pl',
    powershell: 'main.ps1',
    bash: 'main.sh',
    fortran: 'main.f90',
    cobol: 'main.cob',
  }
  return map[lang] ?? 'main.py'
}

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '').trim()
  return cleaned || 'untitled'
}

function getUniqueName(
  baseName: string,
  siblings: TreeNode[],
): string {
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

/** Build a fresh default project for a single language. */
function buildDefaultLanguageProject(lang: Language): LanguageProject {
  const fileName = defaultFilenameForLanguage(lang)
  const starterCode = getDefaultCode(lang)
  const fileId = genId()
  const ts = now()
  const nodes: Record<string, TreeNode> = {
    [fileId]: {
      id: fileId,
      type: 'file',
      name: fileName,
      parentId: null,
      content: starterCode,
      language: lang,
      savedContent: starterCode,
      createdAt: ts,
      updatedAt: ts,
    },
  }
  return {
    name: `${lang.charAt(0).toUpperCase() + lang.slice(1)} Project`,
    nodes,
    childrenByParent: { root: [fileId] },
    activeFileId: fileId,
    entryFileId: fileId,
  }
}

/** Build the initial per-language projects map (one project per language). */
function buildInitialProjects(): Record<Language, LanguageProject> {
  const projects = {} as Record<Language, LanguageProject>
  for (const lang of ALL_LANGUAGES) {
    projects[lang] = buildDefaultLanguageProject(lang)
  }
  return projects
}

/* ------------------------------------------------------------------ */
/* Store actions                                                      */
/* ------------------------------------------------------------------ */

interface ProjectActions {
  /** Mark store as hydrated (called after rehydrate from IDB). */
  markHydrated: () => void

  /** Switch the active language project. The FileExplorer + editor will
   *  immediately reflect the new language's files. */
  setSelectedLanguage: (lang: Language) => void

  /* File / folder CRUD — all operate on the selected language's project -- */
  createFile: (opts: {
    name?: string
    parentId?: string | null
    content?: string
    language?: Language
    makeActive?: boolean
    makeEntry?: boolean
  }) => string

  createFolder: (opts: {
    name?: string
    parentId?: string | null
  }) => string

  renameNode: (id: string, newName: string) => void
  deleteNode: (id: string) => void
  moveNode: (id: string, newParentId: string | null) => void

  setActiveFile: (id: string | null) => void
  setEntryFile: (id: string | null) => void
  setFolderExpanded: (id: string, expanded: boolean) => void
  toggleFolderExpanded: (id: string) => void

  /** Update the active file's content (called by the editor on every keystroke). */
  setActiveFileContent: (content: string) => void

  /** Update the active file's language tag (rarely needed — usually the
   *  language is determined by the project it belongs to). */
  setActiveFileLanguage: (lang: Language) => void

  /** Mark the active file's `savedContent` as equal to its current `content`. */
  markActiveFileSaved: () => void

  /** Mark every file in the active project as saved. */
  markAllSaved: () => void

  /** Replace the active project's state (used by Import / Open shared link). */
  loadProject: (snapshot: ProjectSnapshot) => void

  /** Reset the active language's project to its default state. */
  resetToDefault: () => void

  /** Rename the active language's project. */
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
/* Store                                                              */
/* ------------------------------------------------------------------ */

export const useProjectStore = create<ProjectState & ProjectActions>()(
  persist(
    (set, get) => ({
      projects: buildInitialProjects(),
      selectedLanguage: 'python',
      defaultLanguage: 'python',
      revision: 0,
      hydrated: false,

      markHydrated: () => set({ hydrated: true }),

      setSelectedLanguage: (lang) => {
        set((s) => {
          if (s.selectedLanguage === lang) return s
          return { selectedLanguage: lang, revision: s.revision + 1 }
        })
      },

      createFile: ({
        name,
        parentId = null,
        content = '',
        language,
        makeActive = true,
        makeEntry = false,
      }) => {
        const state = get()
        const proj = state.projects[state.selectedLanguage]
        const parentKey = parentId ?? 'root'
        const siblings = (proj.childrenByParent[parentKey] ?? [])
          .map((id) => proj.nodes[id])
          .filter(Boolean)
        // Default to the selected language (not the `language` param) so
        // every file created in the Python project is a .py file, every
        // file in the Java project is a .java file, etc.
        const effectiveLang = state.selectedLanguage
        const finalName = sanitizeName(
          name || defaultFilenameForLanguage(effectiveLang),
        )
        const uniqueName = getUniqueName(finalName, siblings)
        const detectedLang = language ?? effectiveLang
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
        set((s) => {
          const p = s.projects[s.selectedLanguage]
          return {
            projects: {
              ...s.projects,
              [s.selectedLanguage]: {
                ...p,
                nodes: { ...p.nodes, [id]: newNode },
                childrenByParent: {
                  ...p.childrenByParent,
                  [parentKey]: [...(p.childrenByParent[parentKey] ?? []), id],
                },
                activeFileId: makeActive ? id : p.activeFileId,
                entryFileId: makeEntry ? id : p.entryFileId,
              },
            },
            revision: s.revision + 1,
          }
        })
        return id
      },

      createFolder: ({ name, parentId = null }) => {
        const state = get()
        const proj = state.projects[state.selectedLanguage]
        const parentKey = parentId ?? 'root'
        const siblings = (proj.childrenByParent[parentKey] ?? [])
          .map((id) => proj.nodes[id])
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
        set((s) => {
          const p = s.projects[s.selectedLanguage]
          return {
            projects: {
              ...s.projects,
              [s.selectedLanguage]: {
                ...p,
                nodes: { ...p.nodes, [id]: newNode },
                childrenByParent: {
                  ...p.childrenByParent,
                  [parentKey]: [...(p.childrenByParent[parentKey] ?? []), id],
                  [id]: [],
                },
              },
            },
            revision: s.revision + 1,
          }
        })
        return id
      },

      renameNode: (id, newName) => {
        const cleaned = sanitizeName(newName)
        if (!cleaned) return
        set((s) => {
          const p = s.projects[s.selectedLanguage]
          const node = p.nodes[id]
          if (!node) return s
          return {
            projects: {
              ...s.projects,
              [s.selectedLanguage]: {
                ...p,
                nodes: {
                  ...p.nodes,
                  [id]: { ...node, name: cleaned, updatedAt: now() },
                },
              },
            },
            revision: s.revision + 1,
          }
        })
      },

      deleteNode: (id) => {
        set((s) => {
          const p = s.projects[s.selectedLanguage]
          const node = p.nodes[id]
          if (!node) return s
          const parentKey = node.parentId ?? 'root'
          const newNodes = { ...p.nodes }
          const newChildren = { ...p.childrenByParent }

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

          let newActive = p.activeFileId
          if (toDelete.includes(p.activeFileId ?? '')) {
            const allFiles = Object.values(newNodes).filter((n) => n.type === 'file') as FileNode[]
            newActive = allFiles[0]?.id ?? null
          }
          let newEntry = p.entryFileId
          if (toDelete.includes(p.entryFileId ?? '')) {
            const allFiles = Object.values(newNodes).filter((n) => n.type === 'file') as FileNode[]
            newEntry = allFiles[0]?.id ?? null
          }

          return {
            projects: {
              ...s.projects,
              [s.selectedLanguage]: {
                ...p,
                nodes: newNodes,
                childrenByParent: newChildren,
                activeFileId: newActive,
                entryFileId: newEntry,
              },
            },
            revision: s.revision + 1,
          }
        })
      },

      moveNode: (id, newParentId) => {
        set((s) => {
          const p = s.projects[s.selectedLanguage]
          const node = p.nodes[id]
          if (!node) return s
          if (id === newParentId) return s
          // Prevent moving a folder into its own descendant.
          let cur: string | null = newParentId
          while (cur) {
            if (cur === id) return s
            cur = p.nodes[cur]?.parentId ?? null
          }
          const oldParentKey = node.parentId ?? 'root'
          const newParentKey = newParentId ?? 'root'
          if (oldParentKey === newParentKey) return s
          return {
            projects: {
              ...s.projects,
              [s.selectedLanguage]: {
                ...p,
                nodes: {
                  ...p.nodes,
                  [id]: { ...node, parentId: newParentId, updatedAt: now() },
                },
                childrenByParent: {
                  ...p.childrenByParent,
                  [oldParentKey]: (p.childrenByParent[oldParentKey] ?? []).filter((x) => x !== id),
                  [newParentKey]: [...(p.childrenByParent[newParentKey] ?? []), id],
                },
              },
            },
            revision: s.revision + 1,
          }
        })
      },

      setActiveFile: (id) => set((s) => {
        const p = s.projects[s.selectedLanguage]
        return {
          projects: {
            ...s.projects,
            [s.selectedLanguage]: { ...p, activeFileId: id },
          },
          revision: s.revision + 1,
        }
      }),

      setEntryFile: (id) => set((s) => {
        const p = s.projects[s.selectedLanguage]
        return {
          projects: {
            ...s.projects,
            [s.selectedLanguage]: { ...p, entryFileId: id },
          },
          revision: s.revision + 1,
        }
      }),

      setFolderExpanded: (id, expanded) => {
        set((s) => {
          const p = s.projects[s.selectedLanguage]
          const node = p.nodes[id]
          if (!node || node.type !== 'folder') return s
          return {
            projects: {
              ...s.projects,
              [s.selectedLanguage]: {
                ...p,
                nodes: { ...p.nodes, [id]: { ...node, expanded } },
              },
            },
            revision: s.revision + 1,
          }
        })
      },

      toggleFolderExpanded: (id) => {
        set((s) => {
          const p = s.projects[s.selectedLanguage]
          const node = p.nodes[id]
          if (!node || node.type !== 'folder') return s
          return {
            projects: {
              ...s.projects,
              [s.selectedLanguage]: {
                ...p,
                nodes: { ...p.nodes, [id]: { ...node, expanded: !node.expanded } },
              },
            },
            revision: s.revision + 1,
          }
        })
      },

      setActiveFileContent: (content) => {
        set((s) => {
          const p = s.projects[s.selectedLanguage]
          if (!p.activeFileId) return s
          const node = p.nodes[p.activeFileId]
          if (!node || node.type !== 'file') return s
          if (node.content === content) return s
          return {
            projects: {
              ...s.projects,
              [s.selectedLanguage]: {
                ...p,
                nodes: {
                  ...p.nodes,
                  [node.id]: { ...node, content, updatedAt: now() },
                },
              },
            },
            revision: s.revision + 1,
          }
        })
      },

      setActiveFileLanguage: (lang) => {
        set((s) => {
          const p = s.projects[s.selectedLanguage]
          if (!p.activeFileId) return s
          const node = p.nodes[p.activeFileId]
          if (!node || node.type !== 'file') return s
          return {
            projects: {
              ...s.projects,
              [s.selectedLanguage]: {
                ...p,
                nodes: {
                  ...p.nodes,
                  [node.id]: { ...node, language: lang },
                },
              },
            },
            revision: s.revision + 1,
          }
        })
      },

      markActiveFileSaved: () => {
        set((s) => {
          const p = s.projects[s.selectedLanguage]
          if (!p.activeFileId) return s
          const node = p.nodes[p.activeFileId]
          if (!node || node.type !== 'file') return s
          return {
            projects: {
              ...s.projects,
              [s.selectedLanguage]: {
                ...p,
                nodes: {
                  ...p.nodes,
                  [node.id]: { ...node, savedContent: node.content },
                },
              },
            },
          }
        })
      },

      markAllSaved: () => {
        set((s) => {
          const p = s.projects[s.selectedLanguage]
          const newNodes = { ...p.nodes }
          for (const id in newNodes) {
            const n = newNodes[id]
            if (n.type === 'file') {
              newNodes[id] = { ...n, savedContent: n.content }
            }
          }
          return {
            projects: {
              ...s.projects,
              [s.selectedLanguage]: { ...p, nodes: newNodes },
            },
          }
        })
      },

      loadProject: (snapshot) => {
        set((s) => ({
          projects: {
            ...s.projects,
            [s.selectedLanguage]: {
              name: snapshot.name,
              nodes: snapshot.nodes,
              childrenByParent: snapshot.childrenByParent,
              activeFileId: snapshot.activeFileId,
              entryFileId: snapshot.entryFileId,
            },
          },
          revision: s.revision + 1,
          hydrated: true,
        }))
      },

      resetToDefault: () => {
        set((s) => ({
          projects: {
            ...s.projects,
            [s.selectedLanguage]: buildDefaultLanguageProject(s.selectedLanguage),
          },
          revision: s.revision + 1,
          hydrated: true,
        }))
      },

      setName: (name) => set((s) => {
        const p = s.projects[s.selectedLanguage]
        return {
          projects: {
            ...s.projects,
            [s.selectedLanguage]: { ...p, name },
          },
          revision: s.revision + 1,
        }
      }),
    }),
    {
      name: 'pyrunner-project',
      version: 2,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        projects: s.projects,
        selectedLanguage: s.selectedLanguage,
        defaultLanguage: s.defaultLanguage,
      }),
      /** Migrate old single-project format (version 1) to per-language format. */
      migrate: (persistedState: any, version: number) => {
        // version 1 = old format with top-level nodes/childrenByParent/etc.
        // version 2 = new per-language format.
        if (version < 2 && persistedState && typeof persistedState === 'object') {
          const old = persistedState as any
          const lang: Language = old.defaultLanguage ?? 'python'
          // Build a fresh per-language projects map.
          const projects = buildInitialProjects()
          // If the old state had a single project, migrate it into the
          // matching language's project (overwriting the default).
          if (old.nodes && Object.keys(old.nodes).length > 0) {
            projects[lang] = {
              name: old.name ?? `${lang.charAt(0).toUpperCase() + lang.slice(1)} Project`,
              nodes: old.nodes,
              childrenByParent: old.childrenByParent ?? { root: [] },
              activeFileId: old.activeFileId ?? null,
              entryFileId: old.entryFileId ?? null,
            }
          }
          return {
            projects,
            selectedLanguage: lang,
            defaultLanguage: lang,
          }
        }
        return persistedState as ProjectState
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.markHydrated()
      },
    },
  ),
)

// Expose the store on window for debugging + automated testing.
// This lets Playwright tests drive the store directly without going through
// the UI (which is fragile for multi-file setup: rename inputs, menu navigation, etc.).
if (typeof window !== 'undefined') {
  ;(window as any).__projectStore = useProjectStore
}

/* ------------------------------------------------------------------ */
/* Selector helpers                                                   */
/* ------------------------------------------------------------------ */

/** Get the active (selected) language's project. */
export function useActiveProject(): LanguageProject {
  return useProjectStore((s) => s.projects[s.selectedLanguage])
}

/** Get the currently active file node (or null) from the selected project. */
export function useActiveFile(): FileNode | null {
  return useProjectStore((s) => {
    const p = s.projects[s.selectedLanguage]
    if (!p.activeFileId) return null
    const n = p.nodes[p.activeFileId]
    return n && n.type === 'file' ? n : null
  })
}

/** Get the entry file node (or null). Falls back to the active file. */
export function useEntryFile(): FileNode | null {
  return useProjectStore((s) => {
    const p = s.projects[s.selectedLanguage]
    const id = p.entryFileId ?? p.activeFileId
    if (!id) return null
    const n = p.nodes[id]
    return n && n.type === 'file' ? n : null
  })
}

/** Get a flat list of all files in the selected language's project. */
export function useAllFiles(): FileNode[] {
  return useProjectStore((s) =>
    Object.values(s.projects[s.selectedLanguage].nodes).filter(
      (n): n is FileNode => n.type === 'file',
    ),
  )
}

/** Get the language of the active file (= the selected language). */
export function useActiveLanguage(): Language {
  return useProjectStore((s) => s.selectedLanguage)
}

/** True if any file in the selected project has unsaved changes. */
export function useIsDirty(): boolean {
  return useProjectStore((s) => {
    const p = s.projects[s.selectedLanguage]
    for (const id in p.nodes) {
      const n = p.nodes[id]
      if (n.type === 'file' && n.content !== n.savedContent) return true
    }
    return false
  })
}

/** Get a snapshot of the active project (for export / share / save). */
export function getProjectSnapshot(): ProjectSnapshot {
  const s = useProjectStore.getState()
  const p = s.projects[s.selectedLanguage]
  return {
    name: p.name,
    defaultLanguage: s.defaultLanguage,
    nodes: p.nodes,
    childrenByParent: p.childrenByParent,
    activeFileId: p.activeFileId,
    entryFileId: p.entryFileId,
  }
}

/** Build a flat `path → content` map of all files in the active project. */
export function getFilesForRunner(): Record<string, string> {
  const s = useProjectStore.getState()
  const p = s.projects[s.selectedLanguage]
  const out: Record<string, string> = {}
  for (const id in p.nodes) {
    const n = p.nodes[id]
    if (n.type !== 'file') continue
    const path = buildPath(p.nodes, id)
    out[path] = n.content
  }
  return out
}

/** Build the slash-joined path for a node within a project. */
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

/** Get the path of the entry file (or active file as fallback) in the active project. */
export function getEntryFilePath(): string | null {
  const s = useProjectStore.getState()
  const p = s.projects[s.selectedLanguage]
  const id = p.entryFileId ?? p.activeFileId
  if (!id) return null
  const n = p.nodes[id]
  if (!n || n.type !== 'file') return null
  return buildPath(p.nodes, id)
}

export type { Language }
