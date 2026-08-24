/**
 * Multi-file execution test for all 14 languages.
 *
 * Uses the exposed window.__projectStore to set up files directly,
 * avoiding the fragile UI interactions (rename inputs, menu navigation).
 *
 * For each language:
 *   1. Switch to the language's project.
 *   2. Set the main file's content + name.
 *   3. Create a helper file with the correct name and content.
 *   4. Set the main file as active + entry.
 *   5. Click Run.
 *   6. Capture console output and check for the expected result.
 */
const TESTS = {
  python: {
    label: 'Python', mainName: 'main.py', helperName: 'helper.py',
    main: `from helper import greet\nprint(greet('multi-file'))\n`,
    helper: `def greet(name):\n    return f'Hello from {name}!'\n`,
    expected: 'Hello from multi-file',
  },
  javascript: {
    label: 'JS', mainName: 'main.js', helperName: 'helper.js',
    main: `const { greet } = require('./helper');\nconsole.log(greet('multi-file'));\n`,
    helper: `function greet(name) {\n  return 'Hello from ' + name + '!';\n}\nmodule.exports = { greet };\n`,
    expected: 'Hello from multi-file',
  },
  typescript: {
    label: 'TS', mainName: 'main.ts', helperName: 'helper.ts',
    main: `import { greet } from './helper';\nconsole.log(greet('multi-file'));\n`,
    helper: `export function greet(name: string): string {\n  return 'Hello from ' + name + '!';\n}\n`,
    expected: 'Hello from multi-file',
  },
  java: {
    label: 'Java', mainName: 'Main.java', helperName: 'Helper.java',
    main: `public class Main {\n    public static void main(String[] args) {\n        System.out.println(Helper.greet("multi-file"));\n    }\n}\n`,
    helper: `public class Helper {\n    public static String greet(String name) {\n        return "Hello from " + name + "!";\n    }\n}\n`,
    expected: 'Hello from multi-file',
  },
  go: {
    label: 'Go', mainName: 'main.go', helperName: 'helper.go',
    main: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println(Greet("multi-file"))\n}\n`,
    helper: `package main\n\nfunc Greet(name string) string {\n    return "Hello from " + name + "!"\n}\n`,
    expected: 'Hello from multi-file',
  },
  rust: {
    label: 'Rust', mainName: 'main.rs', helperName: 'helper.rs',
    main: `mod helper;\n\nfn main() {\n    println!("{}", helper::greet("multi-file"));\n}\n`,
    helper: `pub fn greet(name: &str) -> String {\n    format!("Hello from {}!", name)\n}\n`,
    expected: 'Hello from multi-file',
  },
  swift: {
    label: 'Swift', mainName: 'main.swift', helperName: 'helper.swift',
    main: `print(greet(name: "multi-file"))\n`,
    helper: `func greet(name: String) -> String {\n    return "Hello from \\(name)!"\n}\n`,
    expected: 'Hello from multi-file',
  },
  ruby: {
    label: 'Ruby', mainName: 'main.rb', helperName: 'helper.rb',
    main: `require_relative './helper'\nputs greet('multi-file')\n`,
    helper: `def greet(name)\n  "Hello from #{name}!"\nend\n`,
    expected: 'Hello from multi-file',
  },
  lua: {
    label: 'Lua', mainName: 'main.lua', helperName: 'helper.lua',
    main: `local helper = require('helper')\nprint(helper.greet('multi-file'))\n`,
    helper: `local M = {}\nfunction M.greet(name)\n  return 'Hello from ' .. name .. '!'\nend\nreturn M\n`,
    expected: 'Hello from multi-file',
  },
  perl: {
    label: 'Perl', mainName: 'main.pl', helperName: 'helper.pl',
    main: `require './helper.pl';\nprint greet("multi-file"), "\\n";\n`,
    helper: `sub greet {\n  my ($name) = @_;\n  return "Hello from $name!";\n}\n1;\n`,
    expected: 'Hello from multi-file',
  },
  powershell: {
    label: 'PS', mainName: 'main.ps1', helperName: 'helper.ps1',
    main: `. ./helper.ps1\nWrite-Output (Greet "multi-file")\n`,
    helper: `function Greet {\n  param($name)\n  return "Hello from $name!"\n}\n`,
    expected: 'Hello from multi-file',
  },
  bash: {
    label: 'Bash', mainName: 'main.sh', helperName: 'helper.sh',
    main: `#!/bin/bash\nsource ./helper.sh\necho "$(greet 'multi-file')"\n`,
    helper: `greet() {\n  echo "Hello from $1!"\n}\n`,
    expected: 'Hello from multi-file',
  },
  fortran: {
    label: 'Fortran', mainName: 'main.f90', helperName: 'helper.f90',
    main: `program main\n    use helper\n    implicit none\n    print *, greet("multi-file")\nend program main\n`,
    helper: `module helper\n    implicit none\ncontains\n    function greet(name) result(out)\n        character(len=*), intent(in) :: name\n        character(len=100) :: out\n        out = "Hello from " // trim(name) // "!"\n    end function greet\nend module helper\n`,
    expected: 'Hello from multi-file',
  },
  cobol: {
    label: 'COBOL', mainName: 'main.cob', helperName: 'helper.cob',
    main: `       IDENTIFICATION DIVISION.\n       PROGRAM-ID. MAIN.\n       DATA DIVISION.\n       WORKING-STORAGE SECTION.\n       01  OUT PIC X(30).\n       PROCEDURE DIVISION.\n           CALL "HELPER" USING "multi-file" OUT.\n           DISPLAY OUT.\n           STOP RUN.\n`,
    helper: `       IDENTIFICATION DIVISION.\n       PROGRAM-ID. HELPER.\n       DATA DIVISION.\n       LINKAGE SECTION.\n       01  NAME PIC X(20).\n       01  OUT  PIC X(30).\n       PROCEDURE DIVISION USING NAME OUT.\n           STRING "Hello from " DELIMITED BY SIZE\n                  NAME DELIMITED BY SPACE\n                  "!" DELIMITED BY SIZE\n                  INTO OUT.\n           GOBACK.\n`,
    expected: 'Hello from multi-file',
  },
}

async function main() {
  let chromium
  try {
    ({ chromium } = require('playwright'))
  } catch {
    console.log('Playwright not installed — skipping.')
    process.exit(0)
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const baseUrl = 'http://localhost:81'
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Clear IDB and reload for a clean state.
  await page.evaluate(() => new Promise((resolve) => {
    const r = indexedDB.deleteDatabase('pyrunner')
    r.onsuccess = () => resolve('deleted')
    r.onerror = () => resolve('error')
  }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  const results = []
  let passed = 0
  let failed = 0

  for (const [langKey, test] of Object.entries(TESTS)) {
    const r = { lang: test.label, status: 'UNKNOWN', error: '', output: '' }
    try {
      // 1. Switch language (via store).
      await page.evaluate((lang) => {
        window.__projectStore.getState().setSelectedLanguage(lang)
      }, langKey)
      await page.waitForTimeout(500)

      // 2. Find the default entry file (created automatically) and rename it to mainName.
      //    Then set its content.
      await page.evaluate((t) => {
        const store = window.__projectStore.getState()
        const proj = store.projects[store.selectedLanguage]
        // Find the first file in this project.
        const firstFileId = proj.childrenByParent.root?.[0] ?? null
        if (!firstFileId) throw new Error('No default file found')
        // Rename it to the main name.
        store.renameNode(firstFileId, t.mainName)
        // Set its content.
        store.setActiveFile(firstFileId)
        store.setActiveFileContent(t.main)
        // Set it as the entry file.
        store.setEntryFile(firstFileId)
      }, test)
      await page.waitForTimeout(300)

      // 3. Create the helper file with the correct name + content.
      await page.evaluate((t) => {
        const store = window.__projectStore.getState()
        // Create a new file, then rename + set content.
        const newId = store.createFile({ name: t.helperName, content: t.helper, makeActive: false, makeEntry: false })
      }, test)
      await page.waitForTimeout(300)

      // 4. Make sure the main file is the active file (so Run uses it).
      await page.evaluate((t) => {
        const store = window.__projectStore.getState()
        const proj = store.projects[store.selectedLanguage]
        // Find the file whose name matches t.mainName.
        const mainFile = Object.values(proj.nodes).find(
          (n) => n.type === 'file' && n.name === t.mainName,
        )
        if (mainFile) {
          store.setActiveFile(mainFile.id)
          store.setEntryFile(mainFile.id)
        }
      }, test)
      await page.waitForTimeout(500)

      // 5. Click Run.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.includes('Run'),
        )
        if (btn) btn.click()
      })
      // Wait for execution (compile + run).
      await page.waitForTimeout(8000)

      // 6. Capture all text output.
      const output = await page.evaluate(() => document.body.innerText)
      r.output = output

      // 7. Check for expected output.
      if (output.includes(test.expected)) {
        r.status = 'PASS'
        passed++
      } else {
        r.status = 'FAIL'
        r.error = `expected "${test.expected}" not found`
        failed++
      }
    } catch (err) {
      r.status = 'FAIL'
      r.error = err.message
      failed++
    }
    results.push(r)
    const tag = r.status === 'PASS' ? '\x1b[32m' : '\x1b[31m'
    console.log(`${tag}[${r.status}]\x1b[0m ${r.lang.padEnd(8)} ${r.error ? '— ' + r.error : ''}`)
  }

  console.log('\n=== Summary ===')
  console.log(`Passed: ${passed}/${Object.keys(TESTS).length}`)
  console.log(`Failed: ${failed}/${Object.keys(TESTS).length}`)

  // Print failure details.
  if (failed > 0) {
    console.log('\n=== Failure details ===')
    for (const r of results) {
      if (r.status === 'FAIL') {
        console.log(`\n--- ${r.lang} ---`)
        // Print first 800 chars of output for debugging.
        const trimmed = r.output.slice(0, 800)
        console.log(trimmed)
      }
    }
  }

  await browser.close()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Test suite crashed:', err)
  process.exit(1)
})
