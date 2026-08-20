import { createServer } from 'http'
import { Server } from 'socket.io'
import { spawn, type ChildProcess } from 'child_process'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const PORT = 3003
const MAX_OUTPUT_BYTES = 1_000_000 // 1 MB per stream
const MAX_TIMEOUT_MS = 30_000
const DEFAULT_TIMEOUT_MS = 15_000

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
  language?: 'python' | 'java'
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

function killSession(session: Session, reason: 'timeout' | 'client_disconnect' | 'stop') {
  if (session.killed) return
  session.killed = true
  if (session.timer) {
    clearTimeout(session.timer)
    session.timer = null
  }
  try {
    session.child.kill('SIGKILL')
  } catch {
    /* noop */
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
        !stripped.endsWith('\n') && !stripped.endsWith('\r\n')
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
      data: `Failed to spawn python3: ${err.message}\n`,
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
  async function spawnPython(code: string, sessionId: string, socket: any): Promise<ChildProcess | null> {
    const scriptPath = join(sandboxDir, `snippet_${sessionId}.py`)

    // Load the matplotlib preamble (sets Agg backend, patches plt.show() and
    // plt.savefig() to emit inline PNG images via the marker protocol).
    let preamble = ''
    try {
      const preamblePath = join(__dirname, 'preamble.py')
      preamble = await readFile(preamblePath, 'utf8')
    } catch {
      // Preamble is optional — if it can't be loaded, run code as-is.
    }

    const wrappedCode = `${preamble}

# --- Begin user code ---
${code}
# --- End user code ---
`

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

    const child = spawn('python3', ['-u', '-B', scriptPath], {
      cwd: sandboxDir,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONIOENCODING: 'utf-8',
        PYTHONHASHSEED: '0',
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
  async function spawnJava(code: string, sessionId: string, socket: any): Promise<ChildProcess | null> {
    // Extract the public class name from the code.
    // Java requires the file name to match the public class name.
    // We strip comments first so "public class name" in a comment doesn't match.
    let className = 'Snippet'
    const strippedCode = code
      .replace(/\/\/[^\n]*/g, '')       // strip // comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // strip /* */ comments
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

    // Locate the JDK (portable Temurin 21 installed at ~/.local/jdk/current).
    // Fall back to system javac if not found.
    const home = process.env.HOME || '/home/z'
    const jdkBin = join(home, '.local', 'jdk', 'current', 'bin')
    const javacPath = existsSync(join(jdkBin, 'javac')) ? join(jdkBin, 'javac') : 'javac'
    const javaPath = existsSync(join(jdkBin, 'java')) ? join(jdkBin, 'java') : 'java'

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
          // Suppress the "Picked up JAVA_TOOL_OPTIONS" banner noise
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
    compileResult.stderr = compileResult.stderr
      .split('\n')
      .filter((line) => !line.includes('Picked up JAVA_TOOL_OPTIONS') && !line.includes('Picked up _JAVA_OPTIONS'))
      .join('\n')
    compileResult.stdout = compileResult.stdout
      .split('\n')
      .filter((line) => !line.includes('Picked up JAVA_TOOL_OPTIONS') && !line.includes('Picked up _JAVA_OPTIONS'))
      .join('\n')

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


  socket.on('run', async (payload: RunPayload) => {
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

    if (!code.trim()) {
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

    const sessionId = randomUUID()
    // For Python we spawn directly. For Java we compile first, then spawn.
    let child: ChildProcess

    if (language === 'java') {
      child = await spawnJava(code, sessionId, socket)
    } else {
      child = await spawnPython(code, sessionId, socket)
    }

    if (!child) return // Error already emitted by spawn function

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
    }

    sessions.set(socket.id, session)
    setupSession(socket.id, session, socket)

    // Timeout watchdog
    session.timer = setTimeout(() => {
      if (session.killed) return
      session.killed = true
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

httpServer.listen(PORT, () => {
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
