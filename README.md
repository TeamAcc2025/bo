# BO

Development foundation for BO. Application scope and technology stack are still to be decided.

## Development

Python 3.12+, Node.js 22+, and Git are needed for repository tooling; this does not select the application's stack.

```sh
bash scripts/setup.sh
bash scripts/check.sh
```

Changes go through pull requests to `main`. The required `Repository checks` job
validates repository hygiene; add application tests when application code exists.

See [Triage labels](docs/agents/triage-labels.md) for issue triage.

See [AGENTS.md](AGENTS.md) for contributor instructions and
[Codex Cloud setup](docs/codex-cloud.md) for the cloud environment.

[Sandcastle](docs/sandcastle.md) runs parallel task branches through implementation,
checks, independent review, repair rounds, draft PRs, and required GitHub CI.
