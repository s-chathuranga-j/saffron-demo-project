# Saffron syntax cheat sheet

Everything valid Gherkin is valid Saffron. `.saffron` files add `StepSet:`.

## Steps

```gherkin
Given I am on the login page                     # action (healable)
When I enter "standard_user" in the username field
And I click the "Log in" button
Then I should see the products page              # assertion (never healed)
But I should not see an error banner
```

`And`/`But` inherit action-vs-assertion from the preceding step. The
trailing block of assertions is always strict; under the opt-in
`adaptable-mid` policy only mid-scenario checkpoints may be adapted.

## Scenario Outlines

One cache serves every row: `<param>` placeholders stay in the cache and
resolve per row at replay.

```gherkin
Scenario Outline: Failed login shows an error
  When I enter "<username>" in the username field
  And I enter "<password>" in the password field
  And I click the "Log in" button
  Then I should see the error message "<message>"

  Examples:
    | username | password | message                    |
    | locked   | secret   | This user has been locked. |
    | standard | wrong    | Wrong username or password |
```

## Data tables

**2-column = key/value.** Values record as `<table:key>` references:
edit the values and replay stays free; change a key and the step
honestly re-records.

```gherkin
When I enter the following credentials
  | username | premium_user |
  | password | secret2      |
```

**Wider = records** (header row + one row per record). Cells record as
`<table:1:firstName>`, `<table:2:email>` (1-based rows). Editing any cell
replays free; adding/removing rows or renaming headers re-records.

```gherkin
When I add the following guests
  | firstName | email          | city   |
  | Alice     | alice@test.com | Oslo   |
  | Bob       | bob@test.com   | Bergen |
```

## Doc strings

Content records as `<docstring>`; rewording replays free. A later
assertion on that content follows the edit too ("the saved note should
be shown").

```gherkin
When I leave a note
  """
  Please deliver after 5pm.
  """
Then the saved note should be shown
```

## Secrets: `{env:VAR}`

```gherkin
When I enter "{env:ADMIN_USER}" in the username field
And I enter "{env:ADMIN_PASSWORD}" in the password field
```

Resolved from the environment (or a git-ignored `.env`; real env wins) at
replay. Caches, proposals, reports and history contain only the token;
a missing variable fails fast by name. Honest note: during the *first*
recording the agent types the real value once: use rotatable staging
credentials.

## Test data: `{data:...}`

Values that several scenarios share (accounts, names, enum values) live in
JSON files under `data/`, not in the feature file. Committed, so never
secrets.

```json
// data/users.json
{ "admin": { "email": "admin@test.com" }, "roles": ["Admin", "Editor", "Viewer"] }
```

```gherkin
When I sign in as {data:users.admin.email}
Then the role filter should list every {data:users.roles}
```

- A reference is the file name without `.json`, then a dotted path; a number
  picks a list entry (`{data:users.roles.0}`).
- The recording stores the token and replay reads the file: editing a value
  changes the next replay at zero tokens. A recording that still spells out
  the OLD value goes stale and records again.
- `every {data:list}` in a `Then` step records ONE assertion that names the
  list; replay checks each value, so adding one to the file needs no
  re-record. Every listed value must be present; extras like "All" are fine.
- A missing file or key stops the run before a browser opens, by name.
- Per environment: `data/users.staging.json` is laid over `data/users.json`
  with `--env staging` (or `SAFFRON_ENV`, or `"env"` in the config).

### Examples from a file (`.saffron` only)

```gherkin
Scenario Outline: Role sees its menu
  Given I sign in as <role>
  Then I should see the <menu> menu

  Examples: {data:roles}
```

Reads `data/roles.csv` (header row = placeholder names) or a JSON list of
records. One recording, one zero-token replay per row; adding a row records
nothing. A placeholder with no column is a parse error naming both.

### Unique per run: `{unique:name}`

```gherkin
When I register as user-{unique:id}@test.com
Then the welcome banner should greet user-{unique:id}@test.com
```

New on every run, the same within one run, so a later step can find what an
earlier step created and reruns do not collide with leftovers.
`{unique:name}` is 10 lowercase letters and digits; `{unique:name:digits}`
is 9 digits.

## Dates and dynamic values

- Say the intent: "select a check-in date 1 day from today" → recorded
  as `{date+1}`; stays valid every day. Formats: `{date}`, `{date-3}`,
  `{date+1:DD.MM.YYYY}`.
- Capture and compare displayed values instead of literals:

```gherkin
When I record the displayed total as "before"
And I add another night
Then "before" should differ from the displayed total
And the total should match "NOK [\d,]+"
And the "Book" link should point to "/booking"
```

## Network-aware steps (no keywords, plain prose)

```gherkin
When I place the order and wait for the order API to return 201
And I wait until the job status API reports "READY"
Then the order request should have returned 201        # assertion, never healed
```

Recorded as URL-pattern + method + status (+ body pattern) matchers;
waits are satisfied by responses from the triggering step onward, so
"click and wait" never races. Prefer these over any fixed sleep.

## Page furniture

```gherkin
When I click "Clear workspace" and confirm the dialog       # alert/confirm/prompt
When I upload the file "examples/sample.txt" as the attachment
When I drag the task card onto the done column
When I enter "Great tool" in the feedback comment and send it   # inside an iframe: just interact
Then the feedback widget should show "Thanks for: Great tool"
```

Upload paths resolve from the working directory. Links that open new
tabs are followed automatically.

## Tabs (plain prose, no keyword)

```gherkin
When I click the "Open preview" link                 # opens a new tab: replay follows it
Then the preview should show "Draft 3"               # asserted on the new tab
When I switch back to the first tab
And I close the preview tab
When I open a new tab at the admin page
```

Recorded as `switchTab` / `closeTab` / `newTab` with 0-based tab indexes
in creation order; replay repeats them in order. Say which tab in the
step ("the first tab", "the preview tab") so the recording is unambiguous.

## StepSets (`.saffron` only)

```gherkin
Feature: Checkout

StepSet: Complete guest information
    Given I am on the guest information page
    When I enter guest name "Chathuranga"
    And I click the continue button
    Then I am not on the guest information page

Scenario: Checkout happy path
    Given I am on the cart page
    StepSet Complete guest information
    Then I am on the checkout page
```

| Form | Syntax | Notes |
|---|---|---|
| Define | `StepSet: <name>` | Colon, like `Scenario:`; steps indented below |
| Invoke | `StepSet <name>` | No colon; sits anywhere among steps |

- Expanded at parse time: inlined steps cache and seed like ordinary
  steps; editing a set makes every caller honestly stale (re-recorded
  mostly seeded); heal edits route to the set definition.
- Names project-wide unique (also catches the colon typo at an
  invocation). Sets may contain tables, doc strings and `<param>`
  placeholders; no nesting; a set never runs standalone.
- Shared flows go in `features/shared.steps.saffron`, a sets-only
  library file with a `Feature:` header and no scenarios.
- Assertions inside a set are checkpoints mid-scenario and part of the
  strict final block when the set is invoked last.

## Tags

```gherkin
@smoke @checkout
Scenario: ...
```

`saffron run --filter @smoke`. `--filter` takes a tag expression:
`and`, `or`, `not` and parentheses, with `and` binding tighter than `or`
(`--filter "@e2e and not @wip"`, `--filter "(@smoke or @sanity) and not
@flaky"`). A comma, `|`, a space or a repeated `--filter` between plain
tags means `or`; once `and`, `not` or a parenthesis appears, join every
tag with `and` or `or`. The `@` may be left out.
