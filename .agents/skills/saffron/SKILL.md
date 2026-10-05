---
name: saffron
description: Write, run, and maintain end-to-end UI tests with Saffron, where tests are written in plain language, an AI agent records each scenario once, and every later run replays at zero tokens. Use when creating or editing .feature / .saffron files, defining StepSets, reviewing .saffron/cache proposals, running `saffron run`, or when the user mentions Saffron, Gherkin scenarios, step sets, cached replay, or `saffron.config.json`.
license: Saffron Free Use License v1.0 (see the saffron-ai package LICENSE)
metadata:
  author: saffron-ai
  homepage: https://saffron-ai.io
---

# Saffron

Saffron runs plain-Gherkin scenarios in a real browser. There are **no
step definitions and no glue code**: on the first run an AI agent performs
each step and records what it did into a JSON cache; every later run
is replayed by Saffron in a real browser: zero AI calls, zero tokens, at
the speed of the browser and the app. (The cache is Saffron's own JSON, run
on Playwright's browser engine; Playwright MCP is used only by the agent
while recording and healing.) When the UI drifts, the agent heals the failing
step mid-run and files a reviewable proposal.

Your job when writing tests is to make that economy work. Three rules
matter more than everything else:

## 1. Exact step text is the cache identity: reuse the vocabulary

A step is looked up by its exact wording. `When I visit the login page`
and `When I open the login page` are two different steps: the second one
costs a fresh AI recording (~$0.10–$2) even though the first already
replays for free.

**Before writing any step, look at what the project already knows:**

```bash
npx saffron steps                 # every step: ● recorded, ● divergent, ○ unrecorded
npx saffron steps "login"         # search
npx saffron steps --json          # machine-readable
```

Prefer a `●` recorded wording verbatim. Quoted values may differ freely
(`I enter "admin"` seeds from `I enter "bob"`), so parameterize with
quotes rather than inventing new phrasings. `saffron init` registers the
`saffron` MCP server with Claude Code, Cursor and VS Code; its
`search_steps` / `list_step_sets` / `project_status` tools give the same
answers without a shell.

**Know the project before touching it:**

```bash
npx saffron status                # files and scenarios (● cached, ◐ proposal pending, ○ unrecorded), tags, proposals, last run, health
npx saffron status --json         # the same as data (what the IDE panels and the project_status MCP tool read)
```

Use it to pick tags that already exist, to see which scenarios are
cached (editing their text re-records them), which proposals await
review, and whether the vocabulary has divergent steps or duplicate
wordings to converge before adding more.

## 2. `Then` steps are sacred: write them as the verdict

Saffron never heals an assertion: the agent may help *reach* a `Then`,
never make it pass. So `Then` lines must state exactly what must be true,
with stable text, never volatile values (prices, dates, counters). A `Then`
that records no check at all fails on replay, so every assertion step must
end up with something recorded against it. Put
the final assertions **last**; the trailing block of `Then` steps is
strict under every policy. Use `Given`/`When` for actions.

## 3. Never bake volatile or secret values into files

- Secrets: `{env:VAR}`, as in `When I enter "{env:ADMIN_PASSWORD}" in the password field`.
- Shared test data (accounts, names, enum values): put it in `data/*.json` and write `{data:users.admin.email}` (file, then dotted path; one value, not a list). The recording stores the token, so editing the file changes the next replay at zero tokens. Never for secrets: data files are committed. To check a whole list (an enum), point a Then step at it: `Then the status filter should list every {data:enums.OrderStatus}`; replay iterates the file's list, so adding a value needs no re-record. `Examples: {data:roles}` reads outline rows from `data/roles.csv` or a JSON list (`.saffron` only). A value that must be new on every run (an email for a sign-up) is `{unique:name}`: fresh per run, the same within it.
- State the application must be in before the suite (seeded users, a reset database): do not script it through the UI in every scenario. The project's `saffron.config.json` takes `"setup"` and `"teardown"` shell commands, run once around `saffron run` (teardown always runs). Propose a seed script there; keep scenario steps for the behaviour under test.
- Dates: write intent, not literals: "1 day from today" records as `{date+1}`.
- Dynamic display values: capture and compare, e.g. `I record the total as "first"` … `"first" should differ from the displayed total`.

## Writing a scenario: the shape that records cleanly

```gherkin
Feature: Checkout

  Background:
    Given I open the application
    And I accept cookies if prompted          # conditional steps are fine

  @smoke
  Scenario: Guest can complete checkout
    When I add "Blue Widget" to the cart
    And I place the order and wait for the order API to return 201
    Then I should see "Order placed"
    And the order request should have returned 201
```

Guidelines the recorder rewards:

- One intent per step; 5–10 steps per scenario. Long scenarios heal badly.
- Name the page or control in the step (`on the checkout page`, `the "Save" button`).
- Data belongs in tables and doc strings, not in prose (see references).
- Conditional wording (`if prompted`) records as a no-op when absent.
- Real-world furniture just works if you say it: dialogs ("and confirm the
  dialog"), uploads ("upload the file "x.txt" as the attachment"),
  drag-and-drop ("drag the card onto the done column"), iframes
  (interact normally), network waits ("wait for the order API to return
  201", "wait until the job status API reports "READY"").

## Repeated step groups → StepSets (`.saffron` files only)

`.saffron` is a superset of `.feature`: rename the file, nothing else
changes, and you gain the `StepSet:` keyword.

```gherkin
StepSet: Complete guest information            # define: colon, like Scenario:
    Given I am on the guest information page
    When I enter guest name "Chathuranga"
    And I click the continue button
    Then I am not on the guest information page

Scenario: Checkout happy path
    Given I am on the cart page
    StepSet Complete guest information         # invoke: no colon, like a step
    Then I am on the checkout page
```

- Definition: `StepSet: <name>`. Invocation: `StepSet <name>`, the bare
  name without the keyword is a silent parse error.
- Names are project-wide unique; sets resolve across files; no nesting.
- Application-wide flows (login, cookie banner) live in a sets-only
  library file: `features/shared.steps.saffron` (still needs a
  `Feature:` header; it yields no runnable scenarios).
- Start a set with a guard step, end it with an exit assertion.

## The workflow

```bash
npx saffron run                          # record misses, replay hits, heal failures
npx saffron run --filter @smoke          # by tag; or an expression: "@e2e and not @wip", "(@smoke or @sanity) and not @flaky"
npx saffron run --no-agent               # replay only (CI without AI access)
npx saffron status                       # what is cached, pending, tagged; vocabulary health
npx saffron diff                         # what a proposal changes, action by action: the evidence
npx saffron accept                       # list pending proposals with narratives
npx saffron accept --all                 # promote verified proposals to caches
npx saffron accept <file> [<file>...]    # promote chosen ones
npx saffron reject <file> [<file>...]    # discard chosen ones; the agent retries next run
npx saffron report                       # open the HTML report
npx saffron dashboard                    # suite quality: failing, flaky, never run, slowest, per tag
npx saffron run --rerecord --filter @t   # a recording is wrong: record it fresh
npx saffron trace "<scenario>"           # a red or healed scenario, step by step, with the page at every action ("trace" on in config)
npx saffron runs                         # this branch's CI runs; a heal made there: saffron import --run <id>
```

Results: **green** = cached pass · **yellow** = pending review (an AI
recording or adaptation filed a proposal) · **red** = failed. Proposals
arrive stamped `verified ✓` (zero-AI proof replay passed) or
`UNVERIFIED ✗`; accept the former, investigate the latter. A proposal is
bound to the scenario and the committed recording as they were when it was
filed: `saffron accept` refuses a STALE one (the step or the recording
moved since) with no override; run the scenario again for a fresh one. Commit
`.saffron/cache/` like snapshots; git-ignore `.saffron/reports/`.

Cost in the summary line and report: on an API key the dollars are what
was billed; on a Claude subscription (Claude Code login, no key) the
headline is the 5-hour plan window before and after the run, and the
dollars are the API-equivalent, marked `≈`. Both name the models used.

Scenario Outlines record once: the first Examples row records, later
rows replay that proposal at zero AI. Write the `Then` with the row's
value quoted exactly (`Then I should see "<message>"`); the recorder
keeps the placeholder, so every row satisfies it.

**Never hand-edit files under `.saffron/cache/` or `.saffron/proposals/`**
unless deliberately authoring a manual cache (`"recordedBy": "manual"`).
To change behavior, change the `.feature`/`.saffron` text and let the run
re-record (mostly seeded from existing step recordings).

**Review a CI heal.** A heal made in CI travels as a bundle (`saffron
export` in the workflow, uploaded as an artifact). On the reviewer's
checkout, `saffron runs` lists the branch's CI runs and `saffron import
--run <id>` (or `saffron import <bundle>`) files the run's proposals,
report and traces here, each checked against this checkout; then
`saffron diff`, `saffron accept` and commit `.saffron/cache/` as usual.
With `saffron export --branch <name>` CI pushes the proposals as a branch
with a draft pull request instead: switch to it, accept, commit, push.

## Anti-patterns that cost money or hide bugs

| Don't | Do |
|---|---|
| Invent a synonym for an existing step | Reuse the `●` wording from `saffron steps` |
| Assert inside a `When` ("When I see the dashboard") | Act in `When`, assert in `Then` |
| `Then the price is "NOK 1,148"` | `Then the price should match "NOK [\d,]+"` intent, or capture + compare |
| Put a password literal in a step | `{env:VAR}` |
| Sleep/wait "for 3 seconds" | Wait for a UI signal or an API response |
| One 30-step scenario | Several 5–10 step scenarios + StepSets |
| Edit cache JSON to fix a test | Edit the scenario text and re-run, or `saffron run --rerecord` if the recording itself is wrong |

## References

- [Syntax cheat sheet](references/syntax.md): tables, doc strings,
  outlines, secrets, dates, network waits, page furniture, StepSets.
- [Configuration & CI](references/config.md): `saffron.config.json`,
  flags, `--strict`, cross-browser, workers, heal model, secrets setup.
