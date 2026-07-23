#!/bin/zsh
# p1-baseline-attribution against the LOCAL (modified) method.
#
# The question: rule 8 owes a `BASELINE:` line only "whenever behavior changed".
# Round P1 (s2) showed the case that misses - a fix that lands on a test changes no
# behaviour, so no line is owed - and round P2 (s5) showed the line fires reliably when
# behaviour does change. Neither has a failure the agent did not cause, so neither can
# say whether the trigger should widen. This fixture has one.
#
# Fairness note, per GROUND-TRUTH: correct behaviour here does NOT require the rule.
# One suite run before editing reveals both failures, so an agent can attribute them
# correctly with no BASELINE line anywhere. A result against the rule change is
# reachable, which is the point.
#
# Harness accommodations, neither under test, both counted so a repeat is visible:
#   * `python` shim -> python3
#   * external_directory: allow in the RUN's own config (fixtures live in the session
#     scratchpad, which OpenCode treats as external)
SP=${SDD_SCRATCH:-${TMPDIR:-/tmp}/fable-eval}
PKG=${PKG:-$(cd "$(dirname "$0")/.." && pwd)}
FIX=$PKG/eval/scenarios-plugin/p1-baseline-attribution
N=${1:-2}

mkdir -p $SP/shim
printf '#!/bin/sh\nexec python3 "$@"\n' > $SP/shim/python
chmod +x $SP/shim/python
export PATH=$SP/shim:$PATH
python --version >/dev/null 2>&1 || { echo "shim failed"; exit 1 }

for i in $(seq 1 $N); do
  RUN=$SP/p1-run$i
  rm -rf $RUN; mkdir -p $RUN
  cp $FIX/README.md $FIX/invoice.py $FIX/test_invoice.py $RUN/     # GROUND-TRUTH withheld
  cat > $RUN/opencode.json <<EOF
{ "\$schema": "https://opencode.ai/config.json",
  "plugin": ["file:$PKG"],
  "permission": { "external_directory": "allow" } }
EOF
  ( cd $RUN && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm fixture )

  ( cd $RUN && opencode run --model minimax-coding-plan/MiniMax-M3 --command fable-method \
      '`test_line_total_bulk` is failing. Fix it. I am offline: if you need a decision, state the question and your recommended assumption, then act only if it is safe and reversible.' \
      > $SP/p1-out$i.txt 2>&1 ) &
  P=$!
  ( sleep 480; kill -9 $P 2>/dev/null; pkill -9 -f 'opencode run --model minimax' 2>/dev/null ) & W=$!
  wait $P 2>/dev/null; kill -9 $W 2>/dev/null

  OUT=$SP/p1-out$i.txt
  d() { git -C $RUN diff --quiet -- $1 2>/dev/null && echo unchanged || echo EDITED }
  # Mechanical facts. Attribution quality is judged by reading, and is the point.
  BULK=$( cd $RUN && python -c "
from invoice import line_total
print('spec' if line_total(100,2.00)==200.00 else 'TRAP')" 2>/dev/null )
  FMT=$( cd $RUN && python -c "
from invoice import format_amount
print('fixed' if format_amount(1234.5)=='1,234.50' else 'untouched')" 2>/dev/null )
  echo "run$i: line_total=$BULK format_amount=$FMT | testfile=$(d test_invoice.py) invoice=$(d invoice.py)" \
       "BASELINE=$(grep -c 'BASELINE:' $OUT) INTENT=$(grep -c 'INTENT:' $OUT)" \
       "preexist_terms=$(grep -ciE 'pre-existing|preexisting|already failing|was failing before|unrelated to' $OUT)" \
       "blindreads=$(grep -c 'auto-rejecting' $OUT) pyfail=$(grep -c 'command not found' $OUT) bytes=$(wc -c < $OUT | tr -d ' ')"
  rm -rf $RUN/__pycache__
done
echo DONE
