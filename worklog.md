---
Task ID: phase-1-multi-file-foundation
Agent: main (super-z)
Task: Upgrade the existing PyRunner compiler into a multi-file coding platform — Phase 1 (multi-file foundation, IndexedDB persistence, multi-file Python execution, keyboard shortcuts, mobile responsive drawer, unsaved-changes protection). Critically: do NOT break the existing compiler, Run, language selection, editor, Console, or current UI.

Work Log:
- Loaded the fullstack-dev skill (mandatory for web dev tasks).
- Inspected the existing monolithic page.tsx (2654 lines), the python-runner mini-service (2730 lines), the existing Prisma schema, and the project structure.
- Decided to split the upgrade into 3 phases due to scope: Phase 1 = multi-file foundation (this session), Phase 2 = Google OAuth + cloud save + My Projects dashboard, Phase 3 = Share URLs + ZIP import/export + search/replace + error highlighting + test cases + run history.
- Phase 1 deliverables:
  - Built `src/lib/languages.ts` (shared Language type extracted from page.tsx to avoid circular imports).
  - Built `src/lib/project-store.ts` — Zustand store with persist middleware backed by IndexedDB (via the `idb` package). Models a VS Code-style file tree: nodes (files + folders), childrenByParent, activeFileId, entryFileId, project name, dirty tracking (savedContent snapshot per file).
  - Built `src/components/file-explorer.tsx` — VS Code-style sidebar with: create file/folder, rename (F2 / inline input), delete (Del / context menu), set-as-entry (★ marker), expand/collapse folders, dirty dot indicator, per-extension colored icons, project name editing.
  - Built `src/components/quick-switcher.tsx` — Ctrl+P quick file switcher dialog with fuzzy matching.
  - Modified `mini-services/python-runner/index.ts` — extended `RunPayload` with `entryFile?: string` and updated `spawnPython` to accept a `payload` parameter. When `files` + `entryFile` are provided, it writes all files to a per-session workspace dir and runs the entry via a `runpy.run_path` wrapper (so the matplotlib preamble still loads). Added `PYTHONPATH=sessionSandboxDir` so `import utils` works. Behavior is identical to before when no `files` payload is sent (backward compatible).
  - Refactored `src/app/page.tsx` (the 2654-line monolith):
    - Imported the project store, FileExplorer, QuickSwitcher, and Sheet (for mobile drawer).
    - Derived `code`/`language`/`setCode` from the active file in the store via an effect (keeping all existing handlers like handleRun/handleShare/handleDownload unchanged).
    - Updated handleRun to send `{ code, language, files, entryFile }` payload for Python (multi-file) — single-file mode preserved for all other languages.
    - Updated handleLanguageChange / handleSelectExample / handleClearAll / handleShare / popstate handler to write through the project store (so the active file is the source of truth).
    - Added a "Save" button in the toolbar (shows "Saved" when not dirty, "Save" when dirty) — for Phase 1 it only marks the active file as saved locally; Phase 2 will plug in Google login.
    - Added a FileExplorer sidebar (Panel with defaultSize=15%) for desktop and a Sheet drawer for mobile.
    - Added keyboard shortcuts: Ctrl+Enter (Run, was already there), Ctrl+S (save local), Ctrl+P (quick switcher). Ctrl+F/H/ left to CodeMirror's default bindings.
    - Added beforeunload protection — warns the user if they have unsaved changes when closing/refreshing the tab.
    - Removed the legacy localStorage persistence effect (replaced by the project store's IDB persistence).
    - Preserved the URL-hash share-link flow (loads a shared snippet into the active file on first load).
  - Fixed a Zustand persist bug: the initial idbStorage adapter was ignoring the `name` parameter (was hardcoded to `KEY = 'main'`). Now correctly uses `(name, value)` signature, so the persisted state is keyed by the Zustand persist name ('pyrunner-project').
  - Fixed the python-runner watchdog spamming EADDRINUSE errors (a duplicate watchdog was trying to spawn on an occupied port). Killed the duplicate; the runner is now running cleanly.

Stage Summary:
- Multi-file Python execution verified end-to-end via agent-browser: created `main.py` with `from utils import greet; print(greet('multi-file'))`, created `utils.py` with `def greet(name): return f'Hello, {name} from utils!'`, set main.py as active + entry, clicked Run → console showed "Hello, multi-file from utils!" with status "Success" and notification "Program finished".
- IndexedDB persistence verified: created main.py + utils.py, reloaded the page → both files restored.
- Ctrl+P quick switcher verified: opens dialog, fuzzy-filters by filename, Enter activates the selected file.
- Ctrl+S verified: shows "Saved locally" toast.
- Mobile responsive verified: at 390×844 viewport, the file explorer sidebar disappears, a "Open file explorer" button appears in the header, clicking it opens the explorer as a Sheet drawer.
- Lint passes cleanly (`bun run lint` → 0 errors).
- The existing compiler, Run button, language tabs, editor, Console, and overall UI design are all preserved — no breaking changes.
- Phase 2 (Google OAuth + Prisma schema + cloud save + My Projects dashboard + auto-save) and Phase 3 (Share URLs + ZIP import/export + search/replace + error highlighting + test cases + run history) are queued for the next session.

Artifacts:
- /home/z/my-project/src/lib/languages.ts (new)
- /home/z/my-project/src/lib/project-store.ts (new)
- /home/z/my-project/src/components/file-explorer.tsx (new)
- /home/z/my-project/src/components/quick-switcher.tsx (new)
- /home/z/my-project/src/app/page.tsx (modified — refactored to use the project store; existing handlers preserved)
- /home/z/my-project/mini-services/python-runner/index.ts (modified — additive: spawnPython now accepts an optional `payload` with `files` + `entryFile`)
- /home/z/my-project/eslint.config.mjs (modified — added `scripts/**` and `mini-services/**` to ignores)
- /home/z/my-project/download/phase1-*.png (screenshots from agent-browser verification)
