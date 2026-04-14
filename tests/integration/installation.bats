#!/usr/bin/env bats

# 安装过程集成测试
# 覆盖 SKILL.md 中定义的安装流程：检查 .vault-config.json 状态机、完整安装链路

SCRIPTS_DIR="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)/skills/scripts"

setup() {
  TEST_TMP=$(mktemp -d)
  TEST_VAULT="$TEST_TMP/vault"
  TEST_SKILLS="$TEST_TMP/skills"
  export HOME="$TEST_TMP/home"
  CONFIG_FILE="$TEST_SKILLS/.vault-config.json"
  export CONFIG_FILE
  mkdir -p "$HOME/.claude"
  echo '{"hooks": {}}' > "$HOME/.claude/settings.json"
  # 创建临时 skills 结构
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

# --- 模拟 SKILL.md 中的初始化检查逻辑 ---
# 这是 context-loader 和 refine-knowledge 共有的检查：
# 如果 .vault-config.json 不存在或 initialized 不为 true → 需要初始化
_check_initialized() {
  if [ -f "$CONFIG_FILE" ]; then
    python3 -c 'import json, sys; print(json.load(open(sys.argv[1])).get("initialized", False))' "$CONFIG_FILE"
  else
    echo "False"
  fi
}

@test "install: no config means not initialized" {
  # .vault-config.json 不存在时，应返回 False（需要初始化）
  [ "$(_check_initialized)" = "False" ]
}

@test "install: initialized=false triggers initialization" {
  echo '{"initialized": false}' > "$CONFIG_FILE"
  [ "$(_check_initialized)" = "False" ]
}

@test "install: initialized=true skips initialization" {
  echo '{"initialized": true}' > "$CONFIG_FILE"
  [ "$(_check_initialized)" = "True" ]
}

@test "install: initialized key missing means not initialized" {
  # 配置存在但没有 initialized 字段
  echo '{"vaultPath": "/some/path"}' > "$CONFIG_FILE"
  [ "$(_check_initialized)" = "False" ]
}

@test "install: complete install flow from scratch" {
  # 模拟首次安装：从空配置到完整安装
  # 初始状态：未初始化
  [ "$(_check_initialized)" = "False" ]

  # 执行初始化
  bash "$SCRIPTS_DIR/init-vault.sh" "$TEST_VAULT" "$CONFIG_FILE"
  [ "$(_check_initialized)" = "True" ]

  # 执行 hook 挂载
  bash "$SCRIPTS_DIR/mount-hooks.sh" "$TEST_SKILLS"

  # 验证完整安装结果
  # 1. vault 目录结构完整
  [ -d "$TEST_VAULT/00-Identity/capabilities" ]
  [ -d "$TEST_VAULT/06-Archive/ingest/queue" ]
  [ -f "$TEST_VAULT/00-Identity/profile.md" ]
  # 2. hooks 已挂载
  [ -f "$HOME/.claude/hooks/queue-session.sh" ]
  [ -f "$HOME/.claude/hooks/inject-context.sh" ]
  # 3. settings.json 已注册 hooks
  python3 -c '
import json, sys
with open(sys.argv[1]) as f:
    settings = json.load(f)
assert "Stop" in settings.get("hooks", {}), "Stop hook missing"
assert "SessionStart" in settings.get("hooks", {}), "SessionStart hook missing"
' "$HOME/.claude/settings.json"
  # 4. vault-config 状态完整
  VAULT_PATH=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["vaultPath"])' "$CONFIG_FILE")
  [ "$VAULT_PATH" = "$TEST_VAULT" ]
  MOUNTED=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["hooksMounted"])' "$CONFIG_FILE")
  [ "$MOUNTED" = "True" ]
}

@test "install: re-run install does not overwrite existing config" {
  # 先执行完整安装
  bash "$SCRIPTS_DIR/init-vault.sh" "$TEST_VAULT" "$CONFIG_FILE"
  bash "$SCRIPTS_DIR/mount-hooks.sh" "$TEST_SKILLS"
  # 记录配置
  VAULT_PATH_BEFORE=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["vaultPath"])' "$CONFIG_FILE")
  MOUNTED_BEFORE=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["hooksMounted"])' "$CONFIG_FILE")

  # 再次执行安装（模拟用户重复运行）
  bash "$SCRIPTS_DIR/init-vault.sh" "$TEST_VAULT" "$CONFIG_FILE"
  bash "$SCRIPTS_DIR/mount-hooks.sh" "$TEST_SKILLS"

  # 验证配置一致
  VAULT_PATH_AFTER=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["vaultPath"])' "$CONFIG_FILE")
  MOUNTED_AFTER=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["hooksMounted"])' "$CONFIG_FILE")
  [ "$VAULT_PATH_BEFORE" = "$VAULT_PATH_AFTER" ]
  [ "$MOUNTED_BEFORE" = "$MOUNTED_AFTER" ]
}
