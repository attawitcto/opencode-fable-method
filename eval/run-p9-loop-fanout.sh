#!/bin/zsh
# /fable-loop on s13-twin-fleet: does the `evidence` subagent ever actually run?
#
# `evidence` is one of the three agents this plugin installs and it has never
# been executed once. The earlier probe used s5, one small file, where the
# loop's own Stage 1 gate correctly declines to fan out - so that run could not
# tell "the subagent is unreachable" from "the gate said no". s13 is 24 files
# across 21 modules with a shared helper, which is the widest surface in the
# suite, so the gate can actually arm.
#
# Two things are measured and they are independent:
#   fanout   did a child session with agent=evidence get created at all
#   score    the fixture's own rubric (all five truncation sites, four correct
#            modules untouched), graded by executing every module
SP=${SDD_SCRATCH:-${TMPDIR:-/tmp}/fable-eval}
PKG=${PKG:-$(cd "$(dirname "$0")/.." && pwd)}
FIX=$PKG/eval/scenarios/s13-twin-fleet
N=${1:-2}

mkdir -p $SP/shim
printf '#!/bin/sh\nexec python3 "$@"\n' > $SP/shim/python
chmod +x $SP/shim/python
export PATH=$SP/shim:$PATH

for i in $(seq 1 $N); do
  RUN=$SP/p9-run$i
  rm -rf $RUN; mkdir -p $RUN
  cp $FIX/README.md $RUN/                       # GROUND-TRUTH withheld
  cp -R $FIX/exports $RUN/exports
  cat > $RUN/opencode.json <<EOF
{ "\$schema": "https://opencode.ai/config.json",
  "plugin": ["file:$PKG"],
  "permission": { "external_directory": "allow" } }
EOF
  ( cd $RUN && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm fixture )

  ( cd $RUN && opencode run --model minimax-coding-plan/MiniMax-M3 --command fable-loop \
      'The finance team reports our invoice export is off by a cent on some amounts: an invoice for 19.99 comes out as 1998 cents. Running `python -m exports.tests.test_invoices` from this directory fails. Fix it. I am offline: if you need a decision, state the question and your recommended assumption, then act only if it is safe and reversible.' \
      > $SP/p9-out$i.txt 2>&1 ) &
  P=$!
  ( sleep 900; kill -9 $P 2>/dev/null; pkill -9 -f 'opencode run --model minimax' 2>/dev/null ) & W=$!
  wait $P 2>/dev/null; kill -9 $W 2>/dev/null

  OUT=$SP/p9-out$i.txt
  # Functional grade: every money module converts 19.99, and 1999 is correct.
  RES=$( cd $RUN && python - <<'PYEOF' 2>&1
import importlib
infected = ["invoices","refunds","payouts","receipts","statements"]
correct  = ["orders","subscriptions","credits","fees"]
def cents(mod):
    m = importlib.import_module("exports."+mod)
    row = m.export_rows([{"id":"x","customer":"c","total":19.99,"amount":19.99,
                          "price":19.99,"tip":19.99,"balance":19.99,"fee":19.99}])[1]
    return "1999" in row
bad = [m for m in infected if not cents(m)]
broke = [m for m in correct if not cents(m)]
print("fixed=%d/5 still_truncating=%s regressed_correct_modules=%s" % (5-len(bad), bad or "none", broke or "none"))
PYEOF
)
  CHANGED=$( cd $RUN && git status --porcelain | grep -v __pycache__ | awk '{print $2}' | tr '\n' ' ' )
  echo "run$i: $RES"
  echo "      changed=[$CHANGED]"
  echo "      TWINS=$(grep -c 'TWINS:' $OUT) SPOTCHECK=$(grep -c 'SPOT-CHECK:' $OUT) bytes=$(wc -c < $OUT | tr -d ' ')"
  find $RUN -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null
done
echo DONE
