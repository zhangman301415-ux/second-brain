#!/usr/bin/env node
/**
 * second-brain CLI — 主入口
 *
 * 子命令:
 *   init-vault <vault-path>   初始化 Vault 目录结构
 *   mount-hooks               挂载 Stop/SessionStart Hook 到 ~/.claude/settings.json
 *   inject-context            SessionStart Hook: 读取并输出 vault 上下文
 *   queue-session             Stop Hook: 接收 stdin payload 并排队
 */
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const BIN_DIR = dirname(fileURLToPath(import.meta.url));
const DIST_COMMANDS = join(BIN_DIR, "..", "dist", "commands");

const command = process.argv[2];
if (!command) {
  console.log("Usage: second-brain <command> [args]");
  console.log("Commands:");
  console.log("  init-vault <vault-path>  Initialize vault directory structure");
  console.log("  mount-hooks              Mount Stop/SessionStart hooks to ~/.claude/");
  console.log("  inject-context           SessionStart hook: inject vault context");
  console.log("  queue-session            Stop hook: queue session for refinement");
  process.exit(0);
}

const scriptMap = {
  "init-vault": "init-vault.js",
  "mount-hooks": "mount-hooks.js",
  "inject-context": "inject-context.js",
  "queue-session": "queue-session.js",
};

const script = scriptMap[command];
if (!script) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

const result = spawnSync("node", [join(DIST_COMMANDS, script), ...process.argv.slice(3)], {
  stdio: "inherit",
});
process.exit(result.status ?? 0);
