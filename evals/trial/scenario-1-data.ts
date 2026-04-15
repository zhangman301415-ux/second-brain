import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export interface Scenario1Data {
  vaultPath: string;
  sessionDate: string;
  sessionFilePath: string;
}

export function createScenario1Data(vaultPath: string): Scenario1Data {
  const today = new Date().toISOString().slice(0, 10);
  const sessionDir = join(vaultPath, "04-Working", today);
  mkdirSync(sessionDir, { recursive: true });

  const sessionFile = join(sessionDir, "agent-sessions.md");

  // 模拟会话：包含技术问题讨论（Semantic）、方案讨论（Procedural）、角色变化（Identity）
  const content = `---
type: agent-session
date: ${today}
processed: false
---

# Agent Session — ${today}

## 会话摘要

用户在本次会话中主要讨论了以下内容：

### 技术问题讨论

用户询问了如何在 TypeScript 项目中实现基于文件的缓存系统。讨论了使用 JSON 文件作为存储介质、缓存失效策略（TTL + LRU 混合）、以及如何处理并发写入的问题。用户提到他们目前的项目是一个知识管理系统，需要高频读取、低频写入。

### 方案讨论

用户最终决定采用 write-through 缓存模式：写入时同时更新内存和文件，读取时优先从内存读取，miss 时从文件加载并回填。用户认为这个方案在他们的场景下（读多写少）最合适。

### 个人关注变化

用户提到他们最近从纯后端开发转向了全栈方向，正在学习 React 和前端工程化。他们表示对 TypeScript 的类型系统设计特别感兴趣，认为这是提升代码质量的关键。

## 提取的关键信息

- **技术领域**: TypeScript, 缓存系统, 文件存储
- **决策**: 采用 write-through 缓存模式
- **关注领域变化**: 后端 → 全栈转型
- **兴趣点**: TypeScript 类型系统
`;

  writeFileSync(sessionFile, content, "utf-8");

  return {
    vaultPath,
    sessionDate: today,
    sessionFilePath: sessionFile,
  };
}
