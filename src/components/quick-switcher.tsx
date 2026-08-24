'use client'

/**
 * Quick file switcher — VS Code "Ctrl+P" style.
 *
 * Shows a centered command-palette-style dialog with a fuzzy-filtered
 * list of all files in the project. Selecting a file activates it.
 *
 * Also exposes a search/replace mode (Ctrl+F / Ctrl+H) — left for
 * Phase 3; the dialog here is file-switching only.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { File as FileIcon, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useProjectStore, buildPath } from '@/lib/project-store'
import { FileIconFor } from './file-explorer'

export interface QuickSwitcherProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Entry {
  id: string
  name: string
  path: string
}

/** Lightweight fuzzy match: returns score (>0 = match) or -1. */
function fuzzyMatch(query: string, target: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (t.includes(q)) {
    // Prefer matches near the start of the filename.
    const idx = t.indexOf(q)
    return 100 - Math.min(idx, 50)
  }
  // Walk through query chars in order.
  let score = 0
  let ti = 0
  let lastMatchIdx = -1
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi]
    let found = -1
    for (let i = ti; i < t.length; i++) {
      if (t[i] === c) { found = i; break }
    }
    if (found === -1) return -1
    score += 10
    if (lastMatchIdx !== -1 && found === lastMatchIdx + 1) score += 5
    lastMatchIdx = found
    ti = found + 1
  }
  return score
}

export default function QuickSwitcher({ open, onOpenChange }: QuickSwitcherProps) {
  // Read from the active (selected) language's project.
  const nodes = useProjectStore((s) => s.projects[s.selectedLanguage].nodes)
  const setActiveFile = useProjectStore((s) => s.setActiveFile)
  const [query, setQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset highlight to top whenever the query changes.
  // We use a useEffect here because (a) the highlight state genuinely depends
  // on the query, and (b) setting it during render would cause cascading renders.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightIdx(0)
  }, [query, open])

  // Build the list of entries (memoized; only re-derives when nodes change).
  const allEntries = useMemo<Entry[]>(() => {
    const out: Entry[] = []
    for (const id in nodes) {
      const n = nodes[id]
      if (n.type !== 'file') continue
      out.push({
        id,
        name: n.name,
        path: buildPath(nodes, id),
      })
    }
    return out.sort((a, b) => a.path.localeCompare(b.path))
  }, [nodes])

  // Filter by query.
  const filtered = useMemo(() => {
    if (!query.trim()) return allEntries.slice(0, 50)
    const scored = allEntries
      .map((e) => {
        // Match against the path, but favor filename matches.
        const nameScore = fuzzyMatch(query, e.name)
        const pathScore = fuzzyMatch(query, e.path)
        const score = Math.max(nameScore * 2, pathScore)
        return { e, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((x) => x.e)
    return scored
  }, [allEntries, query])

  useEffect(() => {
    if (open) {
      // Clear the query when opening — defer to next tick so the input is mounted.
      setTimeout(() => {
        setQuery('')
        inputRef.current?.focus()
      }, 30)
    }
  }, [open])

  // Keyboard navigation inside the dialog.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const entry = filtered[highlightIdx]
      if (entry) {
        setActiveFile(entry.id)
        onOpenChange(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onOpenChange(false)
    }
  }

  // Scroll the highlighted row into view.
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${highlightIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick file switcher</DialogTitle>
          <DialogDescription>
            Type to filter, arrow keys to navigate, Enter to open.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search files by name... (Ctrl+P)"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded border border-border">
            ↵ open
          </kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No files match "{query}"
            </div>
          ) : (
            filtered.map((entry, idx) => (
              <button
                key={entry.id}
                type="button"
                data-idx={idx}
                onMouseEnter={() => setHighlightIdx(idx)}
                onClick={() => {
                  setActiveFile(entry.id)
                  onOpenChange(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  idx === highlightIdx
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'hover:bg-muted/60'
                }`}
              >
                <FileIconFor name={entry.name} />
                <span className="truncate font-medium">{entry.name}</span>
                <span className="truncate text-xs text-muted-foreground ml-auto">
                  {entry.path !== entry.name ? entry.path : ''}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
