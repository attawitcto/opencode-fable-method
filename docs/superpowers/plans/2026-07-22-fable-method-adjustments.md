# Fable Method Adjustments (Fable 5 instinct review) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five gaps found in the Fable 5 instinct review: baseline capture, the non-trivial/consequential inconsistency, the unconditional evidence fan-out, the implicit budget reset, and the `gh pr create` hard deny.

**Architecture:** Four tasks are surgical prose edits to the skill/prompt/instruction markdown files (the method is prose - its "code" is exact wording). One task is a small conditional in `.opencode/plugins/fable.js` plus its README row. No new files, no new dependencies.

**Tech Stack:** Markdown, plain ESM JavaScript (no build step, no test framework in this repo - verification is grep plus a node one-liner that exercises the plugin's `config` hook).

## Global Constraints

- The plugin never writes files at startup; nothing in this plan may change that (README "Design invariants" §1).
- The project always wins: `fill()` semantics and the project-override behavior must not change.
- OpenCode permission maps are last-match-wins over key order; never reorder existing rules, only change actions in place.
- Match the existing prose style of each file exactly (sentence-style bold leads, em-dash rhythm, no step-number scaffolding leaking into report guidance).
- The working tree already has uncommitted changes (`README.md` +34 lines, untracked `CLAUDE.md`). Stage ONLY the files each task names - never `git add -A` / `git add .`.
- TDD does not apply to prose edits; each task's check is a grep (or node run) with the expected output stated.

## Amendments (approved mid-execution)

Two tasks' wording was amended after review found the plan's own text too weak.
Where the task text below differs, these govern:

- **Task 3, item 2 threshold:** `Fan out only when the evidence surface is wide: the questions you have already written down number three or more, or they mix codebase questions with library/web questions.`
- **Task 3, item 3 in full:** `3. **Spot-check the evidence.** Open one citation behind a fact your plan will depend on from each subagent report (the cited file and line, or the fetched page) and confirm it says what the report claims. A report that cites nothing fails the spot-check outright. A failed spot-check invalidates that report's facts: regather that area yourself in the main thread.`
- **Task 4, appended sentence:** `A surprise (rule 7) resets the budget: the question it raised gets its own two rounds. The reset is not unlimited - a third surprise on the same task means stop and hand back what you have, like any other hard bound.`

A final whole-branch review then found contradictions with files these tasks did
not touch; the fixes are in the branch's last commit.

---

### Task 1: Baseline capture (`BASELINE:` artifact line)

**Files:**
- Modify: `skills/fable-method/SKILL.md` (Step 2 rules, Step 5(b), Step 6 bullet 1, Step 6 artifact gate)
- Modify: `skills/fable-loop/SKILL.md` (Stage 4.2 - also fixes its existing omission of TWINS/PENDING)
- Modify: `skills/fable-judge/SKILL.md` (False completion bullet)

**Interfaces:**
- Produces: the verbatim artifact line format `BASELINE: <check> was <passing / failing: symptom>` - Task 2 and later docs refer to artifact lines collectively; the canonical list becomes INTENT, BASELINE, AUTH, TWINS, PENDING.

- [ ] **Step 1: Add Step 2 rule 8 in `skills/fable-method/SKILL.md`**

After the line ending `Otherwise report it and continue.` (end of rule 7, Step 2), append a new list item:

```markdown
8. **Capture the baseline before the first edit.** Run the Step 1 check once (or the narrowest command it depends on: the failing test, the build, the lint for the touched area) before changing anything, and record `BASELINE: <check> was <passing / failing: symptom>` - the line appears verbatim in the report whenever behavior changed. A failure that pre-exists your work is a surprise (rule 7): report it and route; never silently adopt it as damage you caused, and never silently expand scope to fix it.
```

- [ ] **Step 2: Amend Step 5(b) in the same file**

Replace:

```markdown
- **(b)** the surrounding system still works: existing tests, build, or lint for the touched area. A green targeted check with a broken build is a failed verification.
```

with:

```markdown
- **(b)** the surrounding system still works: existing tests, build, or lint for the touched area, judged against the recorded `BASELINE:` line - a check that was already failing before your first edit is a pre-existing condition to report, not a regression you caused. A green targeted check with a broken build is a failed verification.
```

- [ ] **Step 3: Update Step 6 bullet 1 (allowed artifacts list) in the same file**

Replace:

```markdown
the only method artifacts that belong in a report are the INTENT line when behavior changed, the AUTH line when an outward action was taken, and the PENDING line when a prescribed follow-up was deliberately not taken.
```

with:

```markdown
the only method artifacts that belong in a report are the INTENT and BASELINE lines when behavior changed, the AUTH line when an outward action was taken, the TWINS line when a defect was fixed, and the PENDING line when a prescribed follow-up was deliberately not taken.
```

(This also fixes the pre-existing omission of TWINS from this list - Step 5(c) already requires it verbatim in the report.)

- [ ] **Step 4: Extend the Step 6 artifact gate in the same file**

Replace:

```markdown
behavior changed and no `INTENT:` line, add it; an outward action taken and no `AUTH:` line, add it;
```

with:

```markdown
behavior changed and no `INTENT:` line, add it; behavior changed and no `BASELINE:` line, add it; an outward action taken and no `AUTH:` line, add it;
```

- [ ] **Step 5: Fix Stage 4.2 in `skills/fable-loop/SKILL.md`**

Replace:

```markdown
No stage names or step numbers in the report; the INTENT and AUTH lines are the only method artifacts a report may contain.
```

with:

```markdown
No stage names or step numbers in the report; the method's artifact lines (INTENT, BASELINE, AUTH, TWINS, PENDING) are the only method artifacts a report may contain.
```

- [ ] **Step 6: Teach the judge to check it, in `skills/fable-judge/SKILL.md`**

Replace:

```markdown
   - **False completion.** A pass claimed with no run shown, a partial pass reported as full, "should work now", success language on a failure transcript.
```

with:

```markdown
   - **False completion.** A pass claimed with no run shown, a partial pass reported as full, "should work now", success language on a failure transcript, or a broken check blamed on pre-existing breakage with no `BASELINE:` line to back the claim.
```

- [ ] **Step 7: Verify**

Run: `grep -c "BASELINE" skills/fable-method/SKILL.md skills/fable-loop/SKILL.md skills/fable-judge/SKILL.md`
Expected: `skills/fable-method/SKILL.md:4`, `skills/fable-loop/SKILL.md:1`, `skills/fable-judge/SKILL.md:1`

- [ ] **Step 8: Commit**

```bash
git add skills/fable-method/SKILL.md skills/fable-loop/SKILL.md skills/fable-judge/SKILL.md
git commit -m "feat(method): require a BASELINE line captured before the first edit"
```

---

### Task 2: Resolve "non-trivial" vs "consequential" for the judge requirement

**Files:**
- Modify: `prompts/fable.md` (Scope discipline, last bullet)
- Modify: `instructions/fable-invariants.md` (Verification expectations, last bullet)
- Modify: `skills/fable-loop/SKILL.md` (Stage 3.2)

**Interfaces:**
- Produces: one shared definition, byte-identical in all three files: `(it changes behavior, spans multiple files, or produces something the user will ship)`.

- [ ] **Step 1: Amend `prompts/fable.md`**

Replace:

```markdown
- For non-trivial work, run `/fable-judge` and require `VERIFIED` (or
  `VERIFIED WITH CAVEATS`) before the change is considered done.
```

with:

```markdown
- For consequential work (it changes behavior, spans multiple files, or
  produces something the user will ship), run `/fable-judge` and require
  `VERIFIED` (or `VERIFIED WITH CAVEATS`) before the change is considered
  done. Other non-trivial work is done when the method's own Step 5
  verification passes.
```

- [ ] **Step 2: Amend `instructions/fable-invariants.md`**

Replace:

```markdown
- For non-trivial work, `/fable-judge` must return `VERIFIED` (or `VERIFIED
  WITH CAVEATS`) before the change is merged.
```

with:

```markdown
- For consequential work (it changes behavior, spans multiple files, or
  produces something the user will ship), `/fable-judge` must return
  `VERIFIED` (or `VERIFIED WITH CAVEATS`) before the change is merged.
  Other non-trivial work is done when the method's own Step 5 verification
  passes.
```

- [ ] **Step 3: Anchor the same definition in `skills/fable-loop/SKILL.md` Stage 3.2**

Replace:

```markdown
2. **For consequential changes, spawn attackers.**
```

with:

```markdown
2. **For consequential changes (it changes behavior, spans multiple files, or produces something the user will ship), spawn attackers.**
```

- [ ] **Step 4: Verify**

Run: `grep -rn "For non-trivial work" prompts/ instructions/ skills/`
Expected: no matches.
Run: `grep -rln "produces something the user will ship" prompts/ instructions/ skills/`
Expected: exactly `prompts/fable.md`, `instructions/fable-invariants.md`, `skills/fable-loop/SKILL.md`.

- [ ] **Step 5: Commit**

```bash
git add prompts/fable.md instructions/fable-invariants.md skills/fable-loop/SKILL.md
git commit -m "fix(method): define consequential once and scope the judge requirement to it"
```

---

### Task 3: Gate the evidence fan-out and spot-check evidence reports

**Files:**
- Modify: `skills/fable-loop/SKILL.md` (Stage 1 item 2; insert a new item 3; renumber old items 3-4 to 4-5)

- [ ] **Step 1: Gate the fan-out (Stage 1 item 2)**

Replace:

```markdown
2. **Evidence fan-out.** Spawn the evidence gatherers as parallel subagents in ONE message, never sequentially:
```

with:

```markdown
2. **Evidence fan-out - gated.** Fan out only when the evidence surface is wide: three or more independent areas, or codebase questions mixed with library/web questions. Below that, read directly in the main thread - a subagent's distilled report loses fidelity that direct reading keeps. When fanning out, spawn the gatherers as parallel subagents in ONE message, never sequentially:
```

- [ ] **Step 2: Insert the spot-check as new item 3, renumber the rest**

After item 2's closing line (`One batch plus one follow-up batch is the budget; a third needs a stated reason.`), insert:

```markdown
3. **Spot-check the evidence.** Open one load-bearing citation from each subagent report (the cited file and line, or the fetched page) and confirm it says what the report claims. A failed spot-check invalidates that report's facts: regather that area yourself in the main thread.
```

Then renumber `3. **Produce the plan artifact**` → `4.` and `4. **Decision gate.**` → `5.`.

- [ ] **Step 3: Verify**

Run: `grep -n "^[0-9]\." skills/fable-loop/SKILL.md | sed -n '/Stage 1/,$p'` - simpler: `awk '/## Stage 1/,/## Stage 2/' skills/fable-loop/SKILL.md | grep -n "^[0-9]\."`
Expected: items numbered 1-5, with 3 = Spot-check, 4 = Produce the plan artifact, 5 = Decision gate.

- [ ] **Step 4: Commit**

```bash
git add skills/fable-loop/SKILL.md
git commit -m "feat(loop): gate the evidence fan-out and spot-check subagent citations"
```

---

### Task 4: Surprises reset the lookup budget (explicitly)

**Files:**
- Modify: `skills/fable-method/SKILL.md` (Step 2 rule 5)

- [ ] **Step 1: Append one sentence to rule 5**

Replace:

```markdown
5. **Time-box mechanically.** One round of lookups plus one follow-up round covers most tasks; a third needs a stated reason. If two consecutive lookups told you nothing new, stop.
```

with:

```markdown
5. **Time-box mechanically.** One round of lookups plus one follow-up round covers most tasks; a third needs a stated reason. If two consecutive lookups told you nothing new, stop. A surprise that changes your hypothesis (rule 7) resets the budget: the new question gets its own two rounds.
```

- [ ] **Step 2: Verify**

Run: `grep -n "resets the budget" skills/fable-method/SKILL.md`
Expected: one match, inside Step 2 rule 5.

- [ ] **Step 3: Commit**

```bash
git add skills/fable-method/SKILL.md
git commit -m "fix(method): state explicitly that a surprise resets the lookup budget"
```

---

### Task 5: `gh pr create` - `ask` by default, `deny` only under the strict profile

**Files:**
- Modify: `.opencode/plugins/fable.js` (bashRules signature + rule, HARD_DENIES, projectPermission, FableMethod state, doctor, PROBES)
- Modify: `README.md` (permission profile table rows)

**Interfaces:**
- Consumes: nothing from other tasks (independent).
- Produces: `bashRules({ commit, strict })` and `projectPermission({ commit, strict })` - both callers inside `fable.js` are updated in this task; no external consumers exist.

- [ ] **Step 1: Thread a `strict` flag through `fable.js`**

Apply these exact replacements:

`const bashRules = ({ commit }) => [` → `const bashRules = ({ commit, strict }) => [`

`  ['gh pr create*', 'deny'],` →

```javascript
  // ponytail: PRs are closable; only the strict profile hard-denies them.
  ['gh pr create*', strict ? 'deny' : 'ask'],
```

`const HARD_DENIES = bashRules({ commit: 'allow' }).filter(([, action]) => action === 'deny')` →

```javascript
// strict: true so a read-only subagent keeps the deny regardless of profile.
const HARD_DENIES = bashRules({ commit: 'allow', strict: true }).filter(([, action]) => action === 'deny')
```

`const projectPermission = ({ commit }) => ({` → `const projectPermission = ({ commit, strict }) => ({`

`  bash: toMap(bashRules({ commit })),` → `  bash: toMap(bashRules({ commit, strict })),`

In `doctor`: `const { config, injected, commit } = state` → `const { config, injected, commit, strict } = state`
and `const defaults = projectPermission({ commit })` → `const defaults = projectPermission({ commit, strict })`

In `FableMethod`:

```javascript
  const commit = options.permissionProfile === 'strict' ? 'ask' : 'allow'
  const state = { config: null, commit, injected: { agents: [], commands: [] } }
```

→

```javascript
  const strict = options.permissionProfile === 'strict'
  const commit = strict ? 'ask' : 'allow'
  const state = { config: null, commit, strict, injected: { agents: [], commands: [] } }
```

and `config.permission = fill(projectPermission({ commit }), config.permission)` → `config.permission = fill(projectPermission({ commit, strict }), config.permission)`

Add `'gh pr create --fill',` to the `PROBES` array (after `'npm publish',`).

- [ ] **Step 2: Verify by running the config hook**

Run:

```bash
node --input-type=module -e "
import F from './.opencode/plugins/fable.js'
const run = async (opts) => { const p = await F({}, opts); const c = {}; await p.config(c); return c }
const d = await run(); const s = await run({ permissionProfile: 'strict' })
console.log('default:', d.permission.bash['gh pr create*'])
console.log('strict :', s.permission.bash['gh pr create*'])
console.log('evidence subagent:', d.agent.evidence.permission.bash['gh pr create*'])
console.log('judge subagent:', d.agent['fable-judge'].permission.bash['gh pr create*'])
"
```

Expected output, exactly:

```
default: ask
strict : deny
evidence subagent: deny
judge subagent: deny
```

- [ ] **Step 3: Update the README permission tables**

In the `ask` row, replace `` `docker push`, `` with `` `docker push`, `gh pr create` (strict profile: deny), `` .

In the `deny` row, replace `` `gh pr create` / `gh pr merge` / `gh release create` `` with `` `gh pr merge` / `gh release create` `` .

- [ ] **Step 4: Verify README consistency**

Run: `grep -n "gh pr create" README.md .opencode/plugins/fable.js`
Expected: README shows it only in the `ask` row (with the strict note); `fable.js` shows the ternary rule, the PROBES entry, and the INSPECT_DENIES entry (unchanged, still `deny`).

- [ ] **Step 5: Commit**

```bash
git add .opencode/plugins/fable.js README.md
git commit -m "feat(permissions): gh pr create asks by default, denied under strict"
```
