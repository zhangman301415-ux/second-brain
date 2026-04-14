#!/usr/bin/env bats

SCRIPTS_DIR="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)/skills/scripts"

setup() {
  TEST_TMP=$(mktemp -d)
}

teardown() {
  rm -rf "$TEST_TMP"
}

# Helper to run init-vault with default paths
_run_init() {
  TEST_VAULT="$TEST_TMP/vault"
  CONFIG_FILE="${1:-$TEST_TMP/config.json}"
  run bash "$SCRIPTS_DIR/init-vault.sh" "$TEST_VAULT" "$CONFIG_FILE"
}

@test "init-vault: exit 1 with no args" {
  run bash "$SCRIPTS_DIR/init-vault.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *"请提供 vault 路径"* ]]
}

@test "init-vault: exit 1 with relative path" {
  run bash "$SCRIPTS_DIR/init-vault.sh" "relative/path"
  [ "$status" -eq 1 ]
  [[ "$output" == *"必须是绝对路径"* ]]
}

@test "init-vault: creates all directory structure" {
  _run_init
  [ "$status" -eq 0 ]
  [ -d "$TEST_VAULT/00-Identity/capabilities" ]
  [ -d "$TEST_VAULT/00-Identity/narrative" ]
  [ -d "$TEST_VAULT/00-Identity/preferences" ]
  [ -d "$TEST_VAULT/00-Identity/relationships" ]
  [ -d "$TEST_VAULT/00-Identity/values" ]
  [ -d "$TEST_VAULT/01-Procedural" ]
  [ -d "$TEST_VAULT/02-Semantic/Areas" ]
  [ -d "$TEST_VAULT/02-Semantic/Resources" ]
  [ -d "$TEST_VAULT/03-Episodic" ]
  [ -d "$TEST_VAULT/04-Working" ]
  [ -d "$TEST_VAULT/05-Creation" ]
  [ -d "$TEST_VAULT/06-Archive/ingest/queue" ]
  [ -d "$TEST_VAULT/06-Archive/ingest/context" ]
}

@test "init-vault: generates all template files on first run" {
  _run_init
  [ "$status" -eq 0 ]
  [ -f "$TEST_VAULT/00-Identity/profile.md" ]
  [ -f "$TEST_VAULT/00-Identity/values/core-values.md" ]
  [ -f "$TEST_VAULT/00-Identity/capabilities/current-skills.md" ]
  [ -f "$TEST_VAULT/00-Identity/capabilities/growth-trajectory.md" ]
  [ -f "$TEST_VAULT/00-Identity/preferences/work-style.md" ]
  [ -f "$TEST_VAULT/00-Identity/relationships/communities.md" ]
  [ -f "$TEST_VAULT/00-Identity/narrative/turning-points.md" ]
}

@test "init-vault: generates all index files" {
  _run_init
  [ "$status" -eq 0 ]
  [ -f "$TEST_VAULT/03-Episodic/index.md" ]
  [ -f "$TEST_VAULT/01-Procedural/index.md" ]
  [ -f "$TEST_VAULT/02-Semantic/index.md" ]
  [ -f "$TEST_VAULT/04-Working/active.md" ]
}

@test "init-vault: template files contain correct frontmatter" {
  TEST_VAULT="$TEST_TMP/vault"
  bash "$SCRIPTS_DIR/init-vault.sh" "$TEST_VAULT"
  grep -q "^---" "$TEST_VAULT/00-Identity/profile.md"
  grep -q "type: profile" "$TEST_VAULT/00-Identity/profile.md"
  grep -q "^---" "$TEST_VAULT/03-Episodic/index.md"
  grep -q "type: episodic" "$TEST_VAULT/03-Episodic/index.md"
  grep -q "^---" "$TEST_VAULT/01-Procedural/index.md"
  grep -q "type: procedural" "$TEST_VAULT/01-Procedural/index.md"
  grep -q "^---" "$TEST_VAULT/04-Working/active.md"
  grep -q "type: working" "$TEST_VAULT/04-Working/active.md"
}

@test "init-vault: second run does not overwrite existing files (idempotent)" {
  TEST_VAULT="$TEST_TMP/vault"
  CONFIG_FILE="$TEST_TMP/config.json"
  bash "$SCRIPTS_DIR/init-vault.sh" "$TEST_VAULT" "$CONFIG_FILE"
  CONTENT_BEFORE=$(cat "$TEST_VAULT/00-Identity/profile.md")
  run bash "$SCRIPTS_DIR/init-vault.sh" "$TEST_VAULT" "$CONFIG_FILE"
  [ "$status" -eq 0 ]
  CONTENT_AFTER=$(cat "$TEST_VAULT/00-Identity/profile.md")
  [ "$CONTENT_BEFORE" = "$CONTENT_AFTER" ]
}

@test "init-vault: config written to vault-config.json" {
  _run_init
  [ "$status" -eq 0 ]
  VAULT_PATH=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["vaultPath"])' "$CONFIG_FILE")
  [ "$VAULT_PATH" = "$TEST_VAULT" ]
  INITIALIZED=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["initialized"])' "$CONFIG_FILE")
  [ "$INITIALIZED" = "True" ]
}

@test "init-vault: custom config path parameter" {
  TEST_VAULT="$TEST_TMP/vault"
  CUSTOM_CONFIG="$TEST_TMP/custom/path/config.json"
  mkdir -p "$TEST_TMP/custom/path"
  run bash "$SCRIPTS_DIR/init-vault.sh" "$TEST_VAULT" "$CUSTOM_CONFIG"
  [ "$status" -eq 0 ]
  [ -f "$CUSTOM_CONFIG" ]
}

@test "init-vault: exit 2 when mkdir fails" {
  # Create a file where a directory needs to be, so mkdir will fail
  touch "$TEST_TMP/vault"
  run bash "$SCRIPTS_DIR/init-vault.sh" "$TEST_TMP/vault"
  [ "$status" -eq 2 ]
}
