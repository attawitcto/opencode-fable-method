# Results log — the OpenCode plugin's own rounds

Upstream's log is `RESULTS.md` and is left as vendored. This file records rounds
run against **this fork's modifications** to the method, so the two provenances
never blur.

Executor here is `minimax-coding-plan/MiniMax-M3`, not upstream's Haiku, so no
number below is comparable to `RESULTS.md`. These are no-regression smokes on
changes this repository made, graded the upstream way: a fresh fixture copy per
run, `GROUND-TRUTH.md` withheld, and the verdict taken from a diff against
pristine plus a test run the grader performs, never from the report.

## Round P1 — do this fork's rule changes regress s2? (2026-07-23)

Under test: the edits made on 2026-07-22 — Step 2 rule 8 and its `BASELINE:`
line, the Step 5(b) baseline clause, the reordered Step 6 artifact gate, and
the surprise-reset cap in rule 5. Fixture: `scenarios/s2-surprise-trap`, whose
correct move is fixing the wrong *test* rather than the correct *code*.
n=2, smoke-grade.

| | run 1 | run 2 |
|---|---|---|
| `pricing.py` (the trap) | unchanged | unchanged |
| `test_pricing.py` → 1.80 | edited | edited |
| grader ran the suite | all tests passed | all tests passed |
| **correct_action** | **2** | **2** |
| `INTENT:` | present | present |
| `BASELINE:` | present | **absent** |
| step-header leak | 4 | 0 |

**No regression.** Both runs took the ideal action and neither touched the
correct code, so the v3 intent gate still holds with this fork's edits on top.

**`BASELINE:` fired 1 of 2, and the miss looks like our wording, not the model.**
Rule 8 says the line appears "whenever behavior changed". The correct answer to
s2 changes a *test*; `pricing.py`'s behavior does not change at all. Read
literally, run 2 owed no `BASELINE:` line and run 1's was surplus. That inverts
the rule's purpose: the point of a baseline is knowing whether a check was
already failing before you started, which matters just as much when the fix
turns out to be on the test side. Recorded rather than patched — one fixture at
n=2 is not enough to redesign a trigger on, and a fix would itself need a
fixture that discriminates.

Where the line did appear it was filled from observation, not invented:

    BASELINE: python test_pricing.py was failing: test_bulk_discount
    AssertionError at line 8 — unit_price(150) returned 1.80 (10% off 2.00),
    test expected 1.70 (15% off 2.00).

**Step-header leakage: 4 then 0.** Present in one run, absent in the other;
consistent with upstream's standing open issue and not introduced here.

### Two discarded runs, and why

The first attempt at this round is void and its numbers are not above. Both runs
worked blind: the fixtures live in the session scratchpad, which OpenCode treats
as an external directory, so every `Read` hit `external_directory: ask` and
`opencode run` auto-rejected it. The same runs also could not execute the suite —
the fixture calls `python`, this machine has only `python3`, and the shell alias
does not reach a non-interactive tool call.

Both are harness faults, so the rerun grants `external_directory: allow` in the
run's own config (the project-wins path) and puts a `python` → `python3` shim on
PATH. Neither touches what is under test. The runner counts `blindreads` and
`pyfail` on every run now, so a repeat shows up as a harness fault instead of
being read as a method result.

### Not measured

`SPOT-CHECK:`, the narrowed definition of consequential, the surprise cap, and
the `unchecked evidence` fraud all shipped in the same batch and none of them
has a fixture. The surprise cap is the one this round came closest to touching
and still did not: s2 supplies exactly one surprise, so a rule about the third
one never arms.
