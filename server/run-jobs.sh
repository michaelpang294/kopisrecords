#!/bin/bash
set -eo pipefail
TASK_ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
TASK_ACTIVATE="$(dirname -- "$TASK_ROOT")/nodevenv/$(basename -- "$TASK_ROOT")/22/bin/activate"
if [[ ! -f "$TASK_ACTIVATE" ]]; then
  echo "Node.js 22 environment not found. Check the activation command in cPanel Setup Node.js App and update TASK_ACTIVATE in run-jobs.sh."
  exit 1
fi
source "$TASK_ACTIVATE"
cd "$TASK_ROOT"
exec node worker.mjs
