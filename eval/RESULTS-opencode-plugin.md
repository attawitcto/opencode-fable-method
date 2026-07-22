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

## Round P2 — s5, the mirror of s2 (2026-07-23)

Same executor and protocol. `scenarios/s5-twin-bug` was chosen because it
inverts every condition P1 left ambiguous: the suite starts **green while the
code is wrong**, the correct answer edits **code** rather than a test, so
behaviour genuinely changes and `BASELINE:` is unambiguously owed. It also arms
`TWINS:` directly — the off-by-one sits in `create_order` and `update_order`,
and the task names only the first. n=2, smoke-grade.

Scoring was mechanical: the grader imports the module and calls
`create_order("A", 1)` and `update_order({...}, 1)`, then checks 0 and 1000 are
still rejected. Fixing only the reported site scores at most 1 by the fixture's
own cap.

| | run 1 | run 2 |
|---|---|---|
| sites fixed | **both** | **both** |
| boundaries (1 and 999 ok, 0 and 1000 rejected) | correct | correct |
| grader ran the suite | green | green |
| qty=1 test gap | closed with a regression test | noted, offered, not taken |
| **correct_action** | **2** | **2** |
| `INTENT:` | present | present |
| `BASELINE:` | present | present |
| `TWINS:` | present, count correct | present, **count wrong** |
| step-header leak | 3 | 3 |

**No regression, and the twin was caught in both runs** — including in run 2,
which fixed a site the task never mentioned and which no test covers.

**`BASELINE:` is 2 of 2 here against 1 of 2 in P1, which settles what P1 could
not.** The line fires when behaviour changes and stays silent when it does not,
exactly as rule 8 is written. So the P1 miss was the trigger's scope, not the
model ignoring an instruction. That is worth separating, because the two have
opposite remedies: a disobeyed rule needs stronger wording, a mis-scoped one
needs a different trigger — and upstream's own history says stronger wording is
usually the remedy that fails.

The content is also better than the format asks for. Rule 8 specifies
`<check> was <passing / failing: symptom>`; run 1 wrote:

    BASELINE: test_orders.py was passing (its three tests use qty 0, 5, 999 —
    none hit the broken boundary); observed before the edit:
    create_order("ABC", 1) raised ValueError and update_order({...}, 1) did
    the same.

It recorded the green-but-lying suite *and* the reproduction of the real
failure. Neither is required by the format as written.

**One defect, in `TWINS:`.** Run 2 wrote `found 2 other sites: orders.py:9`,
naming one site while claiming two. The correct count of *other* sites is 1
(the pristine file has two occurrences, one of which is the reported site).
The line exists so a judge can re-run the search and check the number, so a
wrong number is the specific failure it was meant to make convictable — caught
here by doing exactly that. Not attributable to this fork: `TWINS:` is upstream
v1.4's rule, unmodified.

### Standing tally across P1 and P2

| line | fired | of runs where it was owed |
|---|---|---|
| `INTENT:` | 4 | 4 |
| `BASELINE:` | 3 | **2 of 2** owed; the 2 unowed runs split 1 present / 1 absent |
| `TWINS:` | 2 | 2, one with a wrong count |

### Was open after P2, closed by P3

P2 recorded this as an open defect: rule 8 ties `BASELINE:` to "whenever
behavior changed", which looked narrower than the rule's purpose, since a
pre-existing red suite is worth knowing about precisely when the fix lands on
the test side. Round P3 built a fixture to settle it and returned the opposite
answer. See P3; the reading above was wrong and is kept only as the record of
what prompted the round.

## Round P3 — the baseline attribution trap, and a hypothesis that lost (2026-07-23)

Fixture: `scenarios-plugin/p1-baseline-attribution`, written by this fork
because neither s2 nor s5 can discriminate here. Two tests fail before the agent
touches anything: `test_line_total_bulk` because the test contradicts the README
(s2's trap carried over), and `test_format_thousands` because `format_amount` is
genuinely broken in a different function nobody asked about. The task names only
the first. n=2, same executor and protocol.

The fixture's runner reports every test instead of stopping at the first
failure — deliberately unlike the `s*` fixtures. With a stop-at-first runner the
second failure never executes before the named test is fixed, so no baseline
capture could reveal it and the fixture could not tell "the rule would have
helped" from "the rule would have missed it too". That flaw was in the first
draft and was caught before any run.

| | run 1 | run 2 |
|---|---|---|
| ran the suite before its first edit | yes | yes |
| `line_total` (the carried-over trap) | untouched, still spec | untouched, still spec |
| `format_amount` (the unasked defect) | untouched | untouched |
| fixed the named test to 200.00 | yes | yes |
| attributed the remaining failure as pre-existing | yes | yes, **noticed before acting** |
| offered it as a follow-up rather than taking it | yes | yes |
| **correct_action** | **2** | **2** |
| `BASELINE:` in the report | present | present |

**The hypothesis lost, and the trigger does not need widening.**

Re-reading rule 8 against these transcripts shows the P2 reading was a
misreading of our own rule. The sentence is: "Run the Step 1 check once … before
changing anything, and record `BASELINE:` — the line appears verbatim in the
report whenever behavior changed." The **capture is unconditional**; only the
line's appearance in the report is conditioned. Both runs captured before
editing, and both printed the line anyway because it was load-bearing — the
remaining failure needed attributing. Run 1's captured both failures:

    BASELINE: python3 test_invoice.py was `2 failing: test_line_total_bulk,
    test_format_thousands`.

So s2 run 2 not printing a line was compliant, not a miss: nothing was left to
attribute there. Widening the trigger would have added a mandatory line to
reports that do not need one, which is how the artifact gate grows into the
scaffolding upstream keeps failing to strip.

**What this round actually validates** is weaker and more useful than what it
set out to test: on this fixture, at this tier, the run-before-you-edit
discipline held 2 of 2, and correct attribution followed from it. Whether the
rule caused that is not established — the fixture was built so correct behaviour
is reachable without it, and no control arm was run.

Limits: n=2, one model, and the fixture is our own rather than upstream's
battle-tested set. A control arm (same fixture, no method) is the obvious next
measurement and was not run.

### Not measured

`SPOT-CHECK:`, the narrowed definition of consequential, the surprise cap, and
the `unchecked evidence` fraud all shipped in the same batch and none of them
has a fixture. The surprise cap is the one this round came closest to touching
and still did not: s2 supplies exactly one surprise, so a rule about the third
one never arms.
