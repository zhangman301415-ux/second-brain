---
type: procedural-proposal
created: 2026-04-15
source: [[03-Episodic/2026-04-15-TypeScript-缓存策略讨论]]
---

# write-through 缓存模式在数据一致性场景中的应用

## 方法描述

在需要保证数据持久性和一致性的场景中，使用 write-through 缓存模式：先写入缓存层，同步写入持久层，确认成功后再返回。

## 适用场景

- 本地文件系统操作（如 Obsidian 插件）
- 数据库写操作，数据丢失风险不可接受
- 配置文件的读写

## 不适用场景

- 高吞吐量的异步写入（考虑 write-behind）
- 网络延迟显著的场景

## 有效性

⚠️ 待验证

## 来源

提炼自 2026-04-15 关于 TypeScript 缓存策略的讨论。
