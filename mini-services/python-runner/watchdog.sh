#!/bin/bash
# Watchdog for the python-runner mini-service.
# Starts the runner and restarts it if it crashes or exits.
# Uses a polling loop (more robust than `wait` which can be killed
# along with the child).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER_SCRIPT="$SCRIPT_DIR/index.ts"
LOG_FILE="$SCRIPT_DIR/runner.log"
PID_FILE="$SCRIPT_DIR/runner.pid"
MAX_RESTARTS=100
RESTART_DELAY=2
HEARTBEAT_INTERVAL=3

cleanup() {
  echo "[watchdog] shutting down..."
  if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null
    rm -f "$PID_FILE"
  fi
  exit 0
}

trap cleanup SIGTERM SIGINT

is_alive() {
  local pid="$1"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

echo "[watchdog] starting python-runner watchdog (PID $$)..."

restarts=0

while [ $restarts -lt $MAX_RESTARTS ]; do
  echo "[watchdog] starting runner (attempt $((restarts + 1))/$MAX_RESTARTS)..."
  
  # Start the runner in the background
  bun "$RUNNER_SCRIPT" >> "$LOG_FILE" 2>&1 &
  RUNNER_PID=$!
  echo "$RUNNER_PID" > "$PID_FILE"
  echo "[watchdog] runner started with PID $RUNNER_PID"
  
  # Wait a moment for it to bind to the port
  sleep 2
  
  # Poll until the runner dies
  while is_alive "$RUNNER_PID"; do
    sleep $HEARTBEAT_INTERVAL
  done
  
  echo "[watchdog] runner (PID $RUNNER_PID) has exited"
  rm -f "$PID_FILE"
  
  restarts=$((restarts + 1))
  echo "[watchdog] waiting ${RESTART_DELAY}s before restart..."
  sleep $RESTART_DELAY
done

echo "[watchdog] exhausted restart attempts ($MAX_RESTARTS). Giving up."
