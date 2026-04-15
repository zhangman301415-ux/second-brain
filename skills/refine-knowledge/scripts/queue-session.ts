#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { spawn } from "child_process";
import { join } from "path";

const VAULT = process.env.OBSIDIAN_VAULT_PATH ?? `${process.env.HOME}/Documents/obsidian-workspace/obsidian_workspace`;
const QUEUE_DIR = join(VAULT, "06-Archive/ingest/queue");
const WORKING_DIR = join(VAULT, "04-Working");

let payload = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => (payload += chunk));
process.stdin.on("end", () => {
  if (!payload) process.exit(0);

  let transcriptPath: string;
  let sessionId: string;

  try {
    const data = JSON.parse(payload);
    transcriptPath = data.transcript_path ?? "";
    sessionId = data.session_id ?? "";
  } catch {
    process.exit(0);
  }

  if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0);
  if (!sessionId) sessionId = "unknown";

  mkdirSync(QUEUE_DIR, { recursive: true });
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const backupName = `${date}-${time}-${sessionId}.jsonl`;

  writeFileSync(join(QUEUE_DIR, backupName), readFileSync(transcriptPath));

  const workingDateDir = join(WORKING_DIR, now.toISOString().slice(0, 10));
  mkdirSync(workingDateDir, { recursive: true });
  const sessionName = `refine-${sessionId.slice(0, 8)}`;

  const hasSession = spawn("tmux", ["has-session", "-t", sessionName], { stdio: "ignore" });
  hasSession.on("close", (code) => {
    if (code === 0) process.exit(0);

    const summaryPrompt = `请回顾这次会话，生成以下格式的摘要：
---
date: ${date}
type: agent-session
processed: false
session_id: ${sessionId}
---
## Session: <时间范围>
**任务：** <用户的核心任务>
**做了什么：**
- 按时间顺序列出关键动作。如果涉及多步骤操作，按阶段分组（如：探索阶段→设计阶段→实现阶段），每个动作写清楚用了什么方法/工具，不只写动作名。
**结果：** <结果是什么，以及是否有效/用户是否满意>。如果创建了重要文件/代码，用 [[文件名]] 格式引用。
**决策/犹豫：** <做出了哪些选择？替代选项是什么？为什么选这个？>特别注意：如果用户纠正、否定或要求你改变方向，必须记录——你原来做了什么，用户说了什么，你改成了什么。用户的预期和实际结果有差异吗？
**教训：** <发现了什么不对/什么有效/什么比预期好或差？在什么条件下有效/无效？>
**涉及概念：** <概念名> — <在这个上下文中学到了什么/用它做了什么>；<概念名> — <...>
**用户自我描述：** <用户在 session 中关于自己的角色、能力、偏好、自我认知的表述>
如果用户没有此类表述，留空。
**建议提炼：** <Episodic/Semantic/Procedural/都不需要> — <原因。如果之前出现过类似问题，提及>`;

    const cmd = `claude -p --resume '${sessionId}' --permission-mode auto '${summaryPrompt}' > '${join(workingDateDir, "agent-sessions.md")}' 2>/dev/null; tmux kill-session -t '${sessionName}'`;

    const tmuxProc = spawn("tmux", ["new-session", "-d", "-s", sessionName, cmd]);
    tmuxProc.on("error", () => process.exit(0));
  });
});
