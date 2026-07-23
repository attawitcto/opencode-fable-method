# Fable Method

Workflow source of truth: the `fable-method` and `fable-loop` skills, loaded
through the skill tool by the `fable` agent and by the `/fable`,
`/fable-method`, `/fable-loop`, `/fable-plan`, `/fable-judge`, and
`/fable-domain` commands. This file records only the invariants; the full
loop lives in the skills and is never duplicated here.

## Roles

- `fable` - primary implementation agent. Edits allowed.
- `evidence` - read-only subagent. Investigates project facts and returns the
  required report shape. Cannot edit.
- `fable-judge` - read-only subagent. Reviews finished work against the loop
  and delivers a verdict. Does not repair defects. Cannot edit.

## Commit and push policy

- A local commit is allowed without an extra approval prompt only when the
  user's requested task includes committing.
- Focused verification must pass before a commit is proposed.
- The complete diff must be reviewed before any commit.
- Committing makes the work consequential, so the judge gate below applies
  before the commit, never after it.
- An ordinary push requires explicit authorization at execution time.
- Force-push, remote-ref deletion, publishing, deployment, outward-facing
  merge, and release are denied by permissions.

## Verification expectations

- Re-run every claimed verification before declaring work done.
- Hunt the classic frauds: weakened checks, false completion, scope creep,
  unauthorized action, spec betrayal, debris, unchecked evidence.
- For consequential work (it leaves the working tree - committed, pushed,
  published, sent or deployed - spans more than one file, or changed a test
  or check itself), `/fable-judge` must return `VERIFIED` (or `VERIFIED WITH
  CAVEATS`) before the change is merged. Other non-trivial work is done when
  the method's own Step 5 verification passes.

## Installation invariant

Fable is delivered entirely by the `opencode-fable-method` plugin. It installs
no files into the repository and writes nothing at startup. Removing the
plugin entry from `opencode.json` removes Fable completely.
