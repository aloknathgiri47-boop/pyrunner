import { createServer } from 'http'
import { Server } from 'socket.io'
import { spawn, type ChildProcess } from 'child_process'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const PORT = parseInt(process.env.PORT || '3003', 10)
const MAX_OUTPUT_BYTES = 1_000_000 // 1 MB per stream
const MAX_TIMEOUT_MS = 120_000
const DEFAULT_TIMEOUT_MS = 30_000

// Resolve the directory of this module so we can locate preamble.py
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Marker protocol constants for inline image transmission.
// The preamble wraps PNG figures as:
//   \x00PYRUNNER_IMG_BEGIN\x00<len>\x00<base64-png>\x00PYRUNNER_IMG_END\x00
const IMG_BEGIN = '\x00PYRUNNER_IMG_BEGIN\x00'
const IMG_END = '\x00PYRUNNER_IMG_END\x00'

interface RunPayload {
  code: string
  timeout?: number
  language?: 'python' | 'java' | 'c' | 'cpp' | 'r' | 'javascript' | 'php' | 'csharp' | 'dart' | 'flutter' | 'html' | 'sql'
  language?: 'python' | 'java' | 'c' | 'cpp' | 'r' | 'javascript' | 'php' | 'csharp' | 'dart' | 'flutter' | 'html' | 'sql' | 'kotlin' | 'go' | 'typescript' | 'rust' | 'ruby' | 'swift' | 'lua' | 'perl' | 'powershell' | 'bash' | 'fortran' | 'cobol' | 'kotlin-android'
  stdin?: string
  files?: Record<string, string>
  /** Path of the entry file within `files`. If omitted, falls back to `code`. */
  entryFile?: string
  action?: 'validate' | 'build'
}

interface Session {
  child: ChildProcess
  startedAt: number
  timeoutMs: number
  timer: ReturnType<typeof setTimeout> | null
  killed: boolean
  totalStdout: number
  totalStderr: number
  pendingPromptText: string // stdout that hasn't ended in newline (the prompt)
  // Buffer for in-progress image marker (markers can span multiple chunks)
  stdoutBuffer: string
  // True once we've detected the user's code started a long-running server
  // (Flask, Django, http.server, uvicorn, etc.) — used to cancel the timeout
  serverDetected: boolean
  // Timer that closes stdin after 10s if no interactive input arrives,
  // so programs that call input()/readline()/scanf() get EOF and exit
  // gracefully instead of hanging for the full timeout.
  // Only fires if the user hasn't sent ANY interactive input yet.
  stdinIdleTimer: ReturnType<typeof setTimeout> | null
  // True once the user has sent at least one interactive input line.
  // Used to prevent the idle timer from closing stdin while the user
  // is actively interacting with the program.
  receivedInteractiveInput: boolean
  // The binary being executed (e.g. "python3", "node", "ruby") — used in
  // error messages so users see the correct tool name instead of "python3".
  binaryName: string
  // Per-session workspace dir (for multi-file runs). Cleaned up on session end.
  workspaceDir: string | null
}

const sessions = new Map<string, Session>()

const httpServer = createServer()
const io = new Server(httpServer, {
  // Use the default socket.io path so the socket.io-client (which also defaults
  // to /socket.io/) can connect through the Caddy gateway. The Caddyfile
  // routes any request with ?XTransformPort=3003 to localhost:3003, so
  // /socket.io/?XTransformPort=3003 reaches us correctly.
  path: '/socket.io/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
})

const sandboxDir = join(tmpdir(), 'py-compiler')
if (!existsSync(sandboxDir)) {
  await mkdir(sandboxDir, { recursive: true }).catch(() => {})
}

/* ------------------------------------------------------------------ */
/* Multi-file workspace setup                                         */
/* ------------------------------------------------------------------ */
/**
 * If `payload.files` is provided + `payload.entryFile` is set, writes all
 * files to a per-session workspace dir and returns `{ workspaceDir, entryPath, isMultiFile: true }`.
 * Otherwise returns the shared sandboxDir with `isMultiFile: false`.
 *
 * Path traversal is blocked: no absolute paths, no `..` segments, no NUL bytes.
 * Used by every spawn* function so multi-file execution works uniformly.
 */
async function setupMultiFileWorkspace(
  payload: RunPayload | undefined,
  sessionId: string,
): Promise<{ workspaceDir: string; entryPath: string | null; isMultiFile: boolean }> {
  const files = payload?.files
  const entryFile = payload?.entryFile
  if (!files || Object.keys(files).length === 0 || !entryFile) {
    return { workspaceDir: sandboxDir, entryPath: null, isMultiFile: false }
  }
  const workspaceDir = join(sandboxDir, `proj_${sessionId}`)
  await mkdir(workspaceDir, { recursive: true }).catch(() => {})
  for (const [relPath, content] of Object.entries(files)) {
    if (relPath.startsWith('/') || relPath.includes('..') || relPath.includes('\0')) continue
    const absPath = join(workspaceDir, relPath)
    const dir = dirname(absPath)
    await mkdir(dir, { recursive: true }).catch(() => {})
    try {
      await writeFile(absPath, content, { encoding: 'utf8', mode: 0o600 })
    } catch { /* ignore */ }
  }
  const entryPath = join(workspaceDir, entryFile)
  // Store on globalThis so the session creation can pick it up for cleanup.
  ;(globalThis as any).__lastWorkspaceDir = workspaceDir
  return { workspaceDir, entryPath, isMultiFile: true }
}

/** Filter out internal temp paths and debug noise from output lines. */
function filterInternalNoise(text: string): string {
  return text
    // Strip /tmp/py-compiler/proj_<uuid>/ prefixes from error messages
    .replace(/\/tmp\/py-compiler\/proj_[a-f0-9-]+\//g, '')
    .replace(/\/tmp\/py-compiler\//g, '')
    // Strip /tmp/<lang>-runner/<sessionId>/ prefixes
    .replace(/\/tmp\/[a-z]+-runner\/[a-f0-9-]+\//g, '')
    // Strip "Picked up JAVA_TOOL_OPTIONS" noise
    .split('\n')
    .filter((line) =>
      !line.includes('Picked up JAVA_TOOL_OPTIONS') &&
      !line.includes('Picked up _JAVA_OPTIONS') &&
      !line.includes('Compiling Snippet') &&
      !line.includes('Compiling main.')
    )
    .join('\n')
}

const { rm } = require('fs/promises')

function killSession(session: Session, reason: 'timeout' | 'client_disconnect' | 'stop') {
  if (session.killed) return
  session.killed = true
  if (session.timer) {
    clearTimeout(session.timer)
    session.timer = null
  }
  if (session.stdinIdleTimer) {
    clearTimeout(session.stdinIdleTimer)
    session.stdinIdleTimer = null
  }
  try {
    session.child.kill('SIGKILL')
  } catch {
    /* noop */
  }
  // Clean up the per-session workspace dir (multi-file runs create proj_<uuid>/ dirs
  // that would otherwise accumulate in /tmp forever).
  if (session.workspaceDir) {
    rm(session.workspaceDir, { recursive: true, force: true }).catch(() => {})
  }
  void reason
}

function setupSession(socketId: string, session: Session, socket: any) {
  const { child } = session

  child.stdout?.on('data', (chunk: Buffer) => {
    session.totalStdout += chunk.length
    if (session.totalStdout > MAX_OUTPUT_BYTES * 2) return

    // Append to the session buffer. We need to scan the ENTIRE accumulated
    // buffer because image markers may span multiple 'data' events.
    session.stdoutBuffer += chunk.toString('utf8')
    const buf = session.stdoutBuffer

    // Walk through the buffer, extracting image markers and forwarding plain text.
    let i = 0
    let plainTextStart = 0
    let emitted = ''
    let nextBuffer = ''

    while (i < buf.length) {
      const beginIdx = buf.indexOf(IMG_BEGIN, i)
      if (beginIdx === -1) {
        // No more markers — flush remaining plain text (but keep any trailing
        // partial IMG_BEGIN prefix in case the chunk was cut mid-marker).
        // We must be careful: a marker could start but not yet have its END.
        // Find the last position where an IMG_BEGIN could START but be incomplete.
        const safeEnd = findSafePlainTextEnd(buf, plainTextStart)
        if (safeEnd > plainTextStart) {
          emitted += buf.slice(plainTextStart, safeEnd)
          nextBuffer = buf.slice(safeEnd)
        } else {
          nextBuffer = buf.slice(plainTextStart)
        }
        break
      }
      // Plain text before the marker
      if (beginIdx > plainTextStart) {
        emitted += buf.slice(plainTextStart, beginIdx)
      }
      // Find the end of this marker's header (3rd \x00 after BEGIN)
      const headerStart = beginIdx + IMG_BEGIN.length
      const lenEnd = buf.indexOf('\x00', headerStart)
      if (lenEnd === -1) {
        // Header not complete yet — keep from beginIdx onwards
        nextBuffer = buf.slice(beginIdx)
        break
      }
      const lenStr = buf.slice(headerStart, lenEnd)
      const dataLen = parseInt(lenStr, 10)
      if (isNaN(dataLen)) {
        // Malformed — skip the marker prefix and continue
        plainTextStart = lenEnd + 1
        i = lenEnd + 1
        continue
      }
      const dataStart = lenEnd + 1
      const dataEnd = dataStart + dataLen
      // Need at least dataLen bytes + IMG_END marker
      const endMarkerStart = dataEnd
      if (endMarkerStart + IMG_END.length > buf.length) {
        // Marker not complete yet — keep from beginIdx onwards
        nextBuffer = buf.slice(beginIdx)
        break
      }
      const expectedEndMarker = buf.slice(endMarkerStart, endMarkerStart + IMG_END.length)
      if (expectedEndMarker !== IMG_END) {
        // Malformed — skip past the begin marker and continue scanning
        plainTextStart = dataStart
        i = dataStart
        continue
      }
      // Complete marker — extract base64 data and emit image event
      const b64Data = buf.slice(dataStart, dataEnd)
      socket.emit('image', { data: b64Data, mime: 'image/png' })
      plainTextStart = endMarkerStart + IMG_END.length
      i = plainTextStart
    }

    session.stdoutBuffer = nextBuffer

    // Emit any accumulated plain text
    if (emitted.length > 0) {
      // Strip ANSI escape codes and filter out the noisy
      // "Picked up JAVA_TOOL_OPTIONS" line from Java runs.
      const stripped = emitted
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
        .split('\n')
        .filter((line) => !line.includes('Picked up JAVA_TOOL_OPTIONS') && !line.includes('Picked up _JAVA_OPTIONS'))
        .join('\n')
      const looksLikePrompt =
        !stripped.endsWith('\n') && !stripped.endsWith('\r\n') ||
        // Also detect prompts that end with ": " or "? " followed by a newline
        // (common in Lua/Perl print-based prompts like print("Enter name: "))
        /\b(enter|input|name|age|value|choice)\b.*[:?]\s*\n$/i.test(stripped)
      if (stripped) {
        socket.emit('output', {
          stream: 'stdout',
          data: stripped,
          promptLike: looksLikePrompt,
        })
      }

      // Detect a long-running server starting up (Flask, Django, http.server, etc.)
      // Common patterns:
      //   * Running on http://127.0.0.1:5000
      //   * Running on http://0.0.0.0:8000
      //   * Serving HTTP on port 8000 ...
      //   * Uvicorn running on http://0.0.0.0:8000
      if (!session.serverDetected) {
        const match = stripped.match(
          /Running on (https?:\/\/[0-9.]+:(\d+))|Serving HTTP on .*?:(\d+)|running on (https?:\/\/[0-9.]+:(\d+))/,
        )
        if (match) {
          // Find the port number from whichever capture group matched
          const portStr = match[2] || match[3] || match[5]
          if (portStr) {
            const port = parseInt(portStr, 10)
            if (!isNaN(port) && port > 0 && port < 65536) {
              session.serverDetected = true
              // Cancel the hard timeout — servers are long-running by design.
              // The user stops them via the Stop button.
              if (session.timer) {
                clearTimeout(session.timer)
                session.timer = null
              }
              socket.emit('server', { port, host: '127.0.0.1' })
            }
          }
        }
      }
    }
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    session.totalStderr += chunk.length
    if (session.totalStderr > MAX_OUTPUT_BYTES * 2) return
    const raw = chunk.toString('utf8')
    // Strip ANSI escape codes (e.g. Flask/werkzeug color codes \x1b[33m...\x1b[0m)
    // and filter out the noisy "Picked up JAVA_TOOL_OPTIONS" line from Java runs.
    const stripped = raw
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .split('\n')
      .filter((line) => !line.includes('Picked up JAVA_TOOL_OPTIONS') && !line.includes('Picked up _JAVA_OPTIONS'))
      .join('\n')
    socket.emit('output', {
      stream: 'stderr',
      data: stripped,
      promptLike: false,
    })

    // Server detection: werkzeug prints "Running on http://..." to stderr.
    if (!session.serverDetected) {
      const match = stripped.match(
        /Running on (https?:\/\/[0-9.]+:(\d+))|Serving HTTP on .*?:(\d+)|running on (https?:\/\/[0-9.]+:(\d+))/,
      )
      if (match) {
        const portStr = match[2] || match[3] || match[5]
        if (portStr) {
          const port = parseInt(portStr, 10)
          if (!isNaN(port) && port > 0 && port < 65536) {
            session.serverDetected = true
            if (session.timer) {
              clearTimeout(session.timer)
              session.timer = null
            }
            socket.emit('server', { port, host: '127.0.0.1' })
          }
        }
      }
    }
  })

  child.on('error', (err) => {
    socket.emit('output', {
      stream: 'stderr',
      data: `Failed to spawn ${session.binaryName}: ${err.message}\n`,
      promptLike: false,
    })
    socket.emit('exit', {
      code: null,
      signal: null,
      timedOut: false,
      durationMs: Date.now() - session.startedAt,
      error: 'SPAWN_FAILED',
    })
    sessions.delete(socketId)
  })

  child.on('close', (code, signal) => {
    if (session.timer) {
      clearTimeout(session.timer)
      session.timer = null
    }
    if (session.stdinIdleTimer) {
      clearTimeout(session.stdinIdleTimer)
      session.stdinIdleTimer = null
    }
    // Flush any remaining buffered plain text (no more chunks coming)
    if (session.stdoutBuffer.length > 0) {
      const text = session.stdoutBuffer
      session.stdoutBuffer = ''
      const looksLikePrompt =
        !text.endsWith('\n') && !text.endsWith('\r\n')
      socket.emit('output', {
        stream: 'stdout',
        data: text,
        promptLike: looksLikePrompt,
      })
    }
    socket.emit('exit', {
      code,
      signal: signal as NodeJS.Signals | null,
      timedOut: session.killed && session.timer === null && code === null ? false : false,
      durationMs: Date.now() - session.startedAt,
    })
    sessions.delete(socketId)
  })
}

/**
 * Find the safe end position for emitting plain text — i.e. the latest
 * position that is NOT the start of a partial IMG_BEGIN marker.
 *
 * If the buffer ends with a prefix of IMG_BEGIN (e.g. "\x00PYRUN" cut short),
 * we must NOT emit those bytes yet because they could be the start of a
 * marker that completes in the next chunk.
 */
function findSafePlainTextEnd(buf: string, start: number): number {
  const end = buf.length
  // Check the longest possible partial-match prefix at the end of buf.
  // IMG_BEGIN is '\x00PYRUNNER_IMG_BEGIN\x00' (length 22). Check up to 21 chars.
  const maxCheck = Math.min(IMG_BEGIN.length - 1, end - start)
  for (let len = maxCheck; len > 0; len--) {
    const tail = buf.slice(end - len)
    if (IMG_BEGIN.startsWith(tail)) {
      return end - len
    }
  }
  return end
}

io.on('connection', (socket) => {
  console.log(`[python-runner] client connected: ${socket.id}`)

  /**
   * Spawn a Python child process for the given code.
   * Returns the ChildProcess, or null if an error was already emitted.
   */
  async function spawnPython(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    // Load the matplotlib preamble (sets Agg backend, patches plt.show() and
    // plt.savefig() to emit inline PNG images via the marker protocol).
    let preamble = ''
    try {
      const preamblePath = join(__dirname, 'preamble.py')
      preamble = await readFile(preamblePath, 'utf8')
    } catch {
      // Preamble is optional — if it can't be loaded, run code as-is.
    }

    // Per-session workspace dir — used when `payload.files` is provided so
    // that multi-file Python projects (e.g. main.py importing utils.py) work.
    // Falls back to the shared sandboxDir for single-file runs to preserve
    // existing behavior exactly.
    const sessionSandboxDir = payload?.files && Object.keys(payload.files).length > 0
      ? join(sandboxDir, `proj_${sessionId}`)
      : sandboxDir

    if (sessionSandboxDir !== sandboxDir) {
      await mkdir(sessionSandboxDir, { recursive: true }).catch(() => {})
    }

    // Determine which file to execute: if `entryFile` is set AND it exists
    // in `payload.files`, run that file. Otherwise run the legacy `code`
    // (the contents of the previously-active editor buffer) — preserving
    // backward compatibility with single-file clients.
    const files = payload?.files ?? {}
    const entryFile = payload?.entryFile

    // Write multi-file project (if provided). Path traversal is blocked.
    for (const [relPath, content] of Object.entries(files)) {
      if (relPath.startsWith('/') || relPath.includes('..') || relPath.includes('\0')) continue
      const absPath = join(sessionSandboxDir, relPath)
      const dir = dirname(absPath)
      await mkdir(dir, { recursive: true }).catch(() => {})
      try {
        await writeFile(absPath, content, { encoding: 'utf8', mode: 0o600 })
      } catch { /* ignore */ }
    }

    let scriptPath: string
    let isMultiFile = false

    if (entryFile && files[entryFile] !== undefined) {
      // Multi-file: run the entry file directly (no preamble wrapping —
      // the preamble can't be prepended to a file the user imports from
      // another module, otherwise the import would re-execute the preamble).
      // Instead, we inject the preamble via PYTHONSTARTUP (executes before
      // the entry script in the same interpreter).
      scriptPath = join(sessionSandboxDir, entryFile)
      isMultiFile = true
      // Write the preamble to a sidecar so we can PYTHONSTARTUP it.
      // (PYTHONSTARTUP runs in the interactive namespace, not the script's
      // globals, so for matplotlib patching we need a different approach.)
      // Simpler: prepend the preamble to the entry file's contents.
      // To preserve imports, we write a wrapper file that exec's the preamble
      // then exec's the user's entry file in its own module namespace.
      const wrappedEntry = `${preamble}

import runpy, sys
sys.argv = [${JSON.stringify(entryFile)}]
runpy.run_path(${JSON.stringify(scriptPath)}, run_name='__main__')
`
      const wrapperPath = join(sessionSandboxDir, `wrapper_${sessionId}.py`)
      await writeFile(wrapperPath, wrappedEntry, { encoding: 'utf8', mode: 0o600 })
      scriptPath = wrapperPath
    } else {
      // Single-file legacy path — wrap the user's code with the preamble
      // (this is the historical behavior).
      const wrappedCode = `${preamble}

# --- Begin user code ---
${code}
# --- End user code ---
`
      scriptPath = join(sessionSandboxDir, `snippet_${sessionId}.py`)
      try {
        await writeFile(scriptPath, wrappedCode, { encoding: 'utf8', mode: 0o600 })
      } catch (e) {
        socket.emit('output', {
          stream: 'stderr',
          data: `Failed to write script file: ${(e as Error).message}\n`,
          promptLike: false,
        })
        socket.emit('exit', {
          code: null, signal: null, timedOut: false, durationMs: 0, error: 'WRITE_FAILED',
        })
        return null
      }
    }

    // Use the venv python3 (which has matplotlib, pandas, numpy, etc. installed)
    // The runner's PATH might not include /home/z/.venv/bin, so use the full path.
    const home = process.env.HOME || '/home/z'
    const venvPython = join(home, '.venv', 'bin', 'python3')
    const pythonBin = existsSync(venvPython) ? venvPython : 'python3'

    const child = spawn(pythonBin, ['-u', '-B', scriptPath], {
      cwd: sessionSandboxDir,
      env: {
        ...process.env,
        // Make sure the venv bin is in PATH so subprocesses can find python tools
        PATH: join(home, '.venv', 'bin') + ':' + (process.env.PATH || ''),
        PYTHONUNBUFFERED: '1',
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONIOENCODING: 'utf-8',
        PYTHONHASHSEED: '0',
        // For multi-file: add the project root to sys.path so `import utils`
        // works even if the entry is in a subfolder.
        PYTHONPATH: isMultiFile ? sessionSandboxDir : (process.env.PYTHONPATH || ''),
        DATABASE_URL: undefined,
        NEXTAUTH_SECRET: undefined,
        NEXTAUTH_URL: undefined,
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * Spawn a Java child process for the given code.
   * - Writes code to Snippet.java (extracts public class name if found)
   * - Compiles with javac
   * - If compilation succeeds, runs with java -cp <sandbox> <ClassName>
   * - Streams compile errors (stderr) and runtime output to the client
   * Returns the ChildProcess (the `java` run), or null on compile error.
   */
  async function spawnJava(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    // Multi-file mode: write all files, compile all .java files together, run the entry class.
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    // Locate the JDK (portable Temurin 21 installed at ~/.local/jdk/current).
    const home = process.env.HOME || '/home/z'
    const jdkBin = join(home, '.local', 'jdk', 'current', 'bin')
    const javacPath = existsSync(join(jdkBin, 'javac')) ? join(jdkBin, 'javac') : 'javac'
    const javaPath = existsSync(join(jdkBin, 'java')) ? join(jdkBin, 'java') : 'java'

    if (isMultiFile && entryPath) {
      // Derive the entry class name from the entry file's basename.
      const entryName = basename(entryPath).replace(/\.java$/i, '')

      socket.emit('output', {
        stream: 'system',
        data: `Compiling Java project...\n`,
        promptLike: false,
      })

      // Compile all .java files in the workspace together.
      const compileResult = await new Promise<{ ok: boolean; stderr: string; stdout: string }>((resolve) => {
        const javac = spawn(javacPath, ['-Xlint:none', '-nowarn', '*.java'], {
          cwd: workspaceDir,
          env: {
            ...process.env,
            JAVA_TOOL_OPTIONS: '-Dfile.encoding=UTF-8',
            _JAVA_OPTIONS: '-Dfile.encoding=UTF-8',
          } as NodeJS.ProcessEnv,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          shell: true,  // needed for *.java glob expansion
        })
        let stderr = ''
        let stdout = ''
        javac.stdout?.on('data', (c: Buffer) => { stdout += c.toString('utf8') })
        javac.stderr?.on('data', (c: Buffer) => { stderr += c.toString('utf8') })
        javac.on('error', (err) => {
          resolve({ ok: false, stderr: `Failed to spawn javac: ${err.message}\n`, stdout })
        })
        javac.on('close', (code) => {
          resolve({ ok: code === 0, stderr, stdout })
        })
        javac.stdin?.end()
      })

      const cleanStderr = filterInternalNoise(compileResult.stderr)
      const cleanStdout = filterInternalNoise(compileResult.stdout)

      if (!compileResult.ok) {
        if (cleanStderr) {
          socket.emit('output', { stream: 'stderr', data: cleanStderr, promptLike: false })
        }
        socket.emit('output', { stream: 'system', data: `\nCompilation failed.\n`, promptLike: false })
        socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
        return null
      }

      socket.emit('output', {
        stream: 'system',
        data: `Compiled. Running ${entryName}...\n`,
        promptLike: false,
      })

      const child = spawn(javaPath, ['-cp', workspaceDir, entryName], {
        cwd: workspaceDir,
        env: {
          ...process.env,
          JAVA_TOOL_OPTIONS: '-Dfile.encoding=UTF-8',
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy)
    // Extract the public class name from the code.
    let className = 'Snippet'
    const strippedCode = code
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    const classMatch = strippedCode.match(
      /public\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z_][A-Za-z0-9_]*)/,
    )
    if (classMatch) {
      className = classMatch[1]
    }

    const javaFilePath = join(sandboxDir, `${className}.java`)

    try {
      await writeFile(javaFilePath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write Java file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'WRITE_FAILED',
      })
      return null
    }

    // Compile step (synchronous — capture output)
    socket.emit('output', {
      stream: 'system',
      data: `Compiling ${className}.java...\n`,
      promptLike: false,
    })

    const compileResult = await new Promise<{ ok: boolean; stderr: string; stdout: string }>((resolve) => {
      const javac = spawn(javacPath, ['-Xlint:none', '-nowarn', javaFilePath], {
        cwd: sandboxDir,
        env: {
          ...process.env,
          JAVA_TOOL_OPTIONS: '-Dfile.encoding=UTF-8',
          _JAVA_OPTIONS: '-Dfile.encoding=UTF-8',
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })

      let stderr = ''
      let stdout = ''
      javac.stdout?.on('data', (c: Buffer) => { stdout += c.toString('utf8') })
      javac.stderr?.on('data', (c: Buffer) => { stderr += c.toString('utf8') })
      javac.on('error', (err) => {
        resolve({ ok: false, stderr: `Failed to spawn javac: ${err.message}\n`, stdout })
      })
      javac.on('close', (code) => {
        resolve({ ok: code === 0, stderr, stdout })
      })
      javac.stdin?.end()
    })

    // Filter out the noisy "Picked up JAVA_TOOL_OPTIONS" / "_JAVA_OPTIONS" line
    compileResult.stderr = filterInternalNoise(compileResult.stderr)
    compileResult.stdout = filterInternalNoise(compileResult.stdout)

    if (!compileResult.ok) {
      // Compilation failed — emit the errors and exit
      const strippedStderr = compileResult.stderr.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      if (strippedStderr) {
        socket.emit('output', {
          stream: 'stderr',
          data: strippedStderr,
          promptLike: false,
        })
      }
      socket.emit('output', {
        stream: 'system',
        data: `\nCompilation failed.\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: 1, signal: null, timedOut: false, durationMs: 0,
      })
      return null
    }

    // Compilation succeeded — run the program
    socket.emit('output', {
      stream: 'system',
      data: `Compiled. Running ${className}...\n`,
      promptLike: false,
    })

    const child = spawn(javaPath, ['-cp', sandboxDir, className], {
      cwd: sandboxDir,
      env: {
        ...process.env,
        JAVA_TOOL_OPTIONS: '-Dfile.encoding=UTF-8',
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * Spawn a C child process for the given code.
   * - Writes code to snippet_<sessionId>.c
   * - Compiles with gcc -std=c11 -Wall -o <binary>
   * - If compilation succeeds, runs the binary
   * - Streams compile errors (stderr) and runtime output to the client
   * Returns the ChildProcess (the binary run), or null on compile error.
   */
  async function spawnC(code: string, sessionId: string, socket: any): Promise<ChildProcess | null> {
    const cFilePath = join(sandboxDir, `snippet_${sessionId}.c`)
    const binaryPath = join(sandboxDir, `snippet_${sessionId}.bin`)

    try {
      await writeFile(cFilePath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write C file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'WRITE_FAILED',
      })
      return null
    }

    // Compile step
    socket.emit('output', {
      stream: 'system',
      data: `Compiling snippet.c with gcc...\n`,
      promptLike: false,
    })

    const compileResult = await new Promise<{ ok: boolean; stderr: string; stdout: string }>((resolve) => {
      const gcc = spawn('gcc', [
        '-std=c11',     // Modern C standard
        '-Wall',        // All warnings
        '-Wno-unused',  // But don't nag about unused vars in examples
        '-O2',          // Basic optimization
        '-o', binaryPath,
        cFilePath,
        '-lm',          // Math library (for sqrt, sin, etc.)
      ], {
        cwd: sandboxDir,
        env: process.env as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })

      let stderr = ''
      let stdout = ''
      gcc.stdout?.on('data', (c: Buffer) => { stdout += c.toString('utf8') })
      gcc.stderr?.on('data', (c: Buffer) => { stderr += c.toString('utf8') })
      gcc.on('error', (err) => {
        resolve({ ok: false, stderr: `Failed to spawn gcc: ${err.message}\nIs gcc installed?\n`, stdout })
      })
      gcc.on('close', (code) => {
        resolve({ ok: code === 0, stderr, stdout })
      })
      gcc.stdin?.end()
    })

    if (!compileResult.ok) {
      const strippedStderr = compileResult.stderr.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      if (strippedStderr) {
        socket.emit('output', {
          stream: 'stderr',
          data: strippedStderr,
          promptLike: false,
        })
      }
      socket.emit('output', {
        stream: 'system',
        data: `\nCompilation failed.\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: 1, signal: null, timedOut: false, durationMs: 0,
      })
      return null
    }

    // Compilation succeeded — run the binary
    socket.emit('output', {
      stream: 'system',
      data: `Compiled. Running binary...\n`,
      promptLike: false,
    })

    // Use stdbuf -o0 to make stdout FULLY UNBUFFERED so every printf
    // (including prompts without newlines like "Enter: ") appears immediately.
    // C defaults to full buffering when stdout is a pipe, which causes
    // interactive scanf() programs to appear hung — the prompt never shows.
    const child = spawn('stdbuf', ['-o0', binaryPath], {
      cwd: sandboxDir,
      env: process.env as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * Spawn a C++ child process for the given code.
   * - Writes code to snippet_<sessionId>.cpp
   * - Compiles with g++ -std=c++20 -Wall -o <binary>
   * - If compilation succeeds, runs the binary with stdbuf -o0
   * - Streams compile errors (stderr) and runtime output to the client
   * Returns the ChildProcess (the binary run), or null on compile error.
   */
  async function spawnCpp(code: string, sessionId: string, socket: any): Promise<ChildProcess | null> {
    const cppFilePath = join(sandboxDir, `snippet_${sessionId}.cpp`)
    const binaryPath = join(sandboxDir, `snippet_${sessionId}.bin`)

    try {
      await writeFile(cppFilePath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write C++ file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'WRITE_FAILED',
      })
      return null
    }

    // Compile step
    socket.emit('output', {
      stream: 'system',
      data: `Compiling snippet.cpp with g++...\n`,
      promptLike: false,
    })

    const compileResult = await new Promise<{ ok: boolean; stderr: string; stdout: string }>((resolve) => {
      const gpp = spawn('g++', [
        '-std=c++20',    // Modern C++ standard (2020)
        '-Wall',         // All warnings
        '-Wno-unused',  // Don't nag about unused vars in examples
        '-O2',           // Basic optimization
        '-o', binaryPath,
        cppFilePath,
        '-lm',           // Math library
      ], {
        cwd: sandboxDir,
        env: process.env as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })

      let stderr = ''
      let stdout = ''
      gpp.stdout?.on('data', (c: Buffer) => { stdout += c.toString('utf8') })
      gpp.stderr?.on('data', (c: Buffer) => { stderr += c.toString('utf8') })
      gpp.on('error', (err) => {
        resolve({ ok: false, stderr: `Failed to spawn g++: ${err.message}\nIs g++ installed?\n`, stdout })
      })
      gpp.on('close', (code) => {
        resolve({ ok: code === 0, stderr, stdout })
      })
      gpp.stdin?.end()
    })

    if (!compileResult.ok) {
      const strippedStderr = compileResult.stderr.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      if (strippedStderr) {
        socket.emit('output', {
          stream: 'stderr',
          data: strippedStderr,
          promptLike: false,
        })
      }
      socket.emit('output', {
        stream: 'system',
        data: `\nCompilation failed.\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: 1, signal: null, timedOut: false, durationMs: 0,
      })
      return null
    }

    // Compilation succeeded — run the binary
    socket.emit('output', {
      stream: 'system',
      data: `Compiled. Running binary...\n`,
      promptLike: false,
    })

    // Use stdbuf -o0 to make stdout FULLY UNBUFFERED so every cout output
    // (including prompts without newlines like "Enter: ") appears immediately.
    const child = spawn('stdbuf', ['-o0', binaryPath], {
      cwd: sandboxDir,
      env: process.env as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * Spawn an R child process for the given code.
   * - Writes code to snippet_<sessionId>.R
   * - Runs with Rscript (R --slave --no-restore --file=...)
   * - Streams stdout/stderr/stdin to the client
   * Uses the portable R at ~/.local/r/bin/Rscript (Temurin-style portable install).
   * R needs R_HOME and LD_LIBRARY_PATH set correctly.
   */
  async function spawnR(code: string, sessionId: string, socket: any): Promise<ChildProcess | null> {
    const rFilePath = join(sandboxDir, `snippet_${sessionId}.R`)

    // R preamble: override readline() to use a persistent stdin connection.
    // R's built-in readline() uses R_ReadConsole which only works with terminals,
    // NOT with piped stdin. By overriding readline() to use readLines() on a
    // persistent file("stdin") connection, we make it work with pre-piped input.
    const rPreamble = `# --- PyRunner preamble: make readline() work with piped stdin ---
.pyrunner_stdin_con <- file("stdin")
open(.pyrunner_stdin_con)
readline <- function(prompt = "") {
  cat(prompt)
  flush.console()
  lines <- readLines(.pyrunner_stdin_con, n = 1)
  return(if (length(lines) > 0) lines[1] else "")
}
# --- End preamble ---

`

    // Wrap user code with the preamble
    const wrappedCode = rPreamble + code

    try {
      await writeFile(rFilePath, wrappedCode, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write R file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'WRITE_FAILED',
      })
      return null
    }

    // Locate the portable R install.
    // Rscript has a hardcoded /usr/lib/R path that can't be overridden, so we
    // use the R exec binary directly with the correct R_HOME + LD_LIBRARY_PATH.
    const home = process.env.HOME || '/home/z'
    const rHome = join(home, '.local', 'r', 'lib', 'R')
    const rHomeAlt = join(home, '.local', 'r', 'usr', 'lib', 'R')
    const actualRHome = existsSync(rHome) ? rHome : rHomeAlt
    // Prefer the exec binary (bypasses the shell wrapper that hardcodes paths).
    const rExecPath = join(actualRHome, 'bin', 'exec', 'R')
    const rScriptPath = join(home, '.local', 'r', 'bin', 'R')
    const rscriptPath = join(home, '.local', 'r', 'bin', 'Rscript')
    const actualR = existsSync(rExecPath) ? rExecPath
      : existsSync(rScriptPath) ? rScriptPath
      : existsSync(rscriptPath) ? rscriptPath
      : 'Rscript'

    socket.emit('output', {
      stream: 'system',
      data: `Running R script...\n`,
      promptLike: false,
    })

    // R needs R_HOME and LD_LIBRARY_PATH set correctly.
    // --slave suppresses the startup banner, --no-restore prevents loading .RData,
    // --no-save prevents saving .RData on exit.
    // When using the exec binary directly, use -f <file> to run a script.
    const rArgs = actualR === rExecPath
      ? ['--slave', '--no-restore', '--no-save', '-f', rFilePath]
      : [rFilePath]
    const child = spawn(actualR, rArgs, {
      cwd: sandboxDir,
      env: {
        ...process.env,
        R_HOME: actualRHome,
        LD_LIBRARY_PATH: [
          join(actualRHome, 'lib'),
          join(home, '.local', 'r', 'usr', 'lib', 'x86_64-linux-gnu'),
          '/lib/x86_64-linux-gnu',
          '/usr/lib/x86_64-linux-gnu',
          process.env.LD_LIBRARY_PATH || '',
        ].filter(Boolean).join(':'),
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * Spawn a JavaScript (Node.js) child process for the given code.
   * - Writes code to snippet_<sessionId>.js
   * - Runs with node (no compilation needed — interpreted like Python)
   * - Streams stdout/stderr/stdin to the client
   * Node.js supports both CommonJS (require) and ES modules (import).
   */
  async function spawnJavaScript(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    // JavaScript preamble: polyfill browser APIs (prompt, alert, confirm)
    // that don't exist in Node.js. This lets users write browser-style code
    // that works with stdin (via Program Input or interactive console).
    //
    // prompt() uses execSync with shell 'read' command to synchronously
    // block until a line is available on stdin. This is necessary because
    // Node.js's fs.readSync doesn't properly block on pipe stdin.
    const jsPreamble = `// --- PyRunner preamble: polyfill browser APIs ---
const { execSync } = require('child_process');

// prompt(message) — shows message, reads one line from stdin, returns it.
// Uses execSync with shell 'read line' which reads EXACTLY one line from stdin
// without consuming extra data (unlike 'head -n 1' which reads ahead and
// loses remaining lines). 'read' properly blocks on piped stdin.
globalThis.prompt = function(message = '') {
  if (message) process.stdout.write(message);
  try {
    const result = execSync('read line && echo "$line"', {
      stdio: ['inherit', 'pipe', 'pipe'],
      timeout: 60000,
    });
    return result.toString('utf8').replace(/\\n$/, '').replace(/\\r$/, '');
  } catch (e) {
    return '';
  }
};

// alert(message) — prints message to stdout
globalThis.alert = function(message = '') {
  console.log(String(message));
};

// confirm(message) — shows message, reads y/n from stdin, returns boolean
globalThis.confirm = function(message = '') {
  const response = globalThis.prompt(message + ' (y/n) ');
  return response.toLowerCase().startsWith('y');
};
// --- End preamble ---

`

    // Multi-file mode: write all files to a per-session workspace and run the entry file.
    // The preamble is written as a separate _preamble.js file and required first
    // via the --require flag, so prompt()/alert()/confirm() are available in all files.
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    if (isMultiFile && entryPath) {
      // Write the preamble to a sidecar file and load it via --require
      // so it's available in the entry file AND any required modules.
      const preamblePath = join(workspaceDir, '_pyrunner_preamble.js')
      try {
        await writeFile(preamblePath, jsPreamble, { encoding: 'utf8', mode: 0o600 })
      } catch { /* ignore */ }

      socket.emit('output', {
        stream: 'system',
        data: `Running JavaScript with Node.js...\n`,
        promptLike: false,
      })
      // -r flag = require the preamble before running the entry file
      const child = spawn('node', ['-r', preamblePath, entryPath], {
        cwd: workspaceDir,
        env: {
          ...process.env,
          NODE_NO_WARNINGS: '1',
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy): wrap with the browser-API preamble.
    const jsFilePath = join(sandboxDir, `snippet_${sessionId}.js`)

    // Wrap user code with the preamble
    const wrappedCode = jsPreamble + code

    try {
      await writeFile(jsFilePath, wrappedCode, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write JavaScript file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'WRITE_FAILED',
      })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Running JavaScript with Node.js...\n`,
      promptLike: false,
    })

    // Run with node. Use --input-type=module is NOT needed because
    // we're running a .js file which defaults to CommonJS.
    const child = spawn('node', [jsFilePath], {
      cwd: sandboxDir,
      env: {
        ...process.env,
        NODE_NO_WARNINGS: '1',
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * Spawn a PHP child process for the given code.
   * - Writes code to snippet_<sessionId>.php
   * - Runs with php (portable install at ~/.local/php/usr/bin/php)
   * - Streams stdout/stderr/stdin to the client
   * PHP supports fgets(STDIN) for interactive stdin, echo/print for output.
   */
  async function spawnPHP(code: string, sessionId: string, socket: any): Promise<ChildProcess | null> {
    const phpFilePath = join(sandboxDir, `snippet_${sessionId}.php`)

    // PHP preamble: override readline() to use fgets(STDIN).
    // The portable PHP install doesn't have the readline extension loaded
    // (it needs libedit/readline shared library). By overriding readline()
    // to use fgets(STDIN), we make it work with piped stdin (Program Input
    // and interactive console input).
    // NOTE: Do NOT close the preamble with ?> — that would switch PHP back
    // to text mode and the user's code would be echoed as plain text.
    const phpPreamble = `<?php
// --- PyRunner preamble: override readline() ---
if (!function_exists('readline')) {
    function readline($prompt = '') {
        if ($prompt) echo $prompt;
        $line = fgets(STDIN);
        return $line === false ? '' : rtrim($line, "\\r\\n");
    }
}
// --- End preamble ---

`

    // Wrap user code. If user code starts with <?php, remove that tag
    // (our preamble already opened PHP mode) and append the rest.
    let wrappedCode = code
    const trimmed = code.trimStart()
    if (trimmed.startsWith('<?php')) {
      wrappedCode = phpPreamble + trimmed.slice(5) // skip "<?php"
    } else if (trimmed.startsWith('<?')) {
      wrappedCode = phpPreamble + trimmed.slice(2) // skip "<?"
    } else {
      wrappedCode = phpPreamble + code
    }

    try {
      await writeFile(phpFilePath, wrappedCode, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write PHP file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'WRITE_FAILED',
      })
      return null
    }

    // Locate the portable PHP install
    const home = process.env.HOME || '/home/z'
    const phpPath = join(home, '.local', 'php', 'usr', 'bin', 'php')
    const actualPhp = existsSync(phpPath) ? phpPath : 'php'

    socket.emit('output', {
      stream: 'system',
      data: `Running PHP script...\n`,
      promptLike: false,
    })

    // Run with php. Set extension_dir so PHP can find its modules,
    // and enable all errors.
    const child = spawn(actualPhp, [
      '-d', 'error_reporting=E_ALL',
      '-d', `extension_dir=${join(home, '.local', 'php', 'usr', 'lib', 'php', '20240924')}`,
      phpFilePath,
    ], {
      cwd: sandboxDir,
      env: {
        ...process.env,
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * Spawn a C# child process for the given code.
   * - Writes code to snippet_<sessionId>.cs
   * - Compiles with dotnet csc (Roslyn)
   * - Creates a .dll output + runtimeconfig.json
   * - Runs with dotnet
   */
  async function spawnCSharp(code: string, sessionId: string, socket: any): Promise<ChildProcess | null> {
    const csFilePath = join(sandboxDir, `snippet_${sessionId}.cs`)
    const dllPath = join(sandboxDir, `snippet_${sessionId}.dll`)
    const configPath = join(sandboxDir, `snippet_${sessionId}.runtimeconfig.json`)

    try {
      await writeFile(csFilePath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write C# file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'WRITE_FAILED',
      })
      return null
    }

    // Locate the .NET SDK and reference assemblies
    // Check both ~/.dotnet (local install) and /usr/share/dotnet (system install)
    const home = process.env.HOME || '/home/z'
    const dotnetHome = join(home, '.dotnet')
    const dotnetSystem = '/usr/share/dotnet'
    const sdkDir = existsSync(join(dotnetHome, 'sdk'))
      ? join(dotnetHome, 'sdk')
      : existsSync(join(dotnetSystem, 'sdk'))
      ? join(dotnetSystem, 'sdk')
      : null
    if (!sdkDir) {
      socket.emit('output', {
        stream: 'stderr',
        data: '.NET SDK not found. Cannot compile C#.\n',
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'NO_SDK',
      })
      return null
    }

    // Find the actual SDK version directory
    const { readdirSync } = await import('fs')
    const sdkVersions = readdirSync(sdkDir).filter(d => d.startsWith('8.'))
    if (sdkVersions.length === 0) {
      socket.emit('output', {
        stream: 'stderr',
        data: '.NET SDK 8.x not found.\n',
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'NO_SDK',
      })
      return null
    }
    const actualSdkDir = join(sdkDir, sdkVersions[0])

    // Find reference assemblies — check both ~/.dotnet and /usr/share/dotnet
    const dotnetRoot = existsSync(dotnetHome) ? dotnetHome : dotnetSystem
    const refBase = join(dotnetRoot, 'packs', 'Microsoft.NETCore.App.Ref')
    let refDir = ''
    if (existsSync(refBase)) {
      const refVersions = readdirSync(refBase).filter(d => d.startsWith('8.'))
      if (refVersions.length > 0) {
        refDir = join(refBase, refVersions[0], 'ref', 'net8.0')
      }
    }
    if (!refDir || !existsSync(refDir)) {
      socket.emit('output', {
        stream: 'stderr',
        data: 'Reference assemblies not found.\n',
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'NO_REFS',
      })
      return null
    }

    const dotnetBin = join(dotnetRoot, 'dotnet')
    const cscDll = join(actualSdkDir, 'Roslyn', 'bincore', 'csc.dll')

    // Compile step
    socket.emit('output', {
      stream: 'system',
      data: `Compiling with C# Roslyn compiler...\n`,
      promptLike: false,
    })

    const compileResult = await new Promise<{ ok: boolean; stderr: string; stdout: string }>((resolve) => {
      const csc = spawn(dotnetBin, [
        cscDll,
        `-r:${join(refDir, 'System.Runtime.dll')}`,
        `-r:${join(refDir, 'System.Console.dll')}`,
        `-r:${join(refDir, 'mscorlib.dll')}`,
        `-r:${join(refDir, 'System.Collections.dll')}`,
        `-r:${join(refDir, 'System.Linq.dll')}`,
        `-r:${join(refDir, 'System.IO.FileSystem.dll')}`,
        `-r:${join(refDir, 'System.Text.RegularExpressions.dll')}`,
        `-r:${join(refDir, 'System.Net.Http.dll')}`,
        `-r:${join(refDir, 'System.Threading.dll')}`,
        `-out:${dllPath}`,
        csFilePath,
      ], {
        cwd: sandboxDir,
        env: { ...process.env } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })

      let stderr = ''
      let stdout = ''
      csc.stdout?.on('data', (c: Buffer) => { stdout += c.toString('utf8') })
      csc.stderr?.on('data', (c: Buffer) => { stderr += c.toString('utf8') })
      csc.on('error', (err) => {
        resolve({ ok: false, stderr: `Failed to spawn csc: ${err.message}\n`, stdout })
      })
      csc.on('close', (code) => {
        resolve({ ok: code === 0, stderr, stdout })
      })
      csc.stdin?.end()
    })

    if (!compileResult.ok) {
      if (compileResult.stderr) {
        socket.emit('output', {
          stream: 'stderr',
          data: compileResult.stderr,
          promptLike: false,
        })
      }
      socket.emit('output', {
        stream: 'system',
        data: `\nCompilation failed.\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: 1, signal: null, timedOut: false, durationMs: 0,
      })
      return null
    }

    // Create runtimeconfig.json
    const configJson = JSON.stringify({
      runtimeOptions: {
        tfm: 'net8.0',
        framework: {
          name: 'Microsoft.NETCore.App',
          version: '8.0.11',
        },
      },
    }, null, 2)
    try {
      await writeFile(configPath, configJson, { encoding: 'utf8' })
    } catch {
      // ignore
    }

    // Compilation succeeded — run the .dll
    socket.emit('output', {
      stream: 'system',
      data: `Compiled. Running...\n`,
      promptLike: false,
    })

    const child = spawn(dotnetBin, [dllPath], {
      cwd: sandboxDir,
      env: { ...process.env } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * Spawn a Dart child process for the given code.
   * - Writes code to snippet_<sessionId>.dart
   * - Runs with dart run (interpreted — no separate compile step needed)
   * - Streams stdout/stderr/stdin to the client
   */
  async function spawnDart(code: string, sessionId: string, socket: any): Promise<ChildProcess | null> {
    const dartFilePath = join(sandboxDir, `snippet_${sessionId}.dart`)

    try {
      await writeFile(dartFilePath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write Dart file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'WRITE_FAILED',
      })
      return null
    }

    // Locate the Dart SDK — check ~/.local/dart-sdk, /opt/dart-sdk, and PATH
    const home = process.env.HOME || '/home/z'
    const dartBin = existsSync(join(home, '.local', 'dart-sdk', 'bin', 'dart'))
      ? join(home, '.local', 'dart-sdk', 'bin', 'dart')
      : existsSync('/opt/dart-sdk/bin/dart')
      ? '/opt/dart-sdk/bin/dart'
      : existsSync('/usr/local/bin/dart')
      ? '/usr/local/bin/dart'
      : 'dart'

    socket.emit('output', {
      stream: 'system',
      data: `Running Dart script...\n`,
      promptLike: false,
    })

    // Run with dart run (JIT mode — no compilation needed)
    const child = spawn(dartBin, ['run', dartFilePath], {
      cwd: sandboxDir,
      env: { ...process.env } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * Spawn a Flutter web app.
   * - Writes user code to lib/main.dart in the Flutter web project
   * - Runs `flutter build web --release` to compile to HTML/JS
   * - Serves the built app on a random port (8000-8999)
   * - Emits a 'server' event so the frontend opens it in a preview panel
   * - The user can interact with the rendered Flutter app (TextFields, buttons, etc.)
   * - Console shows build logs; the actual UI renders in the preview iframe
   */
  async function spawnFlutter(code: string, sessionId: string, socket: any, stdin?: string): Promise<ChildProcess | null> {
    const home = process.env.HOME || '/home/z'

    // Check if Flutter SDK is available
    const flutterBinPath = join(home, '.local', 'flutter', 'bin', 'flutter')
    const flutterInPath = existsSync('/usr/local/bin/flutter')
    const hasFlutter = existsSync(flutterBinPath) || flutterInPath

    if (!hasFlutter) {
      socket.emit('output', {
        stream: 'stderr',
        data: 'Flutter SDK is not installed on this server.\n\nFlutter apps require the full Flutter SDK (~1.5GB) to build web apps, which is too large for cloud deployment.\n\nTo run Flutter code, please use the local development environment at localhost:81.\n',
        promptLike: false,
      })
      socket.emit('exit', {
        code: 1, signal: null, timedOut: false, durationMs: 0, error: 'NO_FLUTTER_SDK',
      })
      return null
    }

    // Use a PERSISTENT location (not /tmp) so /tmp cleanups don't wipe the project.
    const flutterProjectDir = join(home, 'flutter_workspace', 'flutter_project')
    const libDir = join(flutterProjectDir, 'lib')
    const mainDartPath = join(libDir, 'main.dart')

    // Auto-create the Flutter project if missing (e.g. after /tmp cleanup or
    // first run on a fresh machine). This makes the runner self-healing.
    if (!existsSync(join(flutterProjectDir, 'pubspec.yaml'))) {
      socket.emit('output', {
        stream: 'system',
        data: `Flutter project not found at ${flutterProjectDir}. Creating it now (one-time setup, ~1 min)...\n`,
        promptLike: false,
      })
      const flutterBinInit = join(home, '.local', 'flutter', 'bin', 'flutter')
      const actualFlutterInit = existsSync(flutterBinInit) ? flutterBinInit : 'flutter'
      const flutterPathInit = join(home, '.local', 'flutter', 'bin')
      const workspaceDir = join(home, 'flutter_workspace')
      await mkdir(workspaceDir, { recursive: true }).catch(() => {})

      const initResult = await new Promise<{ ok: boolean; stderr: string }>((resolve) => {
        const init = spawn(actualFlutterInit, [
          'create', '--platforms', 'web', 'flutter_project',
        ], {
          cwd: workspaceDir,
          env: {
            ...process.env,
            PATH: flutterPathInit + ':' + (process.env.PATH || ''),
          } as NodeJS.ProcessEnv,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        })
        let stderr = ''
        init.stdout?.on('data', (c: Buffer) => {
          socket.emit('output', { stream: 'stdout', data: c.toString('utf8'), promptLike: false })
        })
        init.stderr?.on('data', (c: Buffer) => {
          stderr += c.toString('utf8')
          socket.emit('output', { stream: 'stderr', data: c.toString('utf8'), promptLike: false })
        })
        init.on('error', (err) => resolve({ ok: false, stderr: `Failed to run flutter create: ${err.message}` }))
        init.on('close', (code) => resolve({ ok: code === 0, stderr }))
      })

      if (!initResult.ok || !existsSync(join(flutterProjectDir, 'pubspec.yaml'))) {
        socket.emit('output', {
          stream: 'stderr',
          data: `Failed to create Flutter project.\n${initResult.stderr}\n`,
          promptLike: false,
        })
        socket.emit('exit', {
          code: 1, signal: null, timedOut: false, durationMs: 0,
        })
        return null
      }
      socket.emit('output', {
        stream: 'system',
        data: `Flutter project created successfully.\n`,
        promptLike: false,
      })
    }

    // Ensure lib directory exists
    if (!existsSync(libDir)) {
      await mkdir(libDir, { recursive: true }).catch(() => {})
    }

    // Ensure web directory exists (flutter create --platforms web)
    const webDir = join(flutterProjectDir, 'web')
    if (!existsSync(join(webDir, 'index.html'))) {
      // Create web directory if it doesn't exist
      if (!existsSync(webDir)) {
        await mkdir(webDir, { recursive: true }).catch(() => {})
      }
      // Create index.html for Flutter web
      const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <base href="/"></base>
  <title>Flutter App</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <script src="flutter.js" defer></script>
</body>
</html>`
      await writeFile(join(webDir, 'index.html'), indexHtml).catch(() => {})
    }

    // Write user's code to lib/main.dart
    // If the code doesn't have void main(), wrap it in a simple app
    let mainDart: string
    if (code.includes('void main(') || code.includes('runApp(')) {
      // User wrote a full Flutter app — use as-is
      mainDart = code
    } else if (code.includes('testWidgets') || code.includes('test(')) {
      // User wrote test code — convert to a simple app that shows the test result
      mainDart = `import 'package:flutter/material.dart';

${code}

void main() {
  runApp(MaterialApp(
    home: Scaffold(
      appBar: AppBar(title: Text('Flutter Test')),
      body: Center(child: Text('Test code detected. Use full app mode for UI.')),
    ),
  ));
}
`
    } else if (code.includes('class ') && code.includes('Widget build')) {
      // User wrote widget classes but no main — wrap in a simple app
      mainDart = `import 'package:flutter/material.dart';

${code}

void main() {
  runApp(const MaterialApp(home: MyApp()));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Flutter App')),
      body: const Center(child: Text('App loaded')),
    );
  }
}
`
    } else {
      // Assume it's widget code that should be wrapped
      mainDart = `import 'package:flutter/material.dart';

void main() {
  runApp(MaterialApp(
    home: Scaffold(
      appBar: AppBar(title: const Text('Flutter App')),
      body: Builder(builder: (context) {
        ${code}
      }),
    ),
  ));
}
`
    }

    try {
      await writeFile(mainDartPath, mainDart, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write main.dart: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: null, signal: null, timedOut: false, durationMs: 0, error: 'WRITE_FAILED',
      })
      return null
    }

    const flutterBin = join(home, '.local', 'flutter', 'bin', 'flutter')
    const actualFlutter = existsSync(flutterBin) ? flutterBin : 'flutter'
    const flutterPath = join(home, '.local', 'flutter', 'bin')

    socket.emit('output', {
      stream: 'system',
      data: `Building Flutter web app...\n`,
      promptLike: false,
    })

    // Build the web app
    const buildResult = await new Promise<{ ok: boolean; stderr: string; stdout: string }>((resolve) => {
      const build = spawn(actualFlutter, [
        'build', 'web', '--release', '--no-wasm-dry-run', '--no-pub',
      ], {
        cwd: flutterProjectDir,
        env: {
          ...process.env,
          PATH: flutterPath + ':' + (process.env.PATH || ''),
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })

      let stderr = ''
      let stdout = ''
      build.stdout?.on('data', (c: Buffer) => {
        const text = c.toString('utf8')
        stdout += text
        // Stream build progress to console
        socket.emit('output', { stream: 'stdout', data: text, promptLike: false })
      })
      build.stderr?.on('data', (c: Buffer) => {
        const text = c.toString('utf8')
        stderr += text
        socket.emit('output', { stream: 'stderr', data: text, promptLike: false })
      })
      build.on('error', (err) => {
        resolve({ ok: false, stderr: `Failed to run flutter build: ${err.message}\n`, stdout })
      })
      build.on('close', (code) => {
        resolve({ ok: code === 0, stderr, stdout })
      })
      build.stdin?.end()
    })

    if (!buildResult.ok) {
      socket.emit('output', {
        stream: 'system',
        data: `\nBuild failed.\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: 1, signal: null, timedOut: false, durationMs: 0,
      })
      return null
    }

    // Find a free port for serving (8000-8999 range)
    const net = await import('net')
    const findFreePort = (): Promise<number> => {
      return new Promise((resolve) => {
        const server = net.createServer()
        server.listen(0, '127.0.0.1', () => {
          const port = (server.address() as any).port
          server.close(() => resolve(port))
        })
      })
    }
    const servePort = await findFreePort()

    // Serve the built web app using Python's http.server
    const webBuildDir = join(flutterProjectDir, 'build', 'web')
    socket.emit('output', {
      stream: 'system',
      data: `Flutter app built successfully! Serving on port ${servePort}...\n`,
      promptLike: false,
    })

    // Emit server event so frontend opens the preview
    socket.emit('server', { port: servePort, host: '127.0.0.1' })

    // Start serving using our custom Flutter server (rewrites HTML to inject XTransformPort)
    const flutterServerScript = join(__dirname, 'flutter-server.py')
    const child = spawn('python3', [flutterServerScript, servePort.toString(), webBuildDir], {
      cwd: webBuildDir,
      env: { ...process.env } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    // The server runs until killed (user clicks Stop or timeout)
    return child
  }

  /**
   * spawnHtml — serves a user's HTML/CSS/JS code in a live preview iframe.
   *
   * Strategy:
   *   1. Create a unique temp directory per session
   *   2. Write the user's code to `index.html` inside that directory
   *   3. Find a free port and start the existing `flutter-server.py`
   *      (which handles the base-href rewrite + correct Content-Length +
   *      proper mime types + CORS for iframe embedding)
   *   4. Emit a `server` event so the frontend iframe is updated
   *
   * The server runs until the user clicks Stop or the session times out.
   * No build step is needed — HTML/CSS/JS is interpreted by the browser.
   */
  async function spawnHtml(code: string, sessionId: string, socket: any): Promise<ChildProcess | null> {
    // Sanitize and normalize the user's code:
    // - If user provided a full HTML document, use as-is
    // - If user only provided HTML fragments or CSS, wrap in a basic document
    let htmlContent: string
    const trimmed = code.trim()
    if (/<!doctype\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
      // Full document — use as-is
      htmlContent = code
    } else {
      // Wrap in a basic HTML document so the browser renders it properly
      htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTML Preview</title>
</head>
<body>
${code}
</body>
</html>`
    }

    socket.emit('output', {
      stream: 'system',
      data: `HTML preview ready.\n`,
      promptLike: false,
    })

    // Emit the HTML content directly to the frontend.
    // This works on both local (Caddy gateway) and cloud (Render) deployments
    // without needing a separate HTTP server.
    socket.emit('html_preview', { html: htmlContent })

    // Exit immediately — the preview is served client-side via srcdoc
    socket.emit('exit', {
      code: 0, signal: null, timedOut: false, durationMs: 0,
    })

    // Return a dummy process that's already "exited"
    return spawn('true', [], { stdio: ['ignore', 'ignore', 'ignore'] })
  }

  /**
   * spawnSql — executes user's SQL using Python's built-in sqlite3 module.
   *
   * Strategy:
   *   1. Write a small Python wrapper script that:
   *      - Opens an in-memory SQLite database
   *      - Splits the user's SQL by `;` and executes each statement
   *      - For SELECT statements, prints results as an ASCII table
   *      - For INSERT/UPDATE/DELETE, prints the affected row count
   *      - For CREATE TABLE/etc., prints a confirmation
   *      - Catches and prints any errors with context
   *   2. Pipe the user's SQL to the wrapper's stdin
   *   3. Stream stdout/stderr to the client like other languages
   *
   * Using Python+sqlite3 means we get standard SQL syntax, in-memory
   * isolation (each run starts fresh), and no need to install anything
   * (sqlite3 is part of Python's stdlib).
   */
  async function spawnSql(code: string, sessionId: string, socket: any): Promise<ChildProcess> {
    const wrapperScript = `#!/usr/bin/env python3
import sys
import sqlite3
import re

def fmt_table(headers, rows):
    """Format query results as a markdown-style ASCII table."""
    if not headers and not rows:
        return "(no rows)"
    # Compute column widths
    str_rows = [[("" if v is None else str(v)) for v in row] for row in rows]
    widths = [len(h) for h in headers]
    for row in str_rows:
        for i, v in enumerate(row):
            if i < len(widths):
                widths[i] = max(widths[i], len(v))
    # Build separator
    sep = "+" + "+".join("-" * (w + 2) for w in widths) + "+"
    # Header row
    hdr = "|" + "|".join(" " + h.ljust(w) + " " for h, w in zip(headers, widths)) + "|"
    out = [sep, hdr, sep]
    # Data rows
    for row in str_rows:
        cells = []
        for i, v in enumerate(row):
            if i < len(widths):
                cells.append(" " + v.ljust(widths[i]) + " ")
        out.append("|" + "|".join(cells) + "|")
    out.append(sep)
    return "\\n".join(out)

def split_sql(sql_text):
    """Split SQL text into individual statements.
    Handles strings with embedded semicolons and single-line / multi-line comments.
    """
    # Strip line comments (-- ...) and /* ... */ block comments first
    cleaned = re.sub(r"/\\*.*?\\*/", " ", sql_text, flags=re.DOTALL)
    lines = []
    for line in cleaned.splitlines():
        # Remove -- line comments (but keep ; inside them is fine since we drop the line)
        # Be careful: -- inside a string should not be treated as a comment, but
        # that's an edge case we can accept for now.
        if line.strip().startswith("--"):
            continue
        # Truncate at -- if not inside a string
        in_str = False
        out_chars = []
        i = 0
        while i < len(line):
            c = line[i]
            if c == "'":
                in_str = not in_str
                out_chars.append(c)
            elif c == "-" and i + 1 < len(line) and line[i+1] == "-" and not in_str:
                break
            else:
                out_chars.append(c)
            i += 1
        lines.append("".join(out_chars))
    text = "\\n".join(lines)
    # Now split by ; (handling string literals)
    statements = []
    cur = []
    in_str = False
    i = 0
    while i < len(text):
        c = text[i]
        if c == "'":
            in_str = not in_str
            cur.append(c)
        elif c == ";" and not in_str:
            stmt = "".join(cur).strip()
            if stmt:
                statements.append(stmt)
            cur = []
        else:
            cur.append(c)
        i += 1
    # Trailing statement without semicolon
    last = "".join(cur).strip()
    if last:
        statements.append(last)
    return statements

def main():
    sql = sys.stdin.read()
    if not sql.strip():
        print("(no SQL provided)")
        return 1
    # In-memory database (per-run, isolated)
    conn = sqlite3.connect(":memory:")
    conn.row_factory = None  # use plain tuples
    cur = conn.cursor()
    statements = split_sql(sql)
    print(f"SQLite {sqlite3.sqlite_version}  |  {len(statements)} statement(s)")
    print("-" * 60)
    exit_code = 0
    for i, stmt in enumerate(statements, 1):
        # Detect statement type for nicer output
        first_word = re.match(r"\\s*(\\w+)", stmt, re.IGNORECASE)
        kind = first_word.group(1).upper() if first_word else "?"
        try:
            cur.execute(stmt)
            if stmt.lstrip().upper().startswith("SELECT") or kind in ("SELECT", "WITH", "PRAGMA", "EXPLAIN"):
                rows = cur.fetchall()
                headers = [d[0] for d in cur.description] if cur.description else []
                if rows:
                    print(f"[{i}] {kind} -> {len(rows)} row(s):")
                    print(fmt_table(headers, rows))
                else:
                    print(f"[{i}] {kind} -> 0 rows")
            elif kind in ("INSERT", "UPDATE", "DELETE"):
                print(f"[{i}] {kind} -> {cur.rowcount} row(s) affected")
            elif kind == "CREATE":
                # Try to extract object type and name
                m = re.match(r"\\s*CREATE\\s+(\\w+)\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(\\w+)", stmt, re.IGNORECASE)
                if m:
                    print(f"[{i}] CREATE {m.group(1).upper()} {m.group(2)} - OK")
                else:
                    print(f"[{i}] CREATE - OK")
            elif kind == "DROP":
                print(f"[{i}] DROP - OK")
            elif kind == "INSERT" or kind == "BEGIN" or kind == "COMMIT" or kind == "ROLLBACK":
                print(f"[{i}] {kind} - OK")
            else:
                print(f"[{i}] {kind} - OK")
        except sqlite3.Error as e:
            exit_code = 1
            print(f"[{i}] ERROR ({kind}): {e}")
            print(f"    Statement: {stmt[:100]}{'...' if len(stmt) > 100 else ''}")
    print("-" * 60)
    conn.close()
    return exit_code

if __name__ == "__main__":
    sys.exit(main())
`

    // Write the wrapper script to a temp file
    const workspaceRoot = join('/tmp/sql-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'run_sql.py')
    try {
      await writeFile(scriptPath, wrapperScript, { encoding: 'utf8', mode: 0o700 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write SQL runner: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: 1, signal: null, timedOut: false, durationMs: 0,
      })
      // Return a dummy child to satisfy the type — the error is already emitted
      return spawn('true', [], { stdio: ['ignore', 'ignore', 'ignore'] })
    }

    // Spawn python3 with the wrapper script, piping SQL code to its stdin
    const child = spawn('python3', [scriptPath], {
      cwd: workspaceRoot,
      env: { ...process.env } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    // Write the SQL code to stdin and close it
    child.stdin?.write(code)
    child.stdin?.end()

    return child
  }

  /**
   * spawnKotlin — runs PURE Kotlin/JVM code (NOT Android) via kotlinc.
   * Compiles with -include-runtime then runs the JAR with java -jar.
   */
  async function spawnKotlin(code: string, sessionId: string, socket: any): Promise<ChildProcess | null> {
    const workspaceRoot = join('/tmp/kotlin-console', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'snippet.kt')
    const jarPath = join(workspaceRoot, 'snippet.jar')

    try {
      await writeFile(scriptPath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write Kotlin file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    const kotlincPath = existsSync('/home/z/.local/kotlinc/bin/kotlinc')
      ? '/home/z/.local/kotlinc/bin/kotlinc'
      : 'kotlinc'

    socket.emit('output', {
      stream: 'system',
      data: `Compiling with kotlinc 2.0.21 (Kotlin/JVM)...\n`,
      promptLike: false,
    })

    const child = spawn('bash', ['-c', `${kotlincPath} -nowarn -include-runtime "${scriptPath}" -d "${jarPath}" 2>&1 && echo "---RUNNING---" && java -jar "${jarPath}" 2>&1`], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        JAVA_TOOL_OPTIONS: '-Dfile.encoding=UTF-8',
        PATH: '/home/z/.local/kotlinc/bin:' + (process.env.PATH || ''),
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * spawnGo — runs Go code via `go run`.
   */
  async function spawnGo(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    // Multi-file mode: write all files, run `go run .` from the workspace dir.
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    const goBin = existsSync('/home/z/.local/go/bin/go')
      ? '/home/z/.local/go/bin/go'
      : 'go'

    if (isMultiFile && entryPath) {
      socket.emit('output', {
        stream: 'system',
        data: `Running with Go 1.23...\n`,
        promptLike: false,
      })
      // List all .go files in the workspace and pass them explicitly to
      // `go run`. This avoids the need for a go.mod file (which `go run .`
      // requires in module mode).
      const { readdirSync } = require('fs')
      const goFiles = readdirSync(workspaceDir)
        .filter((f: string) => f.endsWith('.go'))
        .map((f: string) => join(workspaceDir, f))
      const child = spawn(goBin, ['run', ...goFiles], {
        cwd: workspaceDir,
        env: {
          ...process.env,
          PATH: '/home/z/.local/go/bin:' + (process.env.PATH || ''),
          GOROOT: '/home/z/.local/go',
          GO111MODULE: 'off',
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy)
    const workspaceRoot = join('/tmp/go-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'main.go')

    try {
      await writeFile(scriptPath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write Go file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Running with Go 1.23...\n`,
      promptLike: false,
    })

    const child = spawn(goBin, ['run', scriptPath], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PATH: '/home/z/.local/go/bin:' + (process.env.PATH || ''),
        GOROOT: '/home/z/.local/go',
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * spawnTypeScript — runs TypeScript code via `bun` (native TS support, no compilation needed).
   */
  async function spawnTypeScript(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    // Multi-file mode: write all files to a per-session workspace and run the entry file.
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    if (isMultiFile && entryPath) {
      socket.emit('output', {
        stream: 'system',
        data: `Running with bun (TypeScript)...\n`,
        promptLike: false,
      })
      const child = spawn('bun', ['run', entryPath], {
        cwd: workspaceDir,
        env: { ...process.env } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy)
    const workspaceRoot = join('/tmp/ts-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'index.ts')

    try {
      await writeFile(scriptPath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write TypeScript file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Running with bun (TypeScript)...\n`,
      promptLike: false,
    })

    const child = spawn('bun', ['run', scriptPath], {
      cwd: workspaceRoot,
      env: { ...process.env } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * spawnSql — executes user's SQL using Python's built-in sqlite3 module.
   *
   * Strategy:
   *   1. Write a small Python wrapper script that:
   *      - Opens an in-memory SQLite database
   *      - Splits the user's SQL by `;` and executes each statement
   *      - For SELECT statements, prints results as an ASCII table
   *      - For INSERT/UPDATE/DELETE, prints the affected row count
   *      - For CREATE TABLE/etc., prints a confirmation
   *      - Catches and prints any errors with context
   *   2. Pipe the user's SQL to the wrapper's stdin
   *   3. Stream stdout/stderr to the client like other languages
   *
   * Using Python+sqlite3 means we get standard SQL syntax, in-memory
   * isolation (each run starts fresh), and no need to install anything
   * (sqlite3 is part of Python's stdlib).
   */
  async function spawnRust(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    const rustcPath = existsSync('/home/z/.cargo/bin/rustc')
      ? '/home/z/.cargo/bin/rustc'
      : 'rustc'

    // Multi-file mode: write all files, compile the entry file (rustc resolves `mod helper;` automatically).
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    if (isMultiFile && entryPath) {
      const binPath = join(workspaceDir, 'rust_bin')
      socket.emit('output', {
        stream: 'system',
        data: `Compiling with rustc 1.98...\n`,
        promptLike: false,
      })
      const child = spawn('bash', ['-c', `${rustcPath} -O "${entryPath}" -o "${binPath}" 2>&1 && echo "---RUNNING---" && "${binPath}" 2>&1`], {
        cwd: workspaceDir,
        env: {
          ...process.env,
          PATH: '/home/z/.cargo/bin:' + (process.env.PATH || ''),
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy)
    const workspaceRoot = join('/tmp/rust-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'main.rs')
    const binPath = join(workspaceRoot, 'main_bin')

    try {
      await writeFile(scriptPath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write Rust file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Compiling with rustc 1.98...\n`,
      promptLike: false,
    })

    // Compile + run in one step
    const child = spawn('bash', ['-c', `${rustcPath} -O "${scriptPath}" -o "${binPath}" 2>&1 && echo "---RUNNING---" && "${binPath}" 2>&1`], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PATH: '/home/z/.cargo/bin:' + (process.env.PATH || ''),
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * spawnRuby — runs Ruby code via ruby interpreter.
   * Multi-file: `require_relative './helper'` works because all files are
   * in the same workspace dir.
   */
  async function spawnRuby(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    const rubyBin = existsSync('/home/z/.local/ruby/bin/ruby')
      ? '/home/z/.local/ruby/bin/ruby'
      : 'ruby'

    // Multi-file mode: write all files, run the entry file directly.
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    if (isMultiFile && entryPath) {
      socket.emit('output', {
        stream: 'system',
        data: `Running with Ruby 3.3...\n`,
        promptLike: false,
      })
      const child = spawn(rubyBin, [entryPath], {
        cwd: workspaceDir,
        env: {
          ...process.env,
          PATH: '/home/z/.local/ruby/bin:' + (process.env.PATH || ''),
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy)
    const workspaceRoot = join('/tmp/ruby-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'main.rb')

    // Prepend STDOUT.sync = true to disable output buffering
    const preamble = code.includes('STDOUT.sync') ? '' : 'STDOUT.sync = true\n'
    const finalCode = preamble + code

    try {
      await writeFile(scriptPath, finalCode, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write Ruby file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Running with Ruby 3.3...\n`,
      promptLike: false,
    })

    const child = spawn(rubyBin, [scriptPath], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PATH: '/home/z/.local/ruby/bin:' + (process.env.PATH || ''),
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * spawnSwift — runs Swift code via swift interpreter.
   * Multi-file: `swift main.swift helper.swift` passes all files to the
   * Swift compiler/interpreter as one program.
   */
  async function spawnSwift(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    const swiftBin = existsSync('/home/z/.local/swift/usr/bin/swift')
      ? '/home/z/.local/swift/usr/bin/swift'
      : 'swift'

    // Multi-file mode: write all files, pass all .swift files to swift.
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    if (isMultiFile && entryPath) {
      socket.emit('output', {
        stream: 'system',
        data: `Running with Swift 5.10...\n`,
        promptLike: false,
      })
      // `swift file1.swift file2.swift` treats them as one program.
      const child = spawn(swiftBin, ['*.swift'], {
        cwd: workspaceDir,
        env: {
          ...process.env,
          PATH: '/home/z/.local/swift/usr/bin:' + (process.env.PATH || ''),
          LD_LIBRARY_PATH: '/home/z/.local/swift-fix:/home/z/.local/swift/usr/lib/swift/linux:/home/z/.local/swift/usr/lib:/usr/lib/x86_64-linux-gnu',
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: true,  // needed for *.swift glob expansion
      })
      return child
    }

    // Single-file mode (legacy)
    const workspaceRoot = join('/tmp/swift-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})

    // If code uses @main attribute, transform it to top-level code:
    // Remove @main line, add ClassName.main() at the end
    let finalCode = code
    const hasMainAttribute = /^\s*@main\s*$/m.test(code)
    if (hasMainAttribute) {
      finalCode = code.replace(/^\s*@main\s*$/m, '')
      const mainMatch = code.match(/@main\s*\n\s*(?:struct|class|enum)\s+(\w+)/)
      if (mainMatch) {
        finalCode += '\n' + mainMatch[1] + '.main()\n'
      }
    }

    const scriptPath = join(workspaceRoot, 'main.swift')

    try {
      await writeFile(scriptPath, finalCode, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write Swift file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Running with Swift 5.10...\n`,
      promptLike: false,
    })

    const child = spawn(swiftBin, [scriptPath], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PATH: '/home/z/.local/swift/usr/bin:' + (process.env.PATH || ''),
        LD_LIBRARY_PATH: '/home/z/.local/swift-fix:/home/z/.local/swift/usr/lib/swift/linux:/home/z/.local/swift/usr/lib:/usr/lib/x86_64-linux-gnu',
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * spawnLua — runs Lua code via lua interpreter.
   * Multi-file: `require('helper')` works because we set package.path to
   * include the workspace dir.
   */
  async function spawnLua(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    const luaBin = existsSync('/home/z/.local/lua/bin/lua')
      ? '/home/z/.local/lua/bin/lua'
      : 'lua'

    // Multi-file mode
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    if (isMultiFile && entryPath) {
      socket.emit('output', {
        stream: 'system',
        data: `Running with Lua 5.4...\n`,
        promptLike: false,
      })
      // Set LUA_PATH so require('helper') resolves to ./helper.lua
      const luaPath = workspaceDir + '/?.lua;;'
      const child = spawn(luaBin, [entryPath], {
        cwd: workspaceDir,
        env: {
          ...process.env,
          PATH: '/home/z/.local/lua/bin:' + (process.env.PATH || ''),
          LUA_PATH: luaPath,
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy)
    const workspaceRoot = join('/tmp/lua-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'main.lua')

    const preamble = code.includes('setvbuf') ? '' : 'io.stdout:setvbuf("no")\n'
    const finalCode = preamble + code

    try {
      await writeFile(scriptPath, finalCode, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write Lua file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Running with Lua 5.4...\n`,
      promptLike: false,
    })

    const child = spawn(luaBin, [scriptPath], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PATH: '/home/z/.local/lua/bin:' + (process.env.PATH || ''),
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * spawnPerl — runs Perl code via perl interpreter.
   * Multi-file: `require './helper.pl'` works because all files are in the
   * same workspace dir.
   */
  async function spawnPerl(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    // Multi-file mode
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    if (isMultiFile && entryPath) {
      socket.emit('output', {
        stream: 'system',
        data: `Running with Perl 5.40...\n`,
        promptLike: false,
      })
      const child = spawn('perl', [entryPath], {
        cwd: workspaceDir,
        env: { ...process.env } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy)
    const workspaceRoot = join('/tmp/perl-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'main.pl')

    const preamble = code.includes('$|') ? '' : 'BEGIN { $| = 1; }\n'
    const finalCode = preamble + code

    try {
      await writeFile(scriptPath, finalCode, { encoding: 'utf8', mode: 0o700 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write Perl file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Running with Perl 5.40...\n`,
      promptLike: false,
    })

    const child = spawn('perl', [scriptPath], {
      cwd: workspaceRoot,
      env: { ...process.env } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    // Write the SQL code to stdin and close it
    child.stdin?.write(code)
    child.stdin?.end()

    return child
  }

  async function spawnPowerShell(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    const pwshBin = existsSync('/home/z/.local/pwsh/pwsh')
      ? '/home/z/.local/pwsh/pwsh'
      : 'pwsh'

    // Multi-file mode
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    if (isMultiFile && entryPath) {
      socket.emit('output', {
        stream: 'system',
        data: `Running with PowerShell 7.4...\n`,
        promptLike: false,
      })
      const child = spawn(pwshBin, ['-NoProfile', '-File', entryPath], {
        cwd: workspaceDir,
        env: {
          ...process.env,
          PATH: '/home/z/.local/pwsh:' + (process.env.PATH || ''),
          DOTNET_ROOT: '/home/z/.local/pwsh',
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy)
    const workspaceRoot = join('/tmp/pwsh-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'main.ps1')

    try {
      await writeFile(scriptPath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write PowerShell file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Running with PowerShell 7.4...\n`,
      promptLike: false,
    })

    const child = spawn(pwshBin, ['-NoProfile', '-File', scriptPath], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PATH: '/home/z/.local/pwsh:' + (process.env.PATH || ''),
        DOTNET_ROOT: '/home/z/.local/pwsh',
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * spawnBash — runs Bash shell script via bash.
   * Multi-file: `source ./helper.sh` works because all files are in the same workspace dir.
   */
  async function spawnBash(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    // Multi-file mode
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    if (isMultiFile && entryPath) {
      socket.emit('output', {
        stream: 'system',
        data: `Running with Bash 5.2...\n`,
        promptLike: false,
      })
      const child = spawn('bash', [entryPath], {
        cwd: workspaceDir,
        env: { ...process.env } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy)
    const workspaceRoot = join('/tmp/bash-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'script.sh')

    try {
      await writeFile(scriptPath, code, { encoding: 'utf8', mode: 0o700 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write Bash file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Running with Bash 5.2...\n`,
      promptLike: false,
    })

    const child = spawn('bash', [scriptPath], {
      cwd: workspaceRoot,
      env: { ...process.env } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * spawnFortran — compiles and runs Fortran code via gfortran.
   * Multi-file: compiles all .f90 files together (e.g. module + program).
   */
  async function spawnFortran(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    const gfortranBin = existsSync('/home/z/.local/gfortran/usr/bin/gfortran-14')
      ? '/home/z/.local/gfortran/usr/bin/gfortran-14'
      : 'gfortran'
    const fortLibDir = '/home/z/.local/gfortran/usr/lib/x86_64-linux-gnu'

    // Multi-file mode
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    if (isMultiFile && entryPath) {
      const binPath = join(workspaceDir, 'fortran_bin')
      socket.emit('output', {
        stream: 'system',
        data: `Compiling with gfortran 14.2...\n`,
        promptLike: false,
      })
      // Compile all .f90 files together; order matters for modules so we
      // compile them all in one invocation.
      const child = spawn('bash', ['-c',
        `${gfortranBin} *.f90 -o "${binPath}" -L${fortLibDir} 2>&1 && echo "---RUNNING---" && LD_LIBRARY_PATH=${fortLibDir} "${binPath}" 2>&1`
      ], {
        cwd: workspaceDir,
        env: {
          ...process.env,
          PATH: '/home/z/.local/gfortran/usr/bin:' + (process.env.PATH || ''),
          LIBRARY_PATH: fortLibDir,
          LD_LIBRARY_PATH: fortLibDir,
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy)
    const workspaceRoot = join('/tmp/fortran-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'main.f90')
    const binPath = join(workspaceRoot, 'main_bin')

    try {
      await writeFile(scriptPath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write Fortran file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Compiling with gfortran 14.2...\n`,
      promptLike: false,
    })

    const child = spawn('bash', ['-c',
      `${gfortranBin} "${scriptPath}" -o "${binPath}" -L${fortLibDir} 2>&1 && echo "---RUNNING---" && LD_LIBRARY_PATH=${fortLibDir} "${binPath}" 2>&1`
    ], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PATH: '/home/z/.local/gfortran/usr/bin:' + (process.env.PATH || ''),
        LIBRARY_PATH: fortLibDir,
        LD_LIBRARY_PATH: fortLibDir,
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * spawnCobol — compiles and runs COBOL code via GnuCOBOL (cobc).
   * Multi-file: compiles all .cob files together so CALL subprograms resolve.
   */
  async function spawnCobol(code: string, sessionId: string, socket: any, payload?: RunPayload): Promise<ChildProcess | null> {
    const cobcBin = existsSync('/home/z/.local/gnucobol/bin/cobc')
      ? '/home/z/.local/gnucobol/bin/cobc'
      : 'cobc'
    const cobolLib = '/home/z/.local/gnucobol/lib'
    const dbLib = '/home/z/.local/gnucobol-deps/usr/lib/x86_64-linux-gnu'

    // Multi-file mode
    const { workspaceDir, entryPath, isMultiFile } = await setupMultiFileWorkspace(payload, sessionId)

    if (isMultiFile && entryPath) {
      const binPath = join(workspaceDir, 'cobol_bin')
      socket.emit('output', {
        stream: 'system',
        data: `Compiling with GnuCOBOL 3.2...\n`,
        promptLike: false,
      })
      // Compile all .cob files together as a single executable.
      // `-x` builds an executable; multiple .cob files in one invocation
      // are linked together so CALL subprograms resolve.
      const child = spawn('bash', ['-c',
        `${cobcBin} -x -o "${binPath}" *.cob 2>&1 && echo "---RUNNING---" && LD_LIBRARY_PATH=${cobolLib}:${dbLib} "${binPath}" 2>&1`
      ], {
        cwd: workspaceDir,
        env: {
          ...process.env,
          PATH: '/home/z/.local/gnucobol/bin:' + (process.env.PATH || ''),
          LD_LIBRARY_PATH: `${cobolLib}:${dbLib}`,
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return child
    }

    // Single-file mode (legacy)
    const workspaceRoot = join('/tmp/cobol-runner', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    const scriptPath = join(workspaceRoot, 'main.cbl')
    const binPath = join(workspaceRoot, 'main_bin')

    try {
      // Ensure the source ends with a newline to avoid the cobc warning:
      // "line not terminated by a newline [-Wmissing-newline]"
      const safeCode = code.endsWith('\n') ? code : code + '\n'
      await writeFile(scriptPath, safeCode, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write COBOL file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', { code: 1, signal: null, timedOut: false, durationMs: 0 })
      return null
    }

    socket.emit('output', {
      stream: 'system',
      data: `Compiling with GnuCOBOL 3.2...\n`,
      promptLike: false,
    })

    const child = spawn('bash', ['-c',
      `${cobcBin} -x -o "${binPath}" "${scriptPath}" 2>&1 && echo "---RUNNING---" && LD_LIBRARY_PATH=${cobolLib}:${dbLib} "${binPath}" 2>&1`
    ], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PATH: '/home/z/.local/gnucobol/bin:' + (process.env.PATH || ''),
        LD_LIBRARY_PATH: `${cobolLib}:${dbLib}`,
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    return child
  }

  /**
   * spawnKotlinAndroid — validates an Android project STRUCTURALLY.
   * Does NOT run kotlinc on .kt files (because android.* / androidx.* / R.*
   * can't resolve without the Android SDK, producing false errors).
   *
   * Validates:
   *   - Required files (AndroidManifest.xml, build.gradle.kts, MainActivity.kt)
   *   - XML well-formedness
   *   - Resource references (@string/, @color/, @layout/)
   */
  async function spawnKotlinAndroid(payload: RunPayload, sessionId: string, socket: any): Promise<ChildProcess | null> {
    const files = payload.files || {}
    const action = payload.action || 'validate'

    if (Object.keys(files).length === 0) {
      socket.emit('output', {
        stream: 'stderr',
        data: 'No project files provided.\n',
        promptLike: false,
      })
      socket.emit('exit', { code: 0, signal: null, timedOut: false, durationMs: 0 })
      return spawn('true', [], { stdio: ['ignore', 'ignore', 'ignore'] })
    }

    // Write all files to workspace
    const workspaceRoot = join('/tmp/kotlin-android', sessionId)
    await mkdir(workspaceRoot, { recursive: true }).catch(() => {})
    for (const [relPath, content] of Object.entries(files)) {
      if (relPath.startsWith('/') || relPath.includes('..')) continue
      const absPath = join(workspaceRoot, relPath)
      const dir = dirname(absPath)
      await mkdir(dir, { recursive: true }).catch(() => {})
      try {
        await writeFile(absPath, content, { encoding: 'utf8', mode: 0o600 })
      } catch { /* ignore */ }
    }

    // Structural validation
    const errors: string[] = []
    const warnings: string[] = []
    const ok: string[] = []

    const manifestPath = Object.keys(files).find(p => p.endsWith('AndroidManifest.xml'))
    const buildGradlePath = Object.keys(files).find(p => p.endsWith('build.gradle.kts') || p.endsWith('build.gradle'))
    const mainActivityPath = Object.keys(files).find(p => p.endsWith('MainActivity.kt'))

    if (!manifestPath) errors.push('Missing AndroidManifest.xml')
    else ok.push(`✓ AndroidManifest.xml found (${manifestPath})`)
    if (!buildGradlePath) errors.push('Missing build.gradle.kts')
    else ok.push(`✓ Gradle build file found (${buildGradlePath})`)
    if (!mainActivityPath) warnings.push('No MainActivity.kt found')
    else ok.push(`✓ MainActivity.kt found (${mainActivityPath})`)

    // Validate XML well-formedness
    let xmlCount = 0
    for (const [relPath, content] of Object.entries(files)) {
      if (!relPath.endsWith('.xml')) continue
      xmlCount++
      const openTags: string[] = []
      const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9_-]*)[^>]*?(\/?)>/g
      let m
      let matchErr = null
      while ((m = tagRegex.exec(content)) !== null) {
        const [fullMatch, tagName, selfClose] = m
        if (fullMatch.startsWith('</')) {
          const top = openTags.pop()
          if (top !== tagName) {
            matchErr = `Mismatched closing tag: expected </${top}> but found </${tagName}>`
            break
          }
        } else if (selfClose !== '/') {
          openTags.push(tagName)
        }
      }
      if (matchErr) errors.push(`${relPath}: ${matchErr}`)
      else if (openTags.length > 0) errors.push(`${relPath}: Unclosed tags: ${openTags.join(', ')}`)
    }
    if (xmlCount > 0) ok.push(`✓ ${xmlCount} XML file(s) parsed successfully`)

    // Cross-check @string/, @color/, @layout/ references
    const stringResources = new Set<string>()
    const colorResources = new Set<string>()
    const layoutResources = new Set<string>()
    for (const [relPath, content] of Object.entries(files)) {
      if (relPath.endsWith('/values/strings.xml')) {
        const re = /<string\s+name="([^"]+)"/g
        let m
        while ((m = re.exec(content)) !== null) stringResources.add(m[1])
      }
      if (relPath.endsWith('/values/colors.xml')) {
        const re = /<color\s+name="([^"]+)"/g
        let m
        while ((m = re.exec(content)) !== null) colorResources.add(m[1])
      }
      if (relPath.includes('/layout/') && relPath.endsWith('.xml')) {
        layoutResources.add(relPath.split('/').pop()!.replace('.xml', ''))
      }
    }
    let refCount = 0
    let danglingRefs = 0
    for (const [relPath, content] of Object.entries(files)) {
      if (!relPath.endsWith('.xml')) continue
      const refs = content.match(/@(string|color|layout|drawable|mipmap)\/([a-zA-Z_][a-zA-Z0-9_]*)/g) || []
      for (const ref of refs) {
        refCount++
        const [type, name] = ref.slice(1).split('/')
        if (type === 'string' && !stringResources.has(name)) {
          warnings.push(`${relPath}: references @string/${name} but it's not defined in strings.xml`)
          danglingRefs++
        }
        if (type === 'color' && !colorResources.has(name)) {
          warnings.push(`${relPath}: references @color/${name} but it's not defined in colors.xml`)
          danglingRefs++
        }
        if (type === 'layout' && !layoutResources.has(name)) {
          warnings.push(`${relPath}: references @layout/${name} but no layout file found`)
          danglingRefs++
        }
      }
    }
    if (refCount > 0) {
      ok.push(`✓ Checked ${refCount} resource reference(s)${danglingRefs > 0 ? ` (${danglingRefs} dangling)` : ''}`)
    }

    // For 'build' action: honestly explain APK build is not possible
    if (action === 'build') {
      socket.emit('output', {
        stream: 'system',
        data: `\n=== Build APK not available in this sandbox ===\n` +
              `This online compiler does NOT have Gradle + Android SDK installed,\n` +
              `so it cannot generate a real APK.\n\n` +
              `To build an APK on your own machine:\n` +
              `  1. Install Android Studio: https://developer.android.com/studio\n` +
              `  2. Click "Download ZIP" to save the project\n` +
              `  3. Unzip and open the folder in Android Studio\n` +
              `  4. Run: ./gradlew assembleDebug\n` +
              `The APK will be at: app/build/outputs/apk/debug/app-debug.apk\n` +
              `==================================================\n\n`,
        promptLike: false,
      })
    }

    // Emit validation results
    socket.emit('output', {
      stream: 'system',
      data: `=== Android Project Structural Validation ===\n` +
            `Files: ${Object.keys(files).length} total (${xmlCount} XML, ${Object.keys(files).filter(p => p.endsWith('.kt')).length} Kotlin)\n\n`,
      promptLike: false,
    })
    for (const line of ok) {
      socket.emit('output', { stream: 'stdout', data: line + '\n', promptLike: false })
    }
    for (const line of warnings) {
      socket.emit('output', { stream: 'stderr', data: `⚠  ${line}\n`, promptLike: false })
    }
    for (const line of errors) {
      socket.emit('output', { stream: 'stderr', data: `✗  ${line}\n`, promptLike: false })
    }
    socket.emit('output', {
      stream: 'system',
      data: `\n${errors.length === 0 ? '✓ Structural validation passed' : `✗ ${errors.length} error(s) found`}. ` +
            `${warnings.length} warning(s). ` +
            `Use "Preview Layout" to render the layout visually, or ` +
            `"Download ZIP" to build locally with Android Studio.\n`,
      promptLike: false,
    })

    const exitCode = errors.length > 0 ? 1 : 0
    socket.emit('exit', { code: exitCode, signal: null, timedOut: false, durationMs: 0 })
    return spawn('true', [], { stdio: ['ignore', 'ignore', 'ignore'] })
  }


  socket.on('run', async (payload: RunPayload) => {
    console.log('[runner] received run event, language:', payload?.language, 'code length:', payload?.code?.length)
    // Clear the workspace dir tracker from the previous run.
    ;(globalThis as any).__lastWorkspaceDir = null
    // If a previous session is still alive on this socket, kill it first.
    const prev = sessions.get(socket.id)
    if (prev) {
      killSession(prev, 'client_disconnect')
      sessions.delete(socket.id)
    }

    const code = typeof payload?.code === 'string' ? payload.code : ''
    const language = payload?.language ?? 'python'
    const requestedTimeout = Number(payload?.timeout) || DEFAULT_TIMEOUT_MS
    const timeoutMs = Math.min(
      Math.max(requestedTimeout, 1000),
      MAX_TIMEOUT_MS,
    )

    if (language !== 'kotlin-android' && !code.trim()) {
      // Multi-file Python projects send an empty `code` plus a `files`
      // payload + `entryFile`. Allow those through.
      const hasMultiFile = !!payload?.files && Object.keys(payload.files).length > 0 && !!payload.entryFile
      if (!hasMultiFile) {
        socket.emit('output', {
          stream: 'stderr',
          data: 'No code provided.\n',
          promptLike: false,
        })
        socket.emit('exit', {
          code: 0,
          signal: null,
          timedOut: false,
          durationMs: 0,
        })
        return
      }
    }

    const sessionId = randomUUID()
    // For Python we spawn directly. For Java/C/C++ we compile first, then spawn.
    let child: ChildProcess

    if (language === 'java') {
      child = await spawnJava(code, sessionId, socket, payload)
    } else if (language === 'c') {
      child = await spawnC(code, sessionId, socket)
    } else if (language === 'cpp') {
      child = await spawnCpp(code, sessionId, socket)
    } else if (language === 'r') {
      child = await spawnR(code, sessionId, socket)
    } else if (language === 'javascript') {
      child = await spawnJavaScript(code, sessionId, socket, payload)
    } else if (language === 'php') {
      child = await spawnPHP(code, sessionId, socket)
    } else if (language === 'csharp') {
      child = await spawnCSharp(code, sessionId, socket)
    } else if (language === 'dart') {
      child = await spawnDart(code, sessionId, socket)
    } else if (language === 'flutter') {
      child = await spawnFlutter(code, sessionId, socket, payload.stdin)
    } else if (language === 'html') {
      child = await spawnHtml(code, sessionId, socket)
    } else if (language === 'sql') {
      child = await spawnSql(code, sessionId, socket)
    } else if (language === 'kotlin') {
      child = await spawnKotlin(code, sessionId, socket, payload)
      child = await spawnKotlin(code, sessionId, socket)
    } else if (language === 'go') {
      child = await spawnGo(code, sessionId, socket, payload)
    } else if (language === 'typescript') {
      child = await spawnTypeScript(code, sessionId, socket, payload)
    } else if (language === 'rust') {
      child = await spawnRust(code, sessionId, socket, payload)
    } else if (language === 'ruby') {
      child = await spawnRuby(code, sessionId, socket, payload)
    } else if (language === 'swift') {
      child = await spawnSwift(code, sessionId, socket, payload)
    } else if (language === 'lua') {
      child = await spawnLua(code, sessionId, socket, payload)
    } else if (language === 'perl') {
      child = await spawnPerl(code, sessionId, socket, payload)
    } else if (language === 'powershell') {
      child = await spawnPowerShell(code, sessionId, socket, payload)
    } else if (language === 'bash') {
      child = await spawnBash(code, sessionId, socket, payload)
    } else if (language === 'fortran') {
      child = await spawnFortran(code, sessionId, socket, payload)
    } else if (language === 'cobol') {
      child = await spawnCobol(code, sessionId, socket, payload)
    } else if (language === 'kotlin-android') {
      child = await spawnKotlinAndroid(payload, sessionId, socket)
    } else {
      child = await spawnPython(code, sessionId, socket, payload)
    }

    if (!child) return // Error already emitted by spawn function

    // Determine the binary name for error messages (replaces the old
    // hardcoded "Failed to spawn python3" message that was shown for ALL languages).
    const BINARY_NAMES: Record<string, string> = {
      python: 'python3', java: 'java', c: 'gcc', cpp: 'g++', r: 'Rscript',
      javascript: 'node', php: 'php', csharp: 'dotnet', dart: 'dart',
      flutter: 'flutter', html: 'node', sql: 'sqlite3', kotlin: 'kotlinc',
      go: 'go', typescript: 'bun', rust: 'rustc', ruby: 'ruby',
      swift: 'swift', lua: 'lua', perl: 'perl', powershell: 'pwsh',
      bash: 'bash', fortran: 'gfortran', cobol: 'cobc',
      'kotlin-android': 'kotlinc',
    }
    const binaryName = BINARY_NAMES[language] ?? 'interpreter'

    // Track the workspace dir for cleanup (set by setupMultiFileWorkspace).
    // We read it from the global state set during spawn* execution.
    const workspaceDir = (globalThis as any).__lastWorkspaceDir ?? null

    const session: Session = {
      child,
      startedAt: Date.now(),
      timeoutMs,
      timer: null,
      killed: false,
      totalStdout: 0,
      totalStderr: 0,
      pendingPromptText: '',
      stdoutBuffer: '',
      serverDetected: false,
      stdinIdleTimer: null,
      receivedInteractiveInput: false,
      binaryName,
      workspaceDir,
    }

    sessions.set(socket.id, session)
    setupSession(socket.id, session, socket)

    // If pre-piped stdin was provided, write it to the child's stdin now.
    // This is the "Program Input" feature: user types input values upfront
    // (one per line) and they're fed to the program's stdin immediately.
    // Works with: Python input(), Java Scanner, C scanf, C++ cin/getline,
    // R readline() (via our preamble override), readLines(file("stdin")).
    if (typeof payload.stdin === 'string' && payload.stdin.length > 0) {
      try {
        child.stdin?.write(payload.stdin)
        // If the stdin doesn't end with a newline, add one
        if (!payload.stdin.endsWith('\n')) {
          child.stdin?.write('\n')
        }
        // Close stdin after writing pre-piped input so the program gets EOF
        // and exits gracefully (instead of hanging waiting for more input).
        child.stdin?.end()
      } catch {
        /* stdin might be closed already */
      }
    } else {
      // No Program Input provided. We'll keep stdin open and let the user
      // type interactively via the console input bar. The stdin will be
      // closed when:
      //   - The process exits naturally (no more input needed)
      //   - The user clicks Stop
      //   - The timeout (30s) kills the process
      //   - The process has been idle (no stdout) for 10 seconds AND
      //     no interactive input has been sent (meaning the user probably
      //     abandoned it)
      //
      // We do NOT auto-close stdin quickly because that would kill programs
      // that are waiting for input before the user has time to type.
      session.stdinIdleTimer = setTimeout(() => {
        if (!session.killed && !session.receivedInteractiveInput) {
          // Only close if the program hasn't received ANY interactive input
          // AND has been idle for 10 seconds. This prevents the 15s timeout
          // hang while still giving the user plenty of time to type.
          try {
            child.stdin?.end()
          } catch {
            /* already closed */
          }
        }
      }, 10000) // 10 seconds — generous time for user to start typing
    }

    // Timeout watchdog
    session.timer = setTimeout(() => {
      if (session.killed) return
      session.killed = true
      if (session.stdinIdleTimer) {
        clearTimeout(session.stdinIdleTimer)
        session.stdinIdleTimer = null
      }
      try {
        child.kill('SIGKILL')
      } catch {
        /* noop */
      }
      socket.emit('output', {
        stream: 'stderr',
        data: `\n[Execution timed out after ${timeoutMs}ms and was killed.]\n`,
        promptLike: false,
      })
      socket.emit('timeout', { durationMs: timeoutMs })
    }, timeoutMs)

    socket.emit('started', { timeoutMs, scriptPath: language })
  })

  // Client sends a line of stdin (Enter pressed in the console input).
  socket.on('input', (data: { text?: string } | string) => {
    const session = sessions.get(socket.id)
    if (!session || session.killed) return
    // Mark that the user has sent interactive input — this prevents the
    // idle stdin timer from closing stdin while the user is actively typing.
    session.receivedInteractiveInput = true
    // Cancel the idle stdin timer — user is actively providing interactive input
    if (session.stdinIdleTimer) {
      clearTimeout(session.stdinIdleTimer)
      session.stdinIdleTimer = null
    }
    const text = typeof data === 'string' ? data : (data?.text ?? '')
    try {
      // Always append a newline so input() returns.
      session.child.stdin?.write(text + '\n')
    } catch {
      /* stdin closed */
    }
  })

  socket.on('stop', () => {
    const session = sessions.get(socket.id)
    if (!session) return
    killSession(session, 'stop')
    socket.emit('output', {
      stream: 'stderr',
      data: '\n[Execution stopped by user.]\n',
      promptLike: false,
    })
  })

  socket.on('disconnect', () => {
    const session = sessions.get(socket.id)
    if (session) {
      killSession(session, 'client_disconnect')
      sessions.delete(socket.id)
    }
    console.log(`[python-runner] client disconnected: ${socket.id}`)
  })

  socket.on('error', (err: unknown) => {
    console.error(`[python-runner] socket error (${socket.id}):`, err)
  })
})

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[python-runner] WebSocket server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  for (const [, session] of sessions) killSession(session, 'client_disconnect')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  for (const [, session] of sessions) killSession(session, 'client_disconnect')
  httpServer.close(() => process.exit(0))
})

// CRITICAL: Catch unhandled errors so the runner doesn't crash.
// Without these, a single bad spawn() or a child-process error can kill
// the entire runner, causing "xhr poll error" for all connected clients.
process.on('uncaughtException', (err) => {
  console.error('[python-runner] UNCAUGHT EXCEPTION (survived):', err)
  // Do NOT exit — keep the server alive so existing and new clients can reconnect.
})
process.on('unhandledRejection', (reason) => {
  console.error('[python-runner] UNHANDLED REJECTION (survived):', reason)
  // Do NOT exit — keep the server alive.
})
