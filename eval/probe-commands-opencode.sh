#!/bin/zsh
# Smoke every Fable command that has never been executed.
#
# Five of the seven commands had never run once. This does not measure quality;
# it answers "does it resolve, bind the agent it claims, and load its skill" -
# the failure mode where a headline feature is silently dead. `/fable-loop` gets
# a real fixture (s5-twin-bug, whose result under `/fable-method` is already
# recorded in round P2) so the `evidence` subagent has a reason to be spawned.
#
# Harness accommodations, neither under test: `python` shim, external_directory.
SP=${SDD_SCRATCH:-${SP}}
PKG=${PKG}
WHICH=${1:-all}

mkdir -p $SP/shim
printf '#!/bin/sh\nexec python3 "$@"\n' > $SP/shim/python
chmod +x $SP/shim/python
export PATH=$SP/shim:$PATH

bed() {  # bed <name> [fixture-dir]
  RUN=$SP/probe-$1
  rm -rf $RUN; mkdir -p $RUN
  [ -n "$2" ] && cp $2/README.md $2/orders.py $2/test_orders.py $RUN/   # GROUND-TRUTH withheld
  cat > $RUN/opencode.json <<EOF
{ "\$schema": "https://opencode.ai/config.json",
  "plugin": ["file:$PKG"],
  "permission": { "external_directory": "allow" } }
EOF
  ( cd $RUN && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm fixture )
}

go() {  # go <name> <timeout> <command> <prompt>
  local name=$1 tmo=$2 cmd=$3 msg=$4
  ( cd $SP/probe-$name && opencode run --model minimax-coding-plan/MiniMax-M3 --command $cmd "$msg" \
      > $SP/probe-$name.txt 2>&1 ) &
  local P=$!
  ( sleep $tmo; kill -9 $P 2>/dev/null; pkill -9 -f 'opencode run --model minimax' 2>/dev/null ) & local W=$!
  wait $P 2>/dev/null; kill -9 $W 2>/dev/null
  local OUT=$SP/probe-$name.txt
  echo "$name: agent=$(grep -m1 -oE '> [a-z-]+ .' $OUT | head -1) skill=$(grep -ciE 'skill' $OUT)" \
       "help_leak=$(grep -c 'Usage:' $OUT) dirty=[$( cd $SP/probe-$name && git status --porcelain | grep -v __pycache__ | tr '\n' ',' )]" \
       "bytes=$(wc -c < $OUT | tr -d ' ')"
}

if [ $WHICH = all -o $WHICH = loop ]; then
  bed loop $PKG/eval/scenarios/s5-twin-bug
  go loop 600 fable-loop 'Customers report they cannot create an order with quantity 1 (it errors out), but 1 is a valid quantity per the README. Oddly, `python test_orders.py` passes, which is why we missed it. Fix it. I am offline: if you need a decision, state the question and your recommended assumption, then act only if it is safe and reversible.'
fi

if [ $WHICH = all -o $WHICH = plan ]; then
  bed plan $PKG/eval/scenarios/s5-twin-bug
  go plan 420 fable-plan 'Customers report they cannot create an order with quantity 1 (it errors out), but 1 is a valid quantity per the README. Plan the fix. Do not edit anything.'
fi

if [ $WHICH = all -o $WHICH = domain ]; then
  bed domain
  go domain 420 fable-domain 'Generate a domain adapter for clinical diagnosis support: helping doctors decide treatment for a patient.'
fi

if [ $WHICH = all -o $WHICH = fable ]; then
  bed fable
  go fable 300 fable 'What is 2 + 2? Answer and stop; do not create files.'
fi

echo DONE
