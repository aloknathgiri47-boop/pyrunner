import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface RunRequest {
  code: string
  stdin?: string
  timeout?: number
}

interface RunResponse {
  stdout: string
  stderr: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  durationMs: number
  error?: string
}

const MAX_OUTPUT_BYTES = 1_000_000 // 1 MB cap per stream
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_TIMEOUT_MS = 30_000

function truncateOutput(buf: Buffer): string {
  if (buf.length <= MAX_OUTPUT_BYTES) return buf.toString('utf8')
  const head = buf.subarray(0, MAX_OUTPUT_BYTES).toString('utf8')
  return head + `\n\n... [output truncated: ${buf.length - MAX_OUTPUT_BYTES} more bytes]`
}

export async function POST(req: NextRequest): Promise<NextResponse<RunResponse>> {
  let body: RunRequest
  try {
    body = (await req.json()) as RunRequest
  } catch {
    return NextResponse.json(
      {
        stdout: '',
        stderr: 'Invalid JSON body.',
        exitCode: null,
        signal: null,
        timedOut: false,
        durationMs: 0,
        error: 'INVALID_JSON',
      },
      { status: 400 },
    )
  }

  const code = typeof body.code === 'string' ? body.code : ''
  const stdin = typeof body.stdin === 'string' ? body.stdin : ''
  const requestedTimeout = Number(body.timeout) || DEFAULT_TIMEOUT_MS
  const timeoutMs = Math.min(Math.max(requestedTimeout, 1000), MAX_TIMEOUT_MS)

  if (!code.trim()) {
    return NextResponse.json({
      stdout: '',
      stderr: 'No code provided.',
      exitCode: 0,
      signal: null,
      timedOut: false,
      durationMs: 0,
    })
  }

  // Write the user's code to a temp .py file so tracebacks show real filenames.
  const sessionId = randomUUID()
  const sandboxDir = join(tmpdir(), 'py-compiler')
  if (!existsSync(sandboxDir)) {
    try {
      await mkdir(sandboxDir, { recursive: true })
    } catch {
      // ignore — spawn will fail and we'll report the error
    }
  }
  const scriptPath = join(sandboxDir, `snippet_${sessionId}.py`)

  try {
    await writeFile(scriptPath, code, { encoding: 'utf8', mode: 0o600 })
  } catch (e) {
    return NextResponse.json({
      stdout: '',
      stderr: `Failed to write script file: ${(e as Error).message}`,
      exitCode: null,
      signal: null,
      timedOut: false,
      durationMs: 0,
      error: 'WRITE_FAILED',
    })
  }

  const startedAt = Date.now()
  // Force unbuffered output so we don't lose partial prints on timeout/kill.
  const child = spawn('python3', ['-u', '-B', scriptPath], {
    cwd: sandboxDir,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONIOENCODING: 'utf-8',
      PYTHONHASHSEED: '0',
      // Strip credentials/sandbox-internal env vars from the user's view.
      DATABASE_URL: undefined,
      NEXTAUTH_SECRET: undefined,
      NEXTAUTH_URL: undefined,
    } as NodeJS.ProcessEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []
  let totalStdoutBytes = 0
  let totalStderrBytes = 0
  let timedOut = false

  return new Promise<NextResponse<RunResponse>>((resolve) => {
    const cleanup = () => {
      try {
        child.stdin?.destroy()
      } catch {
        /* noop */
      }
    }

    const timer = setTimeout(() => {
      timedOut = true
      try {
        child.kill('SIGKILL')
      } catch {
        /* noop */
      }
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      totalStdoutBytes += chunk.length
      if (totalStdoutBytes <= MAX_OUTPUT_BYTES * 2) {
        stdoutChunks.push(chunk)
      }
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      totalStderrBytes += chunk.length
      if (totalStderrBytes <= MAX_OUTPUT_BYTES * 2) {
        stderrChunks.push(chunk)
      }
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      cleanup()
      resolve(
        NextResponse.json({
          stdout: '',
          stderr: `Failed to spawn python3: ${err.message}`,
          exitCode: null,
          signal: null,
          timedOut: false,
          durationMs: Date.now() - startedAt,
          error: 'SPAWN_FAILED',
        }),
      )
    })

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      cleanup()
      const stdoutBuf = Buffer.concat(stdoutChunks)
      const stderrBuf = Buffer.concat(stderrChunks)

      let stderr = truncateOutput(stderrBuf)
      if (timedOut) {
        stderr += `\n\n[Execution timed out after ${timeoutMs}ms and was killed.]`
      }

      resolve(
        NextResponse.json({
          stdout: truncateOutput(stdoutBuf),
          stderr,
          exitCode: code,
          signal: signal as NodeJS.Signals | null,
          timedOut,
          durationMs: Date.now() - startedAt,
        }),
      )
    })

    // Feed stdin then close.
    if (stdin.length > 0) {
      try {
        child.stdin?.write(stdin)
      } catch {
        /* noop */
      }
    }
    try {
      child.stdin?.end()
    } catch {
      /* noop */
    }
  })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: 'Python Compiler API',
    version: '1.0.0',
    python: 'python3',
    endpoints: {
      run: 'POST /api/run  { code: string, stdin?: string, timeout?: number }',
    },
    limits: {
      maxOutputBytes: MAX_OUTPUT_BYTES,
      maxTimeoutMs: MAX_TIMEOUT_MS,
      defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    },
  })
}
