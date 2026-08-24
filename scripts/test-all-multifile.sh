#!/bin/bash
# Comprehensive multi-file execution test for all 14 languages.
# Resets each language's project before testing to avoid leftover files.

# test_lang <lang_key> <mainName> <helperName> <mainCode> <helperCode> <expected>
test_lang() {
  local lang="$1" mainName="$2" helperName="$3" mainCode="$4" helperCode="$5" expected="$6"

  # Reset the language's project to default, then setup files
  agent-browser eval "
(() => {
  const store = window.__projectStore.getState();
  store.setSelectedLanguage('$lang');
  store.resetToDefault();
  const proj = store.projects['$lang'];
  const firstFileId = proj.childrenByParent.root[0];
  store.renameNode(firstFileId, '$mainName');
  store.setActiveFile(firstFileId);
  store.setActiveFileContent($(node -e "console.log(JSON.stringify(process.argv[1]))" "$mainCode"));
  store.setEntryFile(firstFileId);
  store.createFile({ name: '$helperName', content: $(node -e "console.log(JSON.stringify(process.argv[1]))" "$helperCode"), makeActive: false, makeEntry: false });
  store.setActiveFile(firstFileId);
  store.setEntryFile(firstFileId);
  return 'ok';
})()
" > /dev/null 2>&1

  # Click Run
  agent-browser eval "
(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run'));
  if (btn) { btn.click(); return 'clicked'; }
  return 'no';
})()
" > /dev/null 2>&1

  # Wait for execution (compile + run)
  sleep 8

  # Get console output
  local output=$(agent-browser eval "document.body.innerText" 2>/dev/null | tail -1)

  if echo "$output" | grep -q "$expected"; then
    echo "PASS"
  else
    echo "FAIL"
    # Print the relevant error
    echo "$output" | python3 -c "
import sys, json
try:
    text = json.loads(sys.stdin.read())
    if 'CONSOLE' in text:
        idx = text.index('CONSOLE')
        print('  Console: ' + text[idx:idx+300].replace(chr(10), ' | '))
except: pass
" 2>/dev/null
  fi
}

echo "=== Multi-file Execution Test Suite ==="
echo ""

echo -n "[    ] Python:     "
test_lang "python" "main.py" "helper.py" \
  "from helper import greet
print(greet('multi-file'))
" \
  "def greet(name):
    return f'Hello from {name}!'
" \
  "Hello from multi-file"

echo -n "[    ] JavaScript: "
test_lang "javascript" "main.js" "helper.js" \
  "const { greet } = require('./helper');
console.log(greet('multi-file'));
" \
  "function greet(name) {
  return 'Hello from ' + name + '!';
}
module.exports = { greet };
" \
  "Hello from multi-file"

echo -n "[    ] TypeScript: "
test_lang "typescript" "main.ts" "helper.ts" \
  "import { greet } from './helper';
console.log(greet('multi-file'));
" \
  "export function greet(name: string): string {
  return 'Hello from ' + name + '!';
}
" \
  "Hello from multi-file"

echo -n "[    ] Java:       "
test_lang "java" "Main.java" "Helper.java" \
  'public class Main {
    public static void main(String[] args) {
        System.out.println(Helper.greet("multi-file"));
    }
}
' \
  'public class Helper {
    public static String greet(String name) {
        return "Hello from " + name + "!";
    }
}
' \
  "Hello from multi-file"

echo -n "[    ] Go:         "
test_lang "go" "main.go" "helper.go" \
  'package main

import "fmt"

func main() {
    fmt.Println(Greet("multi-file"))
}
' \
  'package main

func Greet(name string) string {
    return "Hello from " + name + "!"
}
' \
  "Hello from multi-file"

echo -n "[    ] Rust:       "
test_lang "rust" "main.rs" "helper.rs" \
  'mod helper;

fn main() {
    println!("{}", helper::greet("multi-file"));
}
' \
  'pub fn greet(name: &str) -> String {
    format!("Hello from {}!", name)
}
' \
  "Hello from multi-file"

echo -n "[    ] Swift:      "
test_lang "swift" "main.swift" "helper.swift" \
  'print(greet(name: "multi-file"))
' \
  'func greet(name: String) -> String {
    return "Hello from " + name + "!"
}
' \
  "Hello from multi-file"

echo -n "[    ] Ruby:       "
test_lang "ruby" "main.rb" "helper.rb" \
  'require_relative "./helper"
puts greet("multi-file")
' \
  'def greet(name)
  "Hello from " + name + "!"
end
' \
  "Hello from multi-file"

echo -n "[    ] Lua:        "
test_lang "lua" "main.lua" "helper.lua" \
  "local helper = require('helper')
print(helper.greet('multi-file'))
" \
  "local M = {}
function M.greet(name)
  return 'Hello from ' .. name .. '!'
end
return M
" \
  "Hello from multi-file"

echo -n "[    ] Perl:       "
test_lang "perl" "main.pl" "helper.pl" \
  'require "./helper.pl";
print greet("multi-file"), "\n";
' \
  'sub greet {
  my ($name) = @_;
  return "Hello from $name!";
}
1;
' \
  "Hello from multi-file"

echo -n "[    ] PowerShell: "
test_lang "powershell" "main.ps1" "helper.ps1" \
  '. ./helper.ps1
Write-Output (Greet "multi-file")
' \
  'function Greet {
  param($name)
  return "Hello from $name!"
}
' \
  "Hello from multi-file"

echo -n "[    ] Bash:       "
test_lang "bash" "main.sh" "helper.sh" \
  '#!/bin/bash
source ./helper.sh
echo "$(greet "multi-file")"
' \
  'greet() {
  echo "Hello from $1!"
}
' \
  "Hello from multi-file"

echo -n "[    ] Fortran:    "
test_lang "fortran" "main.f90" "helper.f90" \
  'program main
    use helper
    implicit none
    print *, greet("multi-file")
end program main
' \
  'module helper
    implicit none
contains
    function greet(name) result(out)
        character(len=*), intent(in) :: name
        character(len=100) :: out
        out = "Hello from " // trim(name) // "!"
    end function greet
end module helper
' \
  "Hello from multi-file"

echo -n "[    ] COBOL:      "
test_lang "cobol" "main.cob" "helper.cob" \
  '       IDENTIFICATION DIVISION.
       PROGRAM-ID. MAIN.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  OUT PIC X(30).
       PROCEDURE DIVISION.
           CALL "HELPER" USING "multi-file" OUT.
           DISPLAY OUT.
           STOP RUN.
' \
  '       IDENTIFICATION DIVISION.
       PROGRAM-ID. HELPER.
       DATA DIVISION.
       LINKAGE SECTION.
       01  NAME PIC X(20).
       01  OUT  PIC X(30).
       PROCEDURE DIVISION USING NAME OUT.
           STRING "Hello from " DELIMITED BY SIZE
                  NAME DELIMITED BY SPACE
                  "!" DELIMITED BY SIZE
                  INTO OUT.
           GOBACK.
' \
  "Hello from multi-file"

echo ""
echo "=== Done ==="
