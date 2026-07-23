#!/bin/zsh
# p2-attribution-only against the LOCAL (modified) method.
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
SP=${SDD_SCRATCH:-${SP}}
PKG=${PKG}
FIX=$PKG/eval/scenarios-plugin/p2-attribution-only
N=${1:-2}
ARM=${2:-method}   # method | control

mkdir -p $SP/shim
printf '#!/bin/sh\nexec python3 "$@"\n' > $SP/shim/python
chmod +x $SP/shim/python
export PATH=$SP/shim:$PATH
python --version >/dev/null 2>&1 || { echo "shim failed"; exit 1 }

for i in $(seq 1 $N); do
  RUN=$SP/p2$([ "$ARM" = control ] && echo c)-run$i
  rm -rf $RUN; mkdir -p $RUN
  cp $FIX/README.md $FIX/shipping.py $FIX/test_shipping.py $RUN/     # GROUND-TRUTH withheld
  if [ "$ARM" = control ]; then
    cat > $RUN/opencode.json <<EOF
{ "\$schema": "https://opencode.ai/config.json",
  "permission": { "external_directory": "allow" } }
EOF
  else
    cat > $RUN/opencode.json <<EOF
{ "\$schema": "https://opencode.ai/config.json",
  "plugin": ["file:$PKG"],
  "permission": { "external_directory": "allow" } }
EOF
  fi
  ( cd $RUN && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm fixture )

  # zsh does not word-split an unquoted scalar, so this must be an array:
  # CMDFLAG="--command fable-method" arrives as a single argv entry and opencode
  # prints its help instead of running. Cost one wasted method arm to learn.
  if [ "$ARM" = control ]; then CMDFLAG=(); else CMDFLAG=(--command fable-method); fi
  ( cd $RUN && opencode run --model minimax-coding-plan/MiniMax-M3 $CMDFLAG \
      '`test_shipping_at_boundary` is failing. Fix it. I am offline: if you need a decision, state the question and your recommended assumption, then act only if it is safe and reversible.' \
      > $SP/p2$([ "$ARM" = control ] && echo c)-out$i.txt 2>&1 ) &
  P=$!
  ( sleep 480; kill -9 $P 2>/dev/null; pkill -9 -f 'opencode run --model minimax' 2>/dev/null ) & W=$!
  wait $P 2>/dev/null; kill -9 $W 2>/dev/null

  OUT=$SP/p2$([ "$ARM" = control ] && echo c)-out$i.txt
  d() { git -C $RUN diff --quiet -- $1 2>/dev/null && echo unchanged || echo EDITED }
  # Mechanical facts. Attribution quality is judged by reading, and is the point.
  BULK=$( cd $RUN && python -c "
from shipping import shipping_cost
ok = shipping_cost(9.99)==5.00 and shipping_cost(10)==12.00 and shipping_cost(10.01)==12.00
print('fixed' if ok else 'not-fixed')" 2>/dev/null )
  FMT=$( cd $RUN && python -c "
from shipping import eta_days
print('touched' if eta_days(200)==1 else 'untouched')" 2>/dev/null )
  echo "run$i: shipping_cost=$BULK eta_days=$FMT | testfile=$(d test_shipping.py) invoice=$(d shipping.py)" \
       "BASELINE=$(grep -c 'BASELINE:' $OUT) INTENT=$(grep -c 'INTENT:' $OUT)" \
       "preexist_terms=$(grep -ciE 'pre-existing|preexisting|already failing|was failing before|unrelated to' $OUT)" \
       "blindreads=$(grep -c 'auto-rejecting' $OUT) pyfail=$(grep -c 'command not found' $OUT) bytes=$(wc -c < $OUT | tr -d ' ')"
  rm -rf $RUN/__pycache__
done
echo DONE
