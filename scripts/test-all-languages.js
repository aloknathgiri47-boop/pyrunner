// Comprehensive language runner test
// Tests each language by setting code via the store and running it
const TESTS = {
  python: {
    label: 'Python', code: 'print("Hello from Python")\nimport sys\nprint(sys.version.split()[0])',
    expected: 'Hello from Python',
  },
  javascript: {
    label: 'JS', code: 'console.log("Hello from JavaScript");\nconsole.log("Node:", process.version);',
    expected: 'Hello from JavaScript',
  },
  typescript: {
    label: 'TS', code: 'const x: number = 42;\nconsole.log("Hello from TypeScript:", x);',
    expected: 'Hello from TypeScript',
  },
  java: {
    label: 'Java', code: 'public class Hello {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java");\n    }\n}',
    expected: 'Hello from Java',
  },
  go: {
    label: 'Go', code: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from Go")\n}',
    expected: 'Hello from Go',
  },
  rust: {
    label: 'Rust', code: 'fn main() {\n    println!("Hello from Rust");\n}',
    expected: 'Hello from Rust',
  },
  swift: {
    label: 'Swift', code: 'print("Hello from Swift")',
    expected: 'Hello from Swift',
  },
  ruby: {
    label: 'Ruby', code: 'puts "Hello from Ruby"\nputs RUBY_VERSION',
    expected: 'Hello from Ruby',
  },
  lua: {
    label: 'Lua', code: 'print("Hello from Lua")\nprint(_VERSION)',
    expected: 'Hello from Lua',
  },
  perl: {
    label: 'Perl', code: 'print "Hello from Perl\\n";\nprint "$]\\n";',
    expected: 'Hello from Perl',
  },
  powershell: {
    label: 'PS', code: 'Write-Output "Hello from PowerShell"\n$PSVersionTable.PSVersion',
    expected: 'Hello from PowerShell',
  },
  bash: {
    label: 'Bash', code: '#!/bin/bash\necho "Hello from Bash"\necho "Version: $BASH_VERSION"',
    expected: 'Hello from Bash',
  },
  fortran: {
    label: 'Fortran', code: 'program main\n    print *, "Hello from Fortran"\nend program main',
    expected: 'Hello from Fortran',
  },
  cobol: {
    label: 'COBOL', code: '       IDENTIFICATION DIVISION.\n       PROGRAM-ID. HELLO.\n       PROCEDURE DIVISION.\n           DISPLAY "Hello from COBOL".\n           STOP RUN.',
    expected: 'Hello from COBOL',
  },
}

async function main() {
  const { chromium } = require('playwright')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()

  await page.goto('http://localhost:81/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Clear IDB
  await page.evaluate(() => new Promise((resolve) => {
    const r = indexedDB.deleteDatabase('pyrunner')
    r.onsuccess = () => resolve('deleted')
    r.onerror = () => resolve('error')
  }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  const results = []

  for (const [langKey, test] of Object.entries(TESTS)) {
    const r = { lang: test.label, status: 'UNKNOWN', error: '', output: '' }
    try {
      // Switch language + set code via store
      await page.evaluate((t) => {
        const store = window.__projectStore.getState()
        store.setSelectedLanguage(t.lang)
        store.resetToDefault()
        const s2 = window.__projectStore.getState()
        const proj = s2.projects[t.lang]
        const mainId = proj.childrenByParent.root[0]
        s2.setActiveFile(mainId)
        s2.setActiveFileContent(t.code)
        s2.setEntryFile(mainId)
      }, { lang: langKey, code: test.code })

      await page.waitForTimeout(500)

      // Click Run
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run'))
        if (btn) btn.click()
      })

      // Wait for execution
      await page.waitForTimeout(8000)

      // Capture output
      const text = await page.evaluate(() => document.body.innerText)
      r.output = text

      if (text.includes(test.expected)) {
        r.status = 'PASS'
      } else {
        r.status = 'FAIL'
        // Extract the error from the console
        if (text.includes('CONSOLE')) {
          const idx = text.indexOf('CONSOLE')
          const consoleText = text.slice(idx, idx + 400)
          r.error = consoleText.replace(/\n/g, ' | ').slice(0, 200)
        } else {
          r.error = 'expected output not found'
        }
      }
    } catch (err) {
      r.status = 'FAIL'
      r.error = err.message
    }
    results.push(r)
    const tag = r.status === 'PASS' ? '\x1b[32m' : '\x1b[31m'
    console.log(`${tag}[${r.status}]\x1b[0m ${r.lang.padEnd(10)} ${r.error ? '— ' + r.error.slice(0, 150) : ''}`)
  }

  console.log('\n=== Summary ===')
  const passed = results.filter(r => r.status === 'PASS').length
  console.log(`Passed: ${passed}/${results.length}`)
  console.log(`Failed: ${results.length - passed}/${results.length}`)

  await browser.close()
  process.exit(results.filter(r => r.status === 'FAIL').length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Crashed:', err)
  process.exit(1)
})
