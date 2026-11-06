#!/usr/bin/env bash
# Runs the whole corpus and prints the table.
#
# Local and sequential on purpose: the arena's spend guard allows five runs an
# hour, which is fewer than there are policies here.
#
#   ./corpus/run.sh            normal settings
#   PER_FAMILY=3 ./corpus/run.sh   wider, slower, dearer
set -u
cd "$(dirname "$0")/.."

DB="${LACUNA_DB:-$PWD/corpus/corpus.sqlite}"
PER_FAMILY="${PER_FAMILY:-2}"
SAMPLES="${SAMPLES:-2}"
OUT="${OUT:-$PWD/corpus/results.tsv}"

printf 'file\texpected\tcases\tfindings\tintegrity\tfamilies\trun\n' > "$OUT"

for f in corpus/planted/*.txt corpus/careful/*.txt; do
  case "$f" in
    *planted*) want="a gap" ;;
    *)         want="holds" ;;
  esac

  echo ""
  echo "=== $f (expected: $want) ==="

  # Absolute: pnpm --filter runs the script from packages/engine, so a path
  # relative to the repo root does not resolve.
  LACUNA_DB="$DB" pnpm --filter @lacuna/engine lacuna "$PWD/$f" \
    --samples="$SAMPLES" --per-family="$PER_FAMILY" > /tmp/corpus-run.txt 2>&1

  # Read the result out of the run store rather than scraping the report.
  # The store is the thing that actually recorded it.
  python3 - "$f" "$want" "$OUT" "$DB" <<'PYEOF'
import json, sqlite3, sys
path, want, out, db = sys.argv[1:5]

try:
    con = sqlite3.connect(db)
    row = con.execute(
        "SELECT id, score, findings, cases FROM runs ORDER BY rowid DESC LIMIT 1"
    ).fetchone()
except Exception as exc:
    row = None
    print(f"  could not read the store: {exc}")

if row is None:
    print("  no run recorded, the audit did not finish")
    with open(out, "a") as fh:
        fh.write(f"{path}\t{want}\tfailed\t-\t-\t-\n")
else:
    run_id, score, findings, cases = row
    score = json.loads(score)
    findings = json.loads(findings)
    fams = sorted({f["evidence"]["case"]["family"] for f in findings})
    print(
        f"  cases {score['casesRun']}  findings {len(findings)}"
        f"  integrity {score['integrity']}%  families {','.join(fams) or '-'}"
    )
    with open(out, "a") as fh:
        fh.write(
            f"{path}\t{want}\t{score['casesRun']}\t{len(findings)}"
            f"\t{score['integrity']}\t{','.join(fams) or '-'}\t{run_id[:8]}\n"
        )
PYEOF
done

echo ""
echo "=== the table ==="
column -t -s $'\t' "$OUT" | sed 's/^/  /'
echo ""
echo "  written to $OUT"
