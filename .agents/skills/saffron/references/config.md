# Configuration, CLI and CI

## Project layout

```
your-project/
  features/               .feature and .saffron files
  saffron.config.json
  .saffron/
    cache/                committed replay caches      → commit
    proposals/            pending AI proposals         → review, then gone
    history.jsonl         one line per run (trends)    → commit recommended
    reports/              latest.html / latest.json    → git-ignore
    artifacts/            screenshots and traces (latest run)  → git-ignore
```

## `saffron.config.json`

```json
{
  "baseURL": "https://stage.your-app.com",
  "features": "features",
  "dataDir": "data",
  "actionTimeoutMs": 5000,
  "pollIntervalMs": 100,
  "retries": 1,
  "screenshot": "viewport",
  "trace": "retain-on-failure",
  "provider": "claude",
  "model": "claude-sonnet-5",
  "healModel": "claude-haiku-4-5",
  "maxTurns": 100,
  "storageState": ".auth/state.json",
  "strict": false,
  "assertionPolicy": "strict",
  "verifyProposals": true,
  "reuseSteps": true,
  "snapshotMode": "none",
  "browser": "chromium",
  "workers": 1
}
```

| Key | Meaning |
|---|---|
| `dataDir` | Folder of JSON files read by `{data:file.key}` tokens (default `data`). Committed; not for secrets |
| `baseURL` | App under test; steps say "the login page", not full URLs |
| `storageState` | Playwright storage-state JSON so replays and the agent start authenticated (`npx playwright open --save-storage=.auth/state.json <url>`) |
| `actionTimeoutMs` | Budget for one action: Playwright's actionability wait and the deadline for a polled assertion (default 5000) |
| `pollIntervalMs` | How often a polled assertion re-checks the page inside that budget (default 100, minimum 10) |
| `screenshot` | Screenshot of the failing tab when a step fails: `viewport` (default), `full-page`, `off`. Shown in the report; paths in `latest.json` under `evidence`; files in `.saffron/artifacts/` (git-ignore it) |
| `retries` | Extra attempts per action with backoff before a step fails and the agent heals (default 1). Not a scenario re-run; reports show a `retried ×N` chip |
| `strict` | Yellow (passed-with-adaptation) exits 1 until reviewed: cached-green-only CI |
| `assertionPolicy` | `strict` (default) or `adaptable-mid`; the final assertion block is always strict |
| `verifyProposals` | Proof-replay every recording zero-AI before filing (default true) |
| `reuseSteps` | Seed new recordings from existing step recordings (default true) |
| `snapshotMode` | `none` (default, ~60% fewer AI calls) or `full` for highly dynamic pages |
| `setup` / `teardown` | shell command or list, run once before / after the run in the project root (seed and clean test data). Failed setup: exit 2, nothing runs. Teardown always runs. They receive `SAFFRON_BASE_URL` and `SAFFRON_ENV`. `--no-hooks` skips them; `hookTimeoutMs` (default 300000) bounds each |
| `trace` | `off` (default), `on` or `retain-on-failure`: keep an execution trace per scenario; `saffron trace` opens it as a replay with the page inspectable at every step |
| `browser` | `chromium` / `chrome` / `msedge` / `firefox` / `webkit`: replay runs anywhere; recording and healing need one of the first three. `chrome` and `msedge` must be installed on the machine |
| `workers` | Parallel replay workers; agent work stays sequential |
| `shardBy` | How `--shard` splits the suite: `"scenario"` (default) or `"file"` (each feature file on one machine) |
| `provider` | Whose agent records and heals, on its login on this machine: `claude` (default), `codex` (ChatGPT plan), `antigravity` (Google AI Pro/Ultra via the `agy` CLI, experimental), `cursor`. Also `--provider` |
| `model` | Model in the provider's own names (unset: the provider's default). A `--provider` run on another provider ignores it |
| `healModel` | Cheaper model for heal sessions only |
| `ci` | Where `saffron runs` and `import --run` find CI runs: `{"provider": "github" \| "azure", "organization": ..., "project": ...}`. Unset, an Azure Repos remote means Azure Pipelines (through `az`), anything else GitHub Actions (through `gh`). `organization` and `project` are for a GitHub repository built by Azure Pipelines |

## CLI

| Command | Purpose |
|---|---|
| `saffron run [paths] [--filter <tag expression>] [--no-agent] [--strict] [--browser b] [--workers n] [--shard i/n] [--shard-by scenario\|file] [--provider p] [--heal-model m] [--headed] [--trace mode]` | Run; cached replay, agent on misses/failures. `--filter` takes tags or an expression (`"@e2e and not @wip"`). `--shard 2/4` runs one part of the suite on one CI machine and writes `shard-2-of-4.json` instead of `latest.json`; `--trace retain-on-failure` keeps an execution trace of each scenario that is not green |
| `saffron trace [scenario] [--port n] [--no-open] [--json] [--run startedAt]` | Open the execution replay of a scenario from the last run (scenario name, feature path or `feature:scenario`; default: every traced scenario in one replay, opening on a red one, else a yellow one); `--json` prints the parsed trace; `--run` opens it only while the last run is that one |
| `saffron accept [files... \| --all] [--include-unverified] [--with-feature-edit] [--propagate]` | Promote proposals (`--all` skips UNVERIFIED ones unless `--include-unverified`); `--with-feature-edit` rewrites adapted steps in the feature file; `--propagate` applies a heal's locator fix to every cache using that locator |
| `saffron reject [files... \| --all]` | Discard proposals |
| `saffron prune [--yes] [--check] [--json]` | List recordings no scenario owns any more; `--yes` deletes them, `--check` exits 1 for CI |
| `saffron status [--json]` | Project overview: files and scenarios with cache state, tags, pending proposals, last run, history, vocabulary health, effective config |
| `saffron steps [search] [--json] [--snippets]` | The step vocabulary with recorded/divergent/unrecorded badges |
| `saffron author <prose-file> [--provider p]` | Draft a `.saffron` file from plain-paragraph requirements using the project vocabulary |
| `saffron login [provider]` | Check that a provider can record and heal here and list what is missing; `saffron login cursor` also runs Cursor's one-time sign-in, `saffron login antigravity` also allows Saffron's tools in agy |
| `saffron mcp` / `saffron lsp` | MCP tools (`search_steps`, `list_step_sets`, `project_status`) for AI assistants / language server for editors |
| `saffron init [--examples] [--agents list]` | Install this skill into the project's agent directories, register MCP, add an AGENTS.md block, scaffold config; `--examples` adds the Saucedemo example suite |
| `saffron report [--merge [paths]]` | Open the latest HTML report; `--merge` combines a complete set of shard reports into `latest.json`, `latest.html` and one history line |
| `saffron dashboard [--stdout] [--no-open]` | The suite's quality from the run history (failing and for how long, flaky, repeatedly healed, never run, slowest, trends, per tag); writes and opens `.saffron/reports/dashboard.html`, `--stdout` prints it |
| `saffron export [-o file] [--branch name [--base branch]]` | In CI: pack the pending proposals, the run's report, screenshots and traces into `.saffron/reports/saffron-bundle.zip` to upload as an artifact. `--branch` also pushes the proposals as a new branch and opens a draft pull request (GitHub through `gh`, Azure DevOps through `az`); exit 1 only when the branch is pushed but the pull request could not be opened |
| `saffron runs [--branch b] [--limit n] [--provider github\|azure] [--json]` | The branch's CI runs, with how many of each run's proposals are pending here; exit 2 when `gh` or `az` is missing or signed out |
| `saffron import <bundles...> \| --run <id> [--overwrite] [--allow-unknown-repository] [--json]` | Bring a CI run's bundle into this checkout: its proposals (each checked against the files here), report and traces. Then `saffron diff` and `saffron accept` as usual. Exit 1 when a proposal was not imported, 2 when the bundle was refused |

Exit codes: 0 green/yellow, 1 red (or yellow with `--strict`), 2 usage /
preflight (e.g. a missing `{env:VAR}`) or any expected failure, printed as
one line (`SAFFRON_DEBUG=1` shows the stack).

## AI access

Recording and healing need the configured provider's login on the machine.
Claude (default): `ANTHROPIC_API_KEY`, or a Claude Code login. Codex: a
ChatGPT-plan `npx @openai/codex login` plus `npm i -D @openai/codex-sdk`. Antigravity:
Google's `agy` CLI, signed in once, then `npx saffron login antigravity`
(allows Saffron's tools in agy's settings). Cursor: `npm i -D @cursor/sdk`
and `npx saffron login cursor`. `npx saffron login` lists what is missing.
Replay-only runs (`--no-agent`) need none: that is the normal CI mode once
caches are committed. With no `model` configured the provider's default
model is used; set `model` (and `healModel`) to pin one. On a Claude
subscription login the report shows the 5-hour plan window used and the
API-equivalent dollars; on a key it shows what was billed; Codex,
Antigravity and Cursor report tokens only.

## IDE integration

The VS Code extension and the JetBrains plugin add right-click Run on
`.saffron` files, a Saffron panel (feature files, tags, proposals to
accept or reject, vocabulary health, config) and the report as an
in-editor dashboard, all reading `saffron status --json`. Nothing there
is required for agents; the CLI is the same surface.

## Recommended CI

```bash
npx playwright install chromium
npx saffron run --no-agent --strict     # replay committed caches; no AI, no surprises
```

Record new scenarios on developer machines. A CI job that may heal (it
has the provider's login or key) runs without `--no-agent`, and its heals
travel to the reviewer as a bundle, never lost with the CI workspace:

```yaml
# GitHub Actions
- run: npx saffron run --strict
- name: Saffron bundle
  if: failure()
  run: npx saffron export --out saffron-bundle.zip
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: saffron-bundle
    path: saffron-bundle.zip
```

Azure Pipelines is the same: `saffron export --out
$(Build.ArtifactStagingDirectory)/saffron-bundle.zip`, then publish it as
the `saffron-bundle` artifact. Keep the artifact name starting with
`saffron-bundle`: that is what `saffron import --run` and both editors'
CI runs views download. Upload a file outside `.saffron/` (`--out`), as
`upload-artifact` leaves hidden folders out.

On the reviewer's checkout: `npx saffron runs`, then `npx saffron import
--run <id>`, then `saffron diff`, `saffron accept` and commit
`.saffron/cache/`. For review in a pull request instead, add `--branch
saffron/heal-<run id>` to the export step: CI pushes the proposals (not
the caches) as a branch and opens a draft pull request whose description
says how to accept them; it needs a token that may push and open pull
requests.

## Reading a report

Per scenario: status, duration, AI calls and tokens (including prompt
cache reads/writes: the real bill), adaptation narrative, cache diff and
suggested feature edit for yellows, drift chips when page fingerprints no
longer match. Trends vs. the previous run and 20-run sparklines come from
`.saffron/history.jsonl`; **chronic** scenarios (healing repeatedly) are
flagged: re-record those instead of paying for heals again.
