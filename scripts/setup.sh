#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

if [[ $# -gt 1 || ( $# -eq 1 && $1 != --worktree ) ]]; then
  echo 'Usage: bash scripts/setup.sh [--worktree]' >&2
  exit 2
fi

if [[ $(uname -s) == Linux ]]; then
  timeout_version=$(timeout --version)
  if [[ $timeout_version != *'(GNU coreutils)'* ]]; then
    echo 'GNU coreutils timeout is required for worker process-group cleanup' >&2
    exit 1
  fi
fi

python3 -c 'import sys; assert sys.version_info >= (3, 12), "Python 3.12+ is required for repository tooling"'
python3 -m venv .venv
.venv/bin/python -m pip install --disable-pip-version-check -r requirements-dev.txt
if [[ ${1:-} != --worktree ]]; then
  .venv/bin/pre-commit install --install-hooks
fi
node -e 'require("node:assert/strict")(Number(process.versions.node.split(".")[0]) >= 22, "Node.js 22+ is required for repository tooling")'
npm ci --include=dev
