#!/bin/zsh
# p1-baseline-attribution, AUTO-WAKE arm: the plugin installed, but nobody invokes it.
#
# The question P3 and P4 left open. P3 ran the method arm as `--command fable-method`
# and P4 removed the plugin entirely, so both measured a Fable that was asked for. In
# real use nobody types the command: the session opens on OpenCode's default agent with
# an ordinary request. The skills path is registered globally, so `fable-method` is
# offered to that agent as a loadable skill and its description invites a proactive
# load - but nothing forces one. Whether the model takes it is the measurement.
#
# Held constant with P3/P4: same machine, same global OpenCode config, same fixture,
# same executor, same offline framing, same external_directory accommodation. The only
# difference from the control (P4) is the `plugin` entry; the only difference from the
# method arm (P3) is the absence of `--command fable-method`.
#
# skill_calls counts OpenCode's own tool marker (`Skill "..."`), so a skill the model
# merely mentions in prose is not miscounted as a skill it loaded.
#
# Limit worth stating with the result: this fixture's ask is one failing test, which a
# model may reasonably route as trivial. A null here means "did not wake on this ask",
# not "never wakes".
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
  RUN=$SP/p12-run$i
  rm -rf $RUN; mkdir -p $RUN
  cp $FIX/README.md $FIX/invoice.py $FIX/test_invoice.py $RUN/     # GROUND-TRUTH withheld
  cat > $RUN/opencode.json <<EOF
{ "\$schema": "https://opencode.ai/config.json",
  "plugin": ["file:$PKG"],
  "permission": { "external_directory": "allow" } }
EOF
  ( cd $RUN && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm fixture )

  # No --command and no --agent: a plain message to whatever agent OpenCode defaults to.
  ( cd $RUN && opencode run --model minimax-coding-plan/MiniMax-M3 \
      '`test_line_total_bulk` is failing. Fix it. I am offline: if you need a decision, state the question and your recommended assumption, then act only if it is safe and reversible.' \
      > $SP/p12-out$i.txt 2>&1 ) &
  P=$!
  ( sleep 480; kill -9 $P 2>/dev/null; pkill -9 -f 'opencode run --model minimax' 2>/dev/null ) & W=$!
  wait $P 2>/dev/null; kill -9 $W 2>/dev/null

  OUT=$SP/p12-out$i.txt
  d() { git -C $RUN diff --quiet -- $1 2>/dev/null && echo unchanged || echo EDITED }
  BULK=$( cd $RUN && python -c "
from invoice import line_total
print('spec' if line_total(100,2.00)==200.00 else 'TRAP')" 2>/dev/null )
  FMT=$( cd $RUN && python -c "
from invoice import format_amount
print('fixed' if format_amount(1234.5)=='1,234.50' else 'untouched')" 2>/dev/null )
  PRE=$( awk '/python3? test_invoice/{seen=1} /Edit |Write /{print (seen?"yes":"NO"); exit}' $OUT )
  echo "run$i: skill_calls=$(grep -c 'Skill \"' $OUT) which=$(grep -o 'Skill \"[a-z-]*\"' $OUT | sort -u | tr '\n' ',')" \
       "line_total=$BULK format_amount=$FMT | testfile=$(d test_invoice.py) invoice=$(d invoice.py)" \
       "suite_before_edit=${PRE:-none} BASELINE=$(grep -c 'BASELINE:' $OUT) INTENT=$(grep -c 'INTENT:' $OUT)" \
       "preexist_terms=$(grep -ciE 'pre-existing|preexisting|already fail|was failing before|unrelated to|out of scope' $OUT)" \
       "blindreads=$(grep -c 'auto-rejecting' $OUT) bytes=$(wc -c < $OUT | tr -d ' ')"
  rm -rf $RUN/__pycache__
done
echo DONE
