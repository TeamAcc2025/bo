#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

bash -n scripts/setup.sh
bash -n scripts/check.sh
npm test
exec .venv/bin/pre-commit run --all-files --show-diff-on-failure
