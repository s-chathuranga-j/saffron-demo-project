#!/usr/bin/env node
// Puts the demo back to a known state between showings.
//
//   npm run demo:reset    Back to the committed baseline: caches, feature files and data as committed;
//                         no proposals, reports, traces or screenshots. The next run replays green at zero tokens.
//   npm run demo:fresh    No recordings at all: the next run records every scenario from scratch (uses AI).
//                         `npm run demo:reset` brings the committed recordings back afterwards.
//
// The baseline is whatever is committed, so after accepting a change you want to keep, commit it.
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const fresh = process.argv.includes('--fresh')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

// A clean slate needs no baseline: drop every recording, proposal, report and trace.
if (fresh) {
  rmSync(join(root, '.saffron'), { recursive: true, force: true })
  console.log('Fresh start: no recordings or proposals. The next `npm test` records every scenario (uses AI).')
  process.exit(0)
}

let head
try {
  head = git('rev-parse', '--short', 'HEAD')
} catch {
  console.error('No baseline commit yet: record the suite, accept the proposals, then commit (see README).')
  process.exit(1)
}

// What a run can change: recordings and history under .saffron, feature files
// (accept --with-feature-edit rewrites them) and data. Restore only what the baseline has.
const tracked = ['.saffron', 'features', 'data'].filter((path) => git('ls-tree', '--name-only', 'HEAD', path) !== '')
if (tracked.length) git('restore', '--source=HEAD', '--staged', '--worktree', '--', ...tracked)

// Everything a run created: proposals, reports, traces, screenshots (-x includes git-ignored files).
const removed = git('clean', '-fdx', '--', '.saffron').split('\n').filter(Boolean)
removed.push(...git('clean', '-fd', '--', 'features', 'data').split('\n').filter(Boolean))

console.log(`Back to the baseline at ${head}: recordings, features and data restored; ${removed.length} run file(s) removed.`)
