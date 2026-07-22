#!/bin/zsh
# p1-baseline-attribution, CONTROL arm: the same fixture with the Fable plugin absent.
#
# Round P3 showed 2 of 2 ideal runs with the method, but could not say whether the
# method caused it — the fixture is deliberately passable without the rule. This is the
# missing arm.
#
# The A/B holds everything constant except the plugin: same machine, same global
# OpenCode config (its own agents, instructions and other plugins all still load), same
# fixture, same executor, same offline framing. The only differences are the ones the
# plugin itself is: no `plugin` entry, so no fable agent, no fable-* skills, no
# invariants file, no permission profile — and therefore a plain message to the default
# agent instead of `--command fable-method`.
#
# fable_leak greps for the plugin leaking in, excluding the scratchpad path, which
# contains 'opencode-fable-method' and otherwise reports a false positive on every run.
#
# It is not a bare-model control in upstream's sense. The user's global instructions
# stay loaded in both arms, so what this measures is the plugin's marginal contribution
# on this machine, not the method's contribution against nothing.
SP=${SDD_SCRATCH:-${SP}}
PKG=${PKG}
FIX=$PKG/eval/scenarios-plugin/p1-baseline-attribution
N=${1:-2}

mkdir -p $SP/shim
printf '#!/bin/sh\nexec python3 "$@"\n' > $SP/shim/python
chmod +x $SP/shim/python
export PATH=$SP/shim:$PATH
python --version >/dev/null 2>&1 || { echo "shim failed"; exit 1 }

for i in $(seq 1 $N); do
  RUN=$SP/p1c-run$i
  rm -rf $RUN; mkdir -p $RUN
  cp $FIX/README.md $FIX/invoice.py $FIX/test_invoice.py $RUN/     # GROUND-TRUTH withheld
  # No "plugin" key: this is the whole control condition. external_directory matches the
  # method arm's harness accommodation so the two are comparable.
  cat > $RUN/opencode.json <<EOF
{ "\$schema": "https://opencode.ai/config.json",
  "permission": { "external_directory": "allow" } }
EOF
  ( cd $RUN && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm fixture )

  ( cd $RUN && opencode run --model minimax-coding-plan/MiniMax-M3 \
      '`test_line_total_bulk` is failing. Fix it. I am offline: if you need a decision, state the question and your recommended assumption, then act only if it is safe and reversible.' \
      > $SP/p1c-out$i.txt 2>&1 ) &
  P=$!
  ( sleep 480; kill -9 $P 2>/dev/null; pkill -9 -f 'opencode run --model minimax' 2>/dev/null ) & W=$!
  wait $P 2>/dev/null; kill -9 $W 2>/dev/null

  OUT=$SP/p1c-out$i.txt
  d() { git -C $RUN diff --quiet -- $1 2>/dev/null && echo unchanged || echo EDITED }
  BULK=$( cd $RUN && python -c "
from invoice import line_total
print('spec' if line_total(100,2.00)==200.00 else 'TRAP')" 2>/dev/null )
  FMT=$( cd $RUN && python -c "
from invoice import format_amount
print('fixed' if format_amount(1234.5)=='1,234.50' else 'untouched')" 2>/dev/null )
  # Ran the suite before its first edit? The transcript order is the evidence.
  PRE=$( awk '/python3? test_invoice/{seen=1} /Edit |Write /{print (seen?"yes":"NO"); exit}' $OUT )
  echo "run$i: line_total=$BULK format_amount=$FMT | testfile=$(d test_invoice.py) invoice=$(d invoice.py)" \
       "suite_before_edit=${PRE:-none} preexist_terms=$(grep -ciE 'pre-existing|preexisting|already fail|was failing before|unrelated to|out of scope' $OUT)" \
       "fable_leak=$(grep 'fable' $OUT | grep -vc 'opencode-fable-method/') blindreads=$(grep -c 'auto-rejecting' $OUT) bytes=$(wc -c < $OUT | tr -d ' ')"
  rm -rf $RUN/__pycache__
done
echo DONE
