# Skill 评估试运行报告

日期: YYYY-MM-DD

## 场景 1: refine-knowledge（知识萃取）

### 测试数据
- 会话文件: `04-Working/YYYY-MM-DD/agent-sessions.md`
- 包含信号: 技术问题（Semantic）、方案讨论（Procedural）、角色变化（Identity）

### 输出质量

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| Episodic 文件创建 | 创建情景记忆文件 | | PASS/FAIL |
| Procedural 提案生成 | 检测到模式并生成提案 | | PASS/FAIL |
| Identity 信号检测 | 检测到角色变化 | | PASS/FAIL |
| 索引更新 | 各层 index.md 已更新 | | PASS/FAIL |

### 发现的问题
-

### 性能数据
- Token 用量: —
- 运行时间: —

---

## 场景 2: context-loader（上下文加载）

### 测试数据
- 预置数据: active.md + 各层索引 + 详情文件

### 输出质量

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| 读取 active.md | 加载当前关注点 | | PASS/FAIL |
| 读取各层索引 | 加载 Episodic/Procedural/Semantic 索引 | | PASS/FAIL |
| 相关性匹配 | 加载相关条目 | | PASS/FAIL |
| Token 预算 | 在 10K-15K 范围内 | | PASS/FAIL |

### 发现的问题
-

### 性能数据
- Token 用量: —
- 运行时间: —

---

## 总结

### 整体评价
-

### 改进建议（按优先级）
1.
2.
3.

### 下一步
- [ ] 是否需要建立正式 eval 基础设施
- [ ] 优先修复哪些问题
