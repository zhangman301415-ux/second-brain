import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export interface Scenario2Data {
  vaultPath: string;
}

export function createScenario2Data(vaultPath: string): Scenario2Data {
  // 创建 active.md
  const activeContent = `---
type: working
created: ${new Date().toISOString().slice(0, 10)}
---

# Working — 当前活跃关注点

## 活跃项目
- [[第二大脑]] — 知识管理系统，当前在评估 skill 质量
- [[前端重构]] — 将旧项目迁移到 React

## 独立任务
- 评估 context-loader 和 refine-knowledge 的输出质量

## 犹豫中的决策
- 是否引入自动化 eval 管线

## 最近日志
- 完成了 TypeScript 迁移
- 清理了旧的 eval 系统（合成数据方案）
`;
  writeFileSync(join(vaultPath, "04-Working/active.md"), activeContent, "utf-8");

  // 创建 Episodic index
  const episodicContent = `---
type: episodic
created: ${new Date().toISOString().slice(0, 10)}
---

# Episodic Memory — 情景索引

## 情景索引
| 事件 | 关键词 | 教训/价值 | 日期 |
|------|--------|-----------|------|
| [[2025-03-ts-cache-design|TypeScript 缓存系统设计讨论]] | 缓存, write-through, 并发 | 读多写少场景适合 write-through | 2025-03-10 |
| [[2025-04-vault-structure-decision|Vault 结构决策]] | 架构, 五层模型 | Identity 层变更需用户确认 | 2025-04-01 |
`;
  mkdirSync(join(vaultPath, "03-Episodic"), { recursive: true });
  writeFileSync(join(vaultPath, "03-Episodic/index.md"), episodicContent, "utf-8");

  // 创建 Episodic 详情文件
  const episodicDetail = `---
type: episodic
date: 2025-03-10
tags: [缓存, TypeScript, 架构决策]
---

# TypeScript 缓存系统设计讨论

## 背景
讨论如何在知识管理系统中实现文件缓存

## 过程
- 评估了 in-memory、file-based、mixed 三种方案
- 用户偏好简单方案，反对过度设计

## 结论
采用 write-through 缓存模式

## 教训
读多写少的场景，write-through 是最佳平衡点
`;
  writeFileSync(join(vaultPath, "03-Episodic/2025-03-ts-cache-design.md"), episodicDetail, "utf-8");

  // 创建 Procedural index
  const proceduralContent = `---
type: procedural
created: ${new Date().toISOString().slice(0, 10)}
---

# Procedural Memory — 方法论索引

## 方法论索引
| 方法 | 适用场景 | 有效性 | 关联 Episodic | 日期 |
|------|----------|--------|--------------|------|
| [[write-through-cache-pattern|Write-through 缓存模式]] | 读多写少系统 | ✅ 已验证 | [[2025-03-ts-cache-design]] | 2025-03-10 |
`;
  mkdirSync(join(vaultPath, "01-Procedural"), { recursive: true });
  writeFileSync(join(vaultPath, "01-Procedural/index.md"), proceduralContent, "utf-8");

  // 创建 Procedural 详情文件
  const proceduralDetail = `---
type: procedural
date: 2025-03-10
tags: [缓存, 设计模式]
---

# Write-through 缓存模式

## 适用场景
读多写少的系统，需要数据持久化

## 步骤
1. 写入时同时更新内存和持久化存储
2. 读取时优先从内存读取
3. 内存 miss 时从存储加载并回填

## 注意事项
- 写入性能受持久化存储速度限制
- 需要处理写入失败的回滚
`;
  writeFileSync(join(vaultPath, "01-Procedural/write-through-cache-pattern.md"), proceduralDetail, "utf-8");

  // 创建 Semantic index
  const semanticContent = `---
type: semantic
created: auto
---

# Semantic Knowledge — 知识索引

## Areas（我需要负责的事）

| 主题 | 说明 | 最近更新 |
|------|------|----------|
| [[知识管理系统架构]] | 第二大脑的整体架构设计 | 2025-04-01 |

## Resources（我觉得有用的资料）

| 主题 | 说明 | 最近更新 |
|------|------|----------|
| [[TypeScript类型系统笔记]] | TypeScript 类型系统学习记录 | 2025-03-15 |
`;
  mkdirSync(join(vaultPath, "02-Semantic"), { recursive: true });
  writeFileSync(join(vaultPath, "02-Semantic/index.md"), semanticContent, "utf-8");

  // 创建 Identity profile（基础模板）
  mkdirSync(join(vaultPath, "00-Identity"), { recursive: true });
  const profileContent = `---
type: profile
created: auto
version: "1.0"
---

# 核心身份卡

## 自我概念

**我是谁:** 一名从后端转向全栈的软件工程师

**我当前在做什么:** 构建基于 Claude Code Skills 的知识管理系统

**我想成为什么样的人:** 能够独立设计并实现全栈解决方案的工程师

## 活跃关注领域

- [[知识管理]] — 第二大脑系统
- [[全栈开发]] — TypeScript/React 全栈

## 当前角色

| 角色 | 上下文 | 时间跨度 |
|------|--------|----------|
| 独立开发者 | 第二大脑项目 | 2025-01 至今 |

## 关键属性

- **语言偏好:** 中文为主，代码用英文
- **核心驱动力:** 构建有用的工具
`;
  writeFileSync(join(vaultPath, "00-Identity/profile.md"), profileContent, "utf-8");

  return { vaultPath };
}
