#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

python3 -c 'import sys; assert sys.version_info >= (3, 12), "Python 3.12+ is required for repository tooling"'
python3 -m venv .venv
.venv/bin/python -m pip install --disable-pip-version-check -r requirements-dev.txt
.venv/bin/pre-commit install --install-hooks
