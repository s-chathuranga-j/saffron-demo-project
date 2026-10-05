# Saffron demo project

A Saffron test suite for the Haven & Pine booking app (`../demo-app`), set up to show Saffron's main features and to be reset and shown again as often as you like.

## Before a demo

1. Start the app (from `../demo-app`). Local runs use the dev server on `http://localhost:5173`, the `baseURL` in `saffron.config.json`:
   ```bash
   npm run dev:api   # one terminal
   npm run dev       # another
   ```
   CI starts the app with Docker on `http://localhost:8080` (`docker compose up --build -d`) and passes that address with `--base-url`.
2. Install once, in this folder:
   ```bash
   npm install
   npx playwright install chromium
   cp .env.example .env
   ```
3. Reset to the baseline:
   ```bash
   npm run demo:reset
   ```

Recording and healing need Claude access (a Claude Code login or `ANTHROPIC_API_KEY`). Replays need nothing.

## The suite

| File | Scenario | Shows |
| --- | --- | --- |
| `booking.saffron` | A guest books a room end to end (`@journey`) | StepSets, a data table, a doc string, `{unique:id}`, `{data:...}`, relative dates, the payment iframe, a network wait and a network assertion |
| `booking.saffron` | The booking summary adds 12% tax (`@pricing`) | Exact assertions: the target of the defect demo |
| `member.saffron` | Signing in shows member prices (`@member`) | `{env:DEMO_MEMBER_PASSWORD}` kept out of every file, capture and compare ("guest price" should differ) |
| `member.saffron` | A wrong password is refused | A negative path |
| `catalog.saffron` | Every room shows its nightly rate | A Scenario Outline whose rows come from `data/rooms.csv`: one recording, four replays |
| `catalog.saffron` | The package page offers every package | `every {data:catalog.packages}`: one assertion over a list in `data/catalog.json` |
| `checkout.saffron` | A declined card cannot complete the booking | A negative path through the iframe |
| `checkout.saffron` | Only Markdown or text notes can be attached | File uploads from `fixtures/` and `data/` |
| `shared.steps.saffron` | Five StepSets | Search, choose a room, guest details, pay, sign in: written once, used by every scenario |

Test data lives in `data/`; upload files in `fixtures/` and `data/`; the member password in `.env` (git-ignored).

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Run everything: replay what is recorded, record what is not, heal what broke |
| `npm run replay` | Replay only, no AI (what CI runs) |
| `npm run watch` | The same run in a visible browser |
| `npm run status` | What is recorded, pending review, tagged |
| `npm run steps` | The step vocabulary |
| `npm run report` | Open the HTML report of the last run |
| `npm run trace` | Open the execution replay of the last run: step through every action |
| `npm run accept` | List pending proposals; `npx saffron accept --all` promotes them |

Pass extra flags after `--`, for example `npm run watch -- --filter @journey`.

### Demo modes

Each mode points the same, unchanged tests at a changed app by adding a switch to the base URL (see `../demo-app/FLOWS.md`).

| Command | App change | Expected result |
| --- | --- | --- |
| `npm run demo:drift` | `?ui=v2`: buttons and labels renamed | Yellow: the journey heals the renamed steps and files a proposal |
| `npm run demo:merged` | `?flow=checkout-guest`: the guest page merged into checkout | Yellow: a flow change heal |
| `npm run demo:removed` | `?flow=breakfast-included`: the package page removed | Yellow: the package step heals to nothing |
| `npm run demo:defect` | `?bug=tax`: the UI charges 21% tax | Red: the tax assertion fails and is not healed |

The switches badge the app's corner ("UI v2", "Bug: tax 21%") so viewers can see which mode is on; the badge is hidden from Saffron's agent.

## CI heals and the IDE's CI runs

`.github/workflows/saffron.yml` runs the suite on GitHub Actions against the demo app in Docker. A push replays it at zero tokens. **Run workflow** (Actions tab) with a mode tests a changed app:

| Mode | What CI does |
| --- | --- |
| `standard` | Replays everything green |
| `drift`, `merged`, `removed` | Heals the journey in CI; `--strict` fails the job; uploads a `saffron-bundle` artifact and opens a draft pull request with the heal |
| `defect` | Goes red on the tax assertion, nothing healed; the bundle carries the report, screenshot and trace |

From the terminal:

```bash
gh workflow run saffron.yml -f mode=drift
```

Review the heal in one of two ways:

- **In the IDE:** pull, then open the VS Code *CI runs* view or the JetBrains *CI Runs* tab (extension or plugin 0.4.0 or later, `gh` signed in). **Import** the run, open the proposal's diff or replay, accept it, then commit and push. Accept imported proposals one by one: Accept All leaves CI heals out on purpose. In a terminal: `npx saffron runs`, `npx saffron import --run <id>`, `npx saffron diff`, `npx saffron accept <file>`.
- **In the pull request:** check out the `saffron/heal-<run id>` branch, run `npx saffron accept`, commit and mark it ready.

Setup, once: the repository secrets `ANTHROPIC_API_KEY` (CI heals need an API key; a Claude subscription login does not work in CI) and `DEMO_MEMBER_PASSWORD` (`pine-circle-2026`).

After a CI demo, undo what you accepted: revert the commit with the accepted heal, close the draft pull request and delete its branch.

## Resetting between showings

```bash
npm run demo:reset   # back to the committed baseline: green replays at zero tokens
npm run demo:fresh   # no recordings at all: the next `npm test` records everything live (uses AI)
```

`demo:reset` restores the committed recordings, feature files and data (an accepted heal or `accept --with-feature-edit` changes them) and removes proposals, reports, traces and screenshots. `demo:fresh` deletes every recording as well and works without a commit; run `demo:reset` afterwards to get the committed ones back.

The baseline is whatever is committed. After re-recording or accepting a change you want to keep, commit it.

## A suggested running order

1. `npm run demo:reset`, then open a `.saffron` file: plain language, no step definitions.
2. `npm test`: the whole suite replays green in seconds at zero tokens. `npm run report` for the report.
3. `npm run demo:drift`: the journey heals the renamed buttons and labels. `npm run trace` to step through the heal, then accept it from the replay page or with `npm run accept`.
4. `npm run demo:defect`: the wrong total goes red; Saffron does not heal an assertion.
5. `npm run demo:reset` to leave it ready for the next person.

To show a first recording, start with `npm run demo:fresh` and `npm run watch -- --filter @journey`, and finish with `npm run demo:reset`.
