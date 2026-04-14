#!/usr/bin/env bats

SCRIPTS_DIR="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)/skills/scripts"

setup() {
  TEST_TMP=$(mktemp -d)
  TEST_VAULT="$TEST_TMP/vault"
  export HOME="$TEST_TMP/home"
  mkdir -p "$HOME/.claude"
  echo '{"hooks": {}}' > "$HOME/.claude/settings.json"
  TEST_SKILLS="$TEST_TMP/skills"
  mkdir -p "$TEST_SKILLS/refine-knowledge/scripts"
  mkdir -p "$TEST_SKILLS/context-loader/scripts"
  cp "$SCRIPTS_DIR/../refine-knowledge/scripts/queue-session.sh" \
     "$TEST_SKILLS/refine-knowledge/scripts/queue-session.sh"
  cp "$SCRIPTS_DIR/../context-loader/scripts/inject-context.sh" \
     "$TEST_SKILLS/context-loader/scripts/inject-context.sh"
}

teardown() {
  rm -rf "$TEST_TMP"
}

_run_init() {
  run bash "$SCRIPTS_DIR/init-vault.sh" "$TEST_VAULT"
}

_run_mount() {
  run bash "$SCRIPTS_DIR/mount-hooks.sh" "$TEST_SKILLS"
}

@test "integration: full initialization end-to-end" {
  _run_init
  [ "$status" -eq 0 ]
  [ -d "$TEST_VAULT/00-Identity/capabilities" ]
  [ -d "$TEST_VAULT/06-Archive/ingest/queue" ]
  [ -f "$TEST_VAULT/00-Identity/profile.md" ]
  [ -f "$TEST_VAULT/03-Episodic/index.md" ]
  [ -f "$SCRIPTS_DIR/../.vault-config.json" ]
  INITIALIZED=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["initialized"])' "$SCRIPTS_DIR/../.vault-config.json")
  [ "$INITIALIZED" = "True" ]
}

@test "integration: init then mount hooks" {
  _run_init
  _run_mount
  [ "$status" -eq 0 ]
  [ -f "$HOME/.claude/hooks/queue-session.sh" ]
  [ -f "$HOME/.claude/hooks/inject-context.sh" ]
  python3 -c '
import json, sys
with open(sys.argv[1]) as f:
    settings = json.load(f)
assert "Stop" in settings.get("hooks", {}), "Stop hook not registered"
assert "SessionStart" in settings.get("hooks", {}), "SessionStart hook not registered"
' "$HOME/.claude/settings.json"
}
