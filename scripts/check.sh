#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

bash -n scripts/setup.sh
bash -n scripts/check.sh
.venv/bin/python scripts/matt_skills.py audit
.venv/bin/python -m unittest discover -s scripts -p 'test_*.py'
npm test
exec .venv/bin/pre-commit run --all-files --show-diff-on-failure
