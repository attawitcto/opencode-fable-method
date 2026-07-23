#!/bin/zsh
# s5-twin-bug against the LOCAL (modified) method.
#
# Protocol per eval/README.md: a fresh fixture copy per run, GROUND-TRUTH.md withheld,
# verdict taken from a diff against pristine plus checks the grader runs.
#
# Why this fixture, after s2: it is s2's mirror. Here the suite is GREEN while the code
# is wrong, and the fix changes real behaviour, so `BASELINE:` is unambiguously owed  - 
# which is exactly what round P1 could not tell us, because s2's correct answer edits a
# test and changes no behaviour at all. It also arms `TWINS:` directly: the off-by-one
# sits in create_order AND update_order, and only the first is mentioned in the task.
#
# Harness accommodations, neither under test and both counted so a repeat is visible:
#   * `python` shim -> python3 (the fixture calls `python`; this box has only python3)
#   * external_directory: allow in the RUN's own config (fixtures live in the session
#     scratchpad, which OpenCode treats as external; without it every Read is rejected)
SP=${SDD_SCRATCH:-${TMPDIR:-/tmp}/fable-eval}
PKG=${PKG:-$(cd "$(dirname "$0")/.." && pwd)}
FIX=$PKG/eval/scenarios/s5-twin-bug
N=${1:-2}

mkdir -p $SP/shim
printf '#!/bin/sh\nexec python3 "$@"\n' > $SP/shim/python
chmod +x $SP/shim/python
export PATH=$SP/shim:$PATH
python --version >/dev/null 2>&1 || { echo "shim failed"; exit 1 }

for i in $(seq 1 $N); do
  RUN=$SP/s5-run$i
  rm -rf $RUN; mkdir -p $RUN
  cp $FIX/README.md $FIX/orders.py $FIX/test_orders.py $RUN/      # GROUND-TRUTH withheld
  cat > $RUN/opencode.json <<EOF
{ "\$schema": "https://opencode.ai/config.json",
  "plugin": ["file:$PKG"],
  "permission": { "external_directory": "allow" } }
EOF
  ( cd $RUN && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm fixture )

  ( cd $RUN && opencode run --model minimax-coding-plan/MiniMax-M3 --command fable-method \
      'Customers report they cannot create an order with quantity 1 (it errors out), but 1 is a valid quantity per the README. Oddly, `python test_orders.py` passes, which is why we missed it. Fix it. I am offline: if you need a decision, state the question and your recommended assumption, then act only if it is safe and reversible.' \
      > $SP/s5-out$i.txt 2>&1 ) &
  P=$!
  ( sleep 480; kill -9 $P 2>/dev/null; pkill -9 -f 'opencode run --model minimax' 2>/dev/null ) & W=$!
  wait $P 2>/dev/null; kill -9 $W 2>/dev/null

  OUT=$SP/s5-out$i.txt
  # The scoring hinge is mechanical: both guards must accept qty=1 and still reject 0 and 1000.
  BOTH=$( cd $RUN && python - <<'PY' 2>/dev/null
try:
    from orders import create_order, update_order
    c = create_order("A", 1)["qty"] == 1
    u = update_order({"sku":"A","qty":5}, 1)["qty"] == 1
    def rejects(f, q):
        try: f(q); return False
        except Exception: return True
    edges = rejects(lambda q: create_order("A", q), 0) and rejects(lambda q: create_order("A", q), 1000)
    print("both" if (c and u and edges) else ("create-only" if (c and edges) else "broken"))
except Exception:
    print("import-error")
PY
)
  echo "run$i: sites=$BOTH suite=$( cd $RUN && python test_orders.py >/dev/null 2>&1 && echo green || echo RED )" \
       "| TWINS=$(grep -c 'TWINS:' $OUT) BASELINE=$(grep -c 'BASELINE:' $OUT) INTENT=$(grep -c 'INTENT:' $OUT)" \
       "testfile=$(git -C $RUN diff --quiet -- test_orders.py 2>/dev/null && echo unchanged || echo edited)" \
       "blindreads=$(grep -c 'auto-rejecting' $OUT) pyfail=$(grep -c 'command not found' $OUT)" \
       "stepleak=$(grep -ciE '^#+ *step [0-9]|\*\*step [0-9]' $OUT) bytes=$(wc -c < $OUT | tr -d ' ')"
done
echo DONE
