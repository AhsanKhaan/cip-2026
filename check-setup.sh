echo "=== Checking CIP-2026 Claude Code Setup ==="
echo ""

check_file() {
  if [ -f "$1" ]; then
    echo "✅  $1"
  else
    echo "❌  $1 — MISSING"
  fi
}

check_file ".claude/CLAUDE.md"
check_file ".claude/AGENTS.md"
check_file ".claude/SKILLS.md"
check_file ".claude/settings.json"
check_file ".claude/context/glossary.md"

echo ""
echo "=== Done. Fix any ❌ items before starting Claude Code ==="