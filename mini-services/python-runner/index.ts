import { createServer } from 'http'
import { Server } from 'socket.io'
import { spawn, type ChildProcess } from 'child_process'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const PORT = 3003
const MAX_OUTPUT_BYTES = 1_000_000 // 1 MB per stream
const MAX_TIMEOUT_MS = 30_000
const DEFAULT_TIMEOUT_MS = 15_000

interface RunPayload {
  code: string
  timeout?: number
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
    const text = chunk.toString('utf8')

    // Heuristic: detect if this chunk ends mid-line (likely an input prompt).
    // We tell the client "this looks like a prompt" by checking that the chunk
    // doesn't end with a newline AND the process is still running. The client
    // uses this hint to focus its input field.
    const looksLikePrompt = !text.endsWith('\n') && !text.endsWith('\r\n')

    socket.emit('output', {
      stream: 'stdout',
      data: text,
      promptLike: looksLikePrompt,
    })
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    session.totalStderr += chunk.length
    if (session.totalStderr > MAX_OUTPUT_BYTES * 2) return
    socket.emit('output', {
      stream: 'stderr',
      data: chunk.toString('utf8'),
      promptLike: false,
    })
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
    socket.emit('exit', {
      code,
      signal: signal as NodeJS.Signals | null,
      timedOut: session.killed && session.timer === null && code === null ? false : false,
      durationMs: Date.now() - session.startedAt,
    })
    sessions.delete(socketId)
  })
}

io.on('connection', (socket) => {
  console.log(`[python-runner] client connected: ${socket.id}`)

  socket.on('run', async (payload: RunPayload) => {
    // If a previous session is still alive on this socket, kill it first.
    const prev = sessions.get(socket.id)
    if (prev) {
      killSession(prev, 'client_disconnect')
      sessions.delete(socket.id)
    }

    const code = typeof payload?.code === 'string' ? payload.code : ''
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
    const scriptPath = join(sandboxDir, `snippet_${sessionId}.py`)

    try {
      await writeFile(scriptPath, code, { encoding: 'utf8', mode: 0o600 })
    } catch (e) {
      socket.emit('output', {
        stream: 'stderr',
        data: `Failed to write script file: ${(e as Error).message}\n`,
        promptLike: false,
      })
      socket.emit('exit', {
        code: null,
        signal: null,
        timedOut: false,
        durationMs: 0,
        error: 'WRITE_FAILED',
      })
      return
    }

    const child = spawn('python3', ['-u', '-B', scriptPath], {
      cwd: sandboxDir,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONIOENCODING: 'utf-8',
        PYTHONHASHSEED: '0',
        // Strip sandbox-internal env vars
        DATABASE_URL: undefined,
        NEXTAUTH_SECRET: undefined,
        NEXTAUTH_URL: undefined,
      } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    const session: Session = {
      child,
      startedAt: Date.now(),
      timeoutMs,
      timer: null,
      killed: false,
      totalStdout: 0,
      totalStderr: 0,
      pendingPromptText: '',
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

    socket.emit('started', { timeoutMs, scriptPath })
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
