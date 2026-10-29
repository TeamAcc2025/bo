# Codex Cloud

This repository is intended for work through Codex Cloud. Cloud environment
settings live in the account UI; repository files alone do not create or publish
an environment.

## Environment setup

1. In Codex, choose **Work in > Cloud > Select environment > Create environment**
   (or **Settings > Codex Cloud > Environments**).
2. Select only `TeamAcc2025/bo` and choose **Get started**.
3. Configure the install script to run `bash scripts/setup.sh` from the repository
   root. Verify `bash scripts/check.sh` after installation. Python 3.12+ and Git
   are the current tooling requirements; no application dependencies exist yet.
4. Keep environment access **Only me**. Keep production credentials, private
   services, VPN, and OIDC connections out of this environment.
5. Allow package-manager domains and `github.com` for installing the pinned
   repository hooks. Leave unrestricted public internet access disabled.
6. Review setup and test results, save, and choose **Publish**. Confirm
   **Environment published** before starting work.

Use `AGENTS.md` for project instructions. Personal skills from a local machine
are not automatically available in the cloud environment. When setup changes,
update the environment, **Republish**, and verify a new task.

For the legacy environment editor, use `bash scripts/setup.sh` as the setup and
maintenance command, and keep agent-phase internet access disabled unless a task
requires specific destinations. Setup scripts have network access for installs.

## Development workflow

Start from `main`, describe one concrete outcome and its acceptance criteria,
then review Codex's diff and test results. Open a PR and wait for `Repository
checks`. Merge by squash when the owner requests it. The checks currently cover
repository hygiene, not application behavior.

Keep business details in private task context. Public repository branches, issues,
PRs, and Actions logs are readable by everyone. GitHub's secret scanning and push
protection cover supported secret patterns; the local checks also detect private
keys and block common credential/data filenames. These checks do not classify
arbitrary sensitive business content.

Sources: [Codex Cloud](https://learn.chatgpt.com/docs/cloud),
[Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments),
[Legacy environments](https://learn.chatgpt.com/docs/environments/cloud-environment).
