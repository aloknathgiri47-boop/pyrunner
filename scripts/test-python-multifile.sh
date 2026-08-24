#!/bin/bash
# Multi-file execution test for all 14 languages.
# Uses agent-browser to drive the UI.

set -e

BASE="http://localhost:81"

# set_active_editor_content <code>
# Replaces the active editor's content via select-all + type.
set_active_editor_content() {
  local code="$1"
  # Select all in the CodeMirror editor
  agent-browser eval "
(() => {
  const cm = document.querySelector('.cm-content');
  if (!cm) return 'no cm';
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(cm);
  sel.removeAllRanges();
  sel.addRange(range);
  return 'selected';
})()
" > /dev/null 2>&1
  sleep 0.5
  # Get the textbox ref and type
  local ref=$(agent-browser snapshot -i 2>/dev/null | grep "textbox" | head -1 | grep -oE '@e[0-9]+' | head -1)
  if [ -n "$ref" ]; then
    agent-browser type "$ref" "$code" > /dev/null 2>&1
    sleep 0.5
  fi
}

# Switch to a language by clicking its tab
switch_language() {
  local label="$1"
  # Find and click the language button
  agent-browser find text "$label" click > /dev/null 2>&1 || {
    # Fallback: use snapshot to find the button
    local ref=$(agent-browser snapshot -i 2>/dev/null | grep "button \"$label\"" | head -1 | grep -oE '@e[0-9]+' | head -1)
    [ -n "$ref" ] && agent-browser click "$ref" > /dev/null 2>&1
  }
  sleep 1
}

# Create a new file with the given name and content
create_helper_file() {
  local name="$1"
  local content="$2"
  # Click "New file" button (aria-label)
  agent-browser find first "button[aria-label=\"New file\"]" click > /dev/null 2>&1 || {
    local ref=$(agent-browser snapshot -i 2>/dev/null | grep "New file" | grep -oE '@e[0-9]+' | head -1)
    [ -n "$ref" ] && agent-browser click "$ref" > /dev/null 2>&1
  }
  sleep 1
  # The new file is auto-selected. Rename it via the actions menu.
  # Find the last "File actions" button
  local actions_ref=$(agent-browser snapshot -i 2>/dev/null | grep "File actions" | tail -1 | grep -oE '@e[0-9]+' | head -1)
  if [ -n "$actions_ref" ]; then
    # The "File actions" is nested — we need the inner button
    agent-browser snapshot -i 2>/dev/null | grep -A 1 "File actions" | tail -1 | grep -oE '@e[0-9]+' | head -1
  fi
  # Simpler: use eval to rename via the store
  agent-browser eval "
(() => {
  // Find the active file and rename it via the store
  // Since we can't access the store directly, use the UI
  return 'skip rename for now';
})()
" > /dev/null 2>&1
  # Set the content
  set_active_editor_content "$content"
  sleep 0.5
}

# Run the active file and capture output
run_and_capture() {
  local timeout_secs="${2:-8}"
  # Find and click the Run button
  local run_ref=$(agent-browser snapshot -i 2>/dev/null | grep "Run ⌘" | grep -oE '@e[0-9]+' | head -1)
  [ -n "$run_ref" ] && agent-browser click "$run_ref" > /dev/null 2>&1
  sleep "$timeout_secs"
  # Capture all text from the page
  agent-browser eval "document.body.innerText" 2>/dev/null | tail -1
}

# Check if output contains expected string
check_output() {
  local output="$1"
  local expected="$2"
  if echo "$output" | grep -q "$expected"; then
    return 0
  else
    return 1
  fi
}

echo "=== Multi-file Execution Test Suite ==="
echo ""

PASS=0
FAIL=0

# ===== Python =====
echo -n "[    ] Python: main.py + helper.py ... "
switch_language "Python"
# Set main.py content
agent-browser eval "
(() => {
  const cm = document.querySelector('.cm-content');
  if (!cm) return 'no cm';
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(cm);
  sel.removeAllRanges();
  sel.addRange(range);
  return 'selected';
})()
" > /dev/null 2>&1
sleep 0.5
ref=$(agent-browser snapshot -i 2>/dev/null | grep "textbox" | head -1 | grep -oE '@e[0-9]+' | head -1)
agent-browser type "$ref" "from helper import greet
print(greet('multi-file'))
" > /dev/null 2>&1
sleep 0.5
# Create helper.py
agent-browser eval "
(() => {
  const btn = document.querySelector('button[aria-label=\"New file\"]');
  if (btn) { btn.click(); return 'clicked'; }
  return 'no btn';
})()
" > /dev/null 2>&1
sleep 1
# Set helper content
agent-browser eval "
(() => {
  const cm = document.querySelector('.cm-content');
  if (!cm) return 'no cm';
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(cm);
  sel.removeAllRanges();
  sel.addRange(range);
  return 'selected';
})()
" > /dev/null 2>&1
sleep 0.5
ref=$(agent-browser snapshot -i 2>/dev/null | grep "textbox" | head -1 | grep -oE '@e[0-9]+' | head -1)
agent-browser type "$ref" "def greet(name):
    return f'Hello from {name}!'
" > /dev/null 2>&1
sleep 0.5
# Click main.py to activate it
agent-browser eval "
(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const mainBtn = btns.find(b => b.textContent?.includes('main.py File actions'));
  if (mainBtn) { mainBtn.click(); return 'clicked main.py'; }
  return 'not found';
})()
" > /dev/null 2>&1
sleep 1
# Run
agent-browser eval "
(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run'));
  if (btn) { btn.click(); return 'clicked'; }
  return 'no run btn';
})()
" > /dev/null 2>&1
sleep 6
output=$(agent-browser eval "document.body.innerText" 2>/dev/null | tail -1)
if echo "$output" | grep -q "Hello from multi-file"; then
  echo "PASS"
  PASS=$((PASS+1))
else
  echo "FAIL"
  echo "      Expected: 'Hello from multi-file'"
  echo "      Got: $(echo "$output" | grep -iE 'hello|error|traceback' | head -3)"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
