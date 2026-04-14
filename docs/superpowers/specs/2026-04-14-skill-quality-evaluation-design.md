---
name: skill-quality-evaluation-design
description: 为 Second Brain 项目的两个 skill 建立 7 维度质量评估体系，每个 skill×dimension 组合生成 200 条测试用例
type: spec
created: 2026-04-14
---

# Skill 质量评估方案

## 目标

为 `context-loader` 和 `refine-knowledge` 两个 skill 建立 7 维度质量评估体系，每个 skill×dimension 组合生成 200 条测试用例，共 2,800 条。

## 评估维度

| # | 维度 | context-loader | refine-knowledge |
|---|------|:---:|:---:|
| 1 | 功能正确性 | ✓ | ✓ |
| 2 | 鲁棒性 | ✓ | ✓ |
| 3 | 指令清晰度 | ✓ | ✓ |
| 4 | 隔离性 | ✓ | ✓ |
| 5 | 幂等性 | ✓ | ✓ |
| 6 | 性能开销 | ✓ | ✓ |
| 7 | 知识完整性 | — | ✓ |

## 测试用例格式

每条测试用例采用统一 JSON 结构：

```json
{
  "id": "CL-FUNC-0001",
  "dimension": "功能正确性",
  "skill": "context-loader",
  "prompt": "新会话开始时，请加载我的 vault 上下文",
  "scenario": "标准场景：vault 已初始化，有完整的 active.md 和索引文件",
  "setup": {
    "vault_structure": {
      "04-Working/active.md": "...",
      "03-Episodic/index.md": "...",
      "01-Procedural/index.md": "..."
    },
    "session_start_hook_payload": {}
  },
  "expected_output": "agent 应读取 active.md 了解当前关注点，然后读取各层索引发现历史",
  "evaluation": {
    "criteria": [
      "读取了 04-Working/active.md",
      "至少读取了 2 个索引文件",
      "报告了加载的上下文摘要"
    ],
    "type": "assertion"
  },
  "tags": ["basic", "core-flow"]
}
```

### 字段说明

| 字段 | 用途 |
|------|------|
| `id` | 唯一标识，格式 `{SKILL_SHORT}-{DIM_SHORT}-{序号}` |
| `dimension` | 评估维度 |
| `skill` | 目标 skill 名称 |
| `prompt` | 模拟用户输入，应贴近真实语气 |
| `scenario` | 场景描述，说明前置条件 |
| `setup` | 测试前置环境（vault 结构、文件内容、hook payload） |
| `expected_output` | 期望结果的描述 |
| `evaluation.criteria` | 可验证的评分标准列表 |
| `evaluation.type` | `assertion`（可自动验证）或 `llm_judge`（需 LLM 评分） |
| `tags` | 分类标签，便于筛选和统计 |

## ID 命名规则

**Skill 简称**：
- `CL` = context-loader
- `RK` = refine-knowledge

**维度简称**：
- `FUNC` = 功能正确性
- `ROBUST` = 鲁棒性
- `CLARITY` = 指令清晰度
- `ISOLATION` = 隔离性
- `IDEMP` = 幂等性
- `PERF` = 性能开销
- `KNOWLEDGE` = 知识完整性

示例：`CL-FUNC-0001`, `RK-KNOWLEDGE-0199`

## 评分机制

每个维度使用 3 级评分：

| 等级 | 含义 |
|------|------|
| PASS (2) | 完全满足期望，无偏差 |
| PARTIAL (1) | 部分满足，有小遗漏但不影响核心功能 |
| FAIL (0) | 未满足期望，有明显错误 |

综合得分 = (2×PASS + 1×PARTIAL) / (2×总数)，归一化到 0-1。

### 知识完整性专项评分

| 指标 | 计算方式 |
|------|----------|
| 遗漏率 | 1 - (捕获的关键信息点数 / 标注的关键信息点总数) |
| 扭曲率 | 含义不一致的条目数 / 提取的条目总数 |
| 幻觉率 | 原始会话中不存在的提取条目数 / 提取的条目总数 |

## 目录结构

```
evals/
├── evals.json                          # 全部测试用例索引
├── context-loader/
│   ├── functionality.jsonl             # 功能正确性 200 条
│   ├── robustness.jsonl                # 鲁棒性 200 条
│   ├── clarity.jsonl                   # 指令清晰度 200 条
│   ├── isolation.jsonl                 # 隔离性 200 条
│   ├── idempotency.jsonl               # 幂等性 200 条
│   └── performance.jsonl               # 性能开销 200 条
├── refine-knowledge/
│   ├── functionality.jsonl             # 功能正确性 200 条
│   ├── robustness.jsonl                # 鲁棒性 200 条
│   ├── clarity.jsonl                   # 指令清晰度 200 条
│   ├── isolation.jsonl                 # 隔离性 200 条
│   ├── idempotency.jsonl               # 幂等性 200 条
│   ├── performance.jsonl               # 性能开销 200 条
│   └── knowledge-integrity.jsonl       # 知识完整性 200 条
└── README.md                           # 评估方案说明
```

## 各维度测试策略

### 1. 功能正确性 (200 条/skill)

验证 skill 是否按 SKILL.md 描述正确执行核心功能。

**覆盖变体**：
- 正常流程（标准输入，完整环境）
- 子功能覆盖（每个 checklist 步骤单独验证）
- 不同 vault 内容组合
- 不同用户指令表达方式
- 边界功能（最小化 vault、最大化内容）

### 2. 鲁棒性 (200 条/skill)

验证 skill 在异常条件下的表现。

**覆盖变体**：
- 文件缺失（各种文件不存在）
- 配置异常（.vault-config.json 格式错误、字段缺失）
- 空 vault
- 损坏的文件内容
- 权限问题
- hook 未挂载
- 并发操作
- 超大输入

### 3. 指令清晰度 (200 条/skill)

验证 SKILL.md 的指令是否能被 agent 正确理解。

**覆盖变体**：
- 模糊用户指令（"帮我加载上下文"、"处理一下"）
- 非常规触发方式（非标准命令格式）
- 指令歧义场景
- 跨 skill 交互
- 多步骤场景（连续执行多个操作）
- 指令优先级冲突

### 4. 隔离性 (200 条/skill)

验证 skill 只做该做的事，不影响无关部分。

**覆盖变体**：
- 无关文件完整性
- settings.json 中非本 skill 的 hook 不受影响
- vault 中非相关目录不受影响
- 临时文件清理
- 环境变量不泄漏

### 5. 幂等性 (200 条/skill)

验证重复执行不产生副作用。

**覆盖变体**：
- 连续执行 2 次
- 连续执行 3 次
- 间断执行（中间有其他操作）
- 执行中被打断后重新执行

### 6. 性能开销 (200 条/skill)

验证 token 消耗和执行时间在合理范围。

**覆盖变体**：
- 不同 vault 大小（10/100/1000 文件）
- 不同会话长度（500/5000/50000 字符）
- 不同索引复杂度
- 缓存命中 vs 未命中
- 并发请求

### 7. 知识完整性 (200 条，仅 refine-knowledge)

验证知识萃取过程中信息不丢失、不扭曲、不幻觉。

**覆盖变体**：
- 关键决策点捕获（技术选型、架构变更）
- 方法论提取（工作流程、最佳实践）
- 经验教训提取（踩坑记录、解决方案）
- 身份信息检测（角色变化、能力变化）
- 知识关联建立（新旧知识链接）
- 信息保真度（原文 vs 提炼文对比）

## 生成策略

由于 2,800 条测试用例规模较大，采用分批生成策略：

1. **第 1 批**：每个维度生成 50 条基础用例（覆盖最常见的场景）
2. **第 2 批**：每个维度生成 100 条扩展用例（覆盖更多变体和边界）
3. **第 3 批**：每个维度生成 50 条边缘用例（极端场景、罕见情况）

每批生成后执行 spec 自审，确保：
- 无重复用例（prompt + setup 组合唯一）
- 覆盖度达标（该维度的所有变体类型都有覆盖）
- 可评分性（每条用例都有明确的评分标准）
