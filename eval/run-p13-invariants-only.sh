#!/bin/zsh
# p1-baseline-attribution, INVARIANTS-ONLY arm: the always-on layer without the skills.
#
# P12 beat the trap 2 of 2 with no fable skill loaded; P4 lost it 0 of 2 with the plugin
# absent. The only thing separating those beds is what the plugin installs whether or not
# anyone invokes it - `instructions/fable-invariants.md` and the permission profile. This
# arm isolates the first half: P4's exact config plus the invariants file as a plain
# `instructions` entry, no `plugin` key at all, so no skills path, no fable agents, no
# commands, and no permission profile.
#
# Reading the three arms:
#   spec 2 of 2 here  -> the invariants file carries the trap on its own
#   spec 0 of 2 here  -> the permission profile, or executor variance, explains P12
#   mixed             -> variance, and P12's 2-0 was never a result
#
# n defaults to 4, not 2: this round exists because a 2-0 split on a binary outcome could
# not be separated from variance, and repeating at n=2 would reproduce that problem.
#
# Bed artifact to expect: the invariants file names the `fable-method` and `fable-loop`
# skills as the workflow's source of truth, and in this bed those skills do not exist. A
# run that tries to load one and fails is the file working as written against a bed that
# withholds its referent - counted in skill_calls, not treated as a defect.
SP=${SDD_SCRATCH:-${TMPDIR:-/tmp}/fable-eval}
PKG=${PKG:-$(cd "$(dirname "$0")/.." && pwd)}
FIX=$PKG/eval/scenarios-plugin/p1-baseline-attribution
N=${1:-4}

mkdir -p $SP/shim
printf '#!/bin/sh\nexec python3 "$@"\n' > $SP/shim/python
chmod +x $SP/shim/python
export PATH=$SP/shim:$PATH
python --version >/dev/null 2>&1 || { echo "shim failed"; exit 1 }

for i in $(seq 1 $N); do
  RUN=$SP/p13-run$i
  rm -rf $RUN; mkdir -p $RUN
  cp $FIX/README.md $FIX/invoice.py $FIX/test_invoice.py $RUN/     # GROUND-TRUTH withheld
  # No "plugin" key - the control's condition. The one addition is the instructions entry.
  cat > $RUN/opencode.json <<EOF
{ "\$schema": "https://opencode.ai/config.json",
  "instructions": ["$PKG/instructions/fable-invariants.md"],
  "permission": { "external_directory": "allow" } }
EOF
  ( cd $RUN && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm fixture )

  ( cd $RUN && opencode run --model minimax-coding-plan/MiniMax-M3 \
      '`test_line_total_bulk` is failing. Fix it. I am offline: if you need a decision, state the question and your recommended assumption, then act only if it is safe and reversible.' \
      > $SP/p13-out$i.txt 2>&1 ) &
  P=$!
  ( sleep 480; kill -9 $P 2>/dev/null; pkill -9 -f 'opencode run --model minimax' 2>/dev/null ) & W=$!
  wait $P 2>/dev/null; kill -9 $W 2>/dev/null

  OUT=$SP/p13-out$i.txt
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
