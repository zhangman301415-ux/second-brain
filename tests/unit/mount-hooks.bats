#!/usr/bin/env bats

SCRIPTS_DIR="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)/skills/scripts"

setup() {
  TEST_TMP=$(mktemp -d)
  export HOME="$TEST_TMP/home"
  mkdir -p "$HOME/.claude"
  echo '{"hooks": {}}' > "$HOME/.claude/settings.json"
  # Create temporary skills directory with real scripts
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

# Helper to run mount-hooks
_run_mount() {
  run bash "$SCRIPTS_DIR/mount-hooks.sh" "$TEST_SKILLS"
}

@test "mount-hooks: exit 1 with no args" {
  run bash "$SCRIPTS_DIR/mount-hooks.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *"请提供"* ]]
}

@test "mount-hooks: copies scripts to hooks directory" {
  _run_mount
  [ "$status" -eq 0 ]
  [ -f "$HOME/.claude/hooks/queue-session.sh" ]
  [ -f "$HOME/.claude/hooks/inject-context.sh" ]
}

@test "mount-hooks: copied scripts are executable" {
  _run_mount
  [ -x "$HOME/.claude/hooks/queue-session.sh" ]
  [ -x "$HOME/.claude/hooks/inject-context.sh" ]
}

@test "mount-hooks: exit 2 when source scripts missing and does not modify settings" {
  rm "$TEST_SKILLS/refine-knowledge/scripts/queue-session.sh"
  MTIME_BEFORE=$(stat -f "%m" "$HOME/.claude/settings.json")
  _run_mount
  [ "$status" -eq 2 ]
  MTIME_AFTER=$(stat -f "%m" "$HOME/.claude/settings.json")
  [ "$MTIME_BEFORE" -eq "$MTIME_AFTER" ]
}

@test "mount-hooks: settings.json registers hooks correctly" {
  _run_mount
  python3 -c '
import json, sys
with open(sys.argv[1]) as f:
    settings = json.load(f)
stop_hooks = settings.get("hooks", {}).get("Stop", [])
start_hooks = settings.get("hooks", {}).get("SessionStart", [])
assert len(stop_hooks) >= 1, "Stop hook not registered"
assert len(start_hooks) >= 1, "SessionStart hook not registered"
stop_cmd = stop_hooks[0]["hooks"][0]["command"]
assert "queue-session.sh" in stop_cmd, f"Stop hook command wrong: {stop_cmd}"
start_cmd = start_hooks[0]["hooks"][0]["command"]
assert "inject-context.sh" in start_cmd, f"SessionStart hook command wrong: {start_cmd}"
' "$HOME/.claude/settings.json"
}

@test "mount-hooks: multiple runs do not duplicate hooks (idempotent)" {
  _run_mount
  _run_mount
  _run_mount
  python3 -c '
import json, sys
with open(sys.argv[1]) as f:
    settings = json.load(f)
stop_hooks = settings.get("hooks", {}).get("Stop", [])
start_hooks = settings.get("hooks", {}).get("SessionStart", [])
for h in stop_hooks:
    cmds = [x["command"] for x in h.get("hooks", [])]
    count = sum(1 for c in cmds if "queue-session" in c)
    assert count <= 1, f"Stop hook duplicated: {cmds}"
for h in start_hooks:
    cmds = [x["command"] for x in h.get("hooks", [])]
    count = sum(1 for c in cmds if "inject-context" in c)
    assert count <= 1, f"SessionStart hook duplicated: {cmds}"
' "$HOME/.claude/settings.json"
}

@test "mount-hooks: vault-config.json hooksMounted flag" {
  echo '{}' > "$TEST_SKILLS/.vault-config.json"
  _run_mount
  MOUNTED=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["hooksMounted"])' "$TEST_SKILLS/.vault-config.json")
  [ "$MOUNTED" = "True" ]
}

@test "mount-hooks: does not overwrite existing hooks" {
  # Pre-register an unrelated hook
  python3 -c '
import json, sys
settings = {"hooks": {"Stop": [{"matcher": ".*", "hooks": [{"type": "command", "command": "bash /some/other/hook.sh"}]}]}}
with open(sys.argv[1], "w") as f:
    json.dump(settings, f, indent=2)
' "$HOME/.claude/settings.json"
  _run_mount
  python3 -c '
import json, sys
with open(sys.argv[1]) as f:
    settings = json.load(f)
stop_hooks = settings.get("hooks", {}).get("Stop", [])
all_cmds = []
for h in stop_hooks:
    for x in h.get("hooks", []):
        all_cmds.append(x["command"])
assert any("other/hook" in c for c in all_cmds), "Existing hook was removed"
assert any("queue-session" in c for c in all_cmds), "New hook was not added"
' "$HOME/.claude/settings.json"
}
