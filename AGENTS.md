<!-- saffron:start -->
## Saffron end-to-end tests

UI tests are plain-Gherkin `.feature` / `.saffron` files under `features/`,
run by Saffron (`npx saffron run`). No step definitions exist: an AI agent
records each scenario once; later runs replay at zero tokens.

- Load the `saffron` skill before writing or editing scenarios.
- Exact step text is the cache identity: run `npx saffron steps` and reuse
  recorded wordings instead of inventing synonyms.
- `Then` steps are never healed: write them as the verdict, last.
- `npx saffron status` shows what is cached, what awaits review, the tags
  and vocabulary health; editing a cached scenario's text re-records it.
- Never edit `.saffron/cache/` or `.saffron/proposals/` by hand; change the
  scenario text and re-run. Review proposals with `npx saffron accept`
  (`--all`, or chosen files) and `npx saffron reject`.
- A heal made in CI arrives as a bundle: `npx saffron runs` lists the
  branch's CI runs, `npx saffron import --run <id>` files its proposals
  here; then review and accept as above. `npx saffron trace <scenario>`
  replays a red or healed scenario step by step.
- Secrets go in `{env:VAR}` tokens, never in files.
- Shared test data (accounts, names, enum values) goes in `data/*.json`,
  referenced as `{data:file.path.key}`; check a whole list with "every
  {data:file.list}"; read Examples rows from a file with
  `Examples: {data:file}` (.saffron only). Use `{unique:name}` for a value
  that must be new on every run. Never put secrets in `data/`.
<!-- saffron:end -->
