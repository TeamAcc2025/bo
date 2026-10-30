# Codex Cloud

This repository is intended for work through Codex Cloud. Cloud environment
settings live in the account UI; repository files alone do not create or publish
an environment.

## Environment setup

1. In Codex, choose **Work in > Cloud > Select environment > Create environment**
   (or **Settings > Codex Cloud > Environments**).
2. Select only `TeamAcc2025/bo` and choose **Get started**.
3. Configure the install script to run `bash scripts/setup.sh` from the repository
   root. Verify `bash scripts/check.sh` after installation. Python 3.12+, Node.js
   22+, and Git are the tooling requirements; no application dependencies exist yet.
4. Keep environment access **Only me**. Keep business production credentials,
   private business services, VPN, and OIDC connections out of this environment.
   Provision the owner's subscription runtime separately as described below.
5. Package-manager domains and `github.com` are enough to install repository
   tools. Keep the owner's selected network policy; model calls also need access
   to their service endpoints. Verify the enforced runtime policy after saving.
6. Review setup and test results, save, and choose **Publish**. Confirm
   **Environment published** before starting work.

Use `AGENTS.md` for project instructions. Personal skills from a local machine
are not automatically available in the cloud environment. When setup changes,
update the environment, **Republish**, and verify a new task.

For the legacy environment editor, use `bash scripts/setup.sh` as the setup and
maintenance command, and keep agent-phase internet access disabled unless a task
requires specific destinations. Setup scripts have network access for installs.

## Owner subscription runtime

The owner selected a private ChatGPT subscription runtime for native Sandcastle
workers. It uses two independent saved session slots, each reserved exclusively
for one native process at a time. Do not share a session cache between concurrent
processes or VMs, or duplicate one saved session to fill both slots. Keep native
execution within those two slots.

Private provisioning supplies the runtime, saved sessions, storage bindings, and
`sandcastle.env` selector outside the checkout. Source that selector in the same
shell before the command that needs it; sourcing it in a previous tool call or
another shell does not configure the command. The path here is a placeholder:

```sh
source /private/path/sandcastle.env && \
SANDCASTLE_MODEL=gpt-6.1-sol npm run sandcastle -- --plan /private/path/tasks.json
```

Keep the parent `CODEX_HOME` at its standard platform location and preserve its
config and authentication. Selection applies to the private child runtime;
replacing the parent's home or copying local-machine auth into it is not setup.
Preserve injected proxy settings, CA trust, authentication headers, guards, Git
hooks, and required checks.

Let native Codex refresh its saved cache. Retain the updated cache for each slot
in private persistent storage and write it back before releasing that slot or
discarding a VM. Subsequent runs must load the latest saved cache, rather than
overwrite it with an old seed. Treat failed writeback as a visible failure.
Future tasks reuse this runtime and the saved sessions; new VMs need the private
runtime and storage bindings provisioned before sourcing their selector. A new
checkout alone does not provision them.

Missing selector, runtime, session, or storage bindings must stop execution with
a visible failure. Authentication failures require owner repair of the private
runtime; do not blindly retry, change platform login, or substitute credentials.
No API key is required or used as a fallback. Production authentication, session
caches, binding values, and private service addresses must never enter public
Git, GitHub Actions, logs, artifacts, or VM/container images.

This is an owner-private runtime choice. OpenAI's official
[advanced CI/CD account-auth recipe](https://learn.chatgpt.com/docs/auth/ci-cd-auth)
explicitly excludes public and open-source repositories. It is not an official
support basis for this public repository or for subscription authentication in
public CI. BO's Actions checks remain offline and receive no model credentials.

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
