# CLAUDE.md 驱动的评估系统设计

## 背景

当前评估系统由 `runner.ts`（流程编排）+ `grader.ts`（LLM 评分）+ `vault-snapshot.ts`（文件操作）三个 TypeScript 模块组成。Skills 本身通过 Claude Code 会话使用，但评估却走独立的脚本路径，存在以下问题：

- 测试环境与真实使用场景不一致（`claude -p` vs 完整会话）
- 三层脚本架构维护成本高
- 脚本的固定流程缺乏 agent 的灵活判断

## 方案

将评估流程从"脚本编排"改为"CLAUDE.md 驱动 + subagent 执行"：
- 用户在 `evals/` 或项目根目录启动 Claude Code 会话
- Agent 读取 `evals/CLAUDE.md`，自主执行评估全流程
- vault-snapshot.ts 保留为稳定的 CLI 工具，通过 Bash 调用
- runner.ts 和 grader.ts 完全删除

## 架构

### 数据流

```
evals/vaults/<skill>/<scenario>/     evals/CLAUDE.md                          evals/workspace/<skill>/iteration-N/
├── scenario-A/                      ┌───────────────────────┐               ├── eval-scenario-A/
│   ├── eval.json                    │ Claude Code Session    │               │   ├── initial_vault/
│   └── 00-Identity/...              │  ├─ parse eval.json    │               │   ├── final_vault/
├── scenario-B/                      │  ├─ Bash: vault-snap   │──writes───→  │   ├── vault_diff.txt
│   ├── eval.json                    │  ├─ subagent: execute  │               │   ├── grading.json
│   └── 04-Working/...               │  ├─ Bash: vault-snap   │               │   └── timing.json
                                     │  ├─ subagent: grade    │               ├── eval-scenario-B/
                                     │  └─ aggregate results  │               └── benchmark.json
                                     └───────────────────────┘
```

### 各模块职责

| 组件 | 变化 | 职责 |
|------|------|------|
| `evals/CLAUDE.md` | **重写** | 描述评估全流程：发现用例、初始化、执行、评分、聚合 |
| `vault-snapshot.ts` | **增强 CLI** | 增加子命令入口：`init`、`snapshot`、`diff` |
| `runner.ts` | **删除** | 流程编排由 CLAUDE.md + agent 替代 |
| `grader.ts` | **删除** | 评分由 grader subagent 替代 |
| `eval.json` | **不变** | 用例定义格式保持不变 |

## Vault-snapshot CLI

将 `vault-snapshot.ts` 改造为支持子命令的 CLI 工具：

```bash
# 从模板初始化 vault
node dist/evals/runner/vault-snapshot.js init <templateDir> <targetDir>

# 创建快照
node dist/evals/runner/vault-snapshot.js snapshot <sourceDir> <targetDir>

# 输出 diff（JSON 格式，便于 agent 解析）
node dist/evals/runner/vault-snapshot.js diff <beforeDir> <afterDir>
```

CLI 只接受参数、执行文件操作、输出结果，不包含任何流程逻辑。

## 评估流程（CLAUDE.md 描述）

Agent 在会话中按以下步骤执行：

1. **发现用例**：扫描 `evals/vaults/<skill_name>/*/eval.json`
2. **计算迭代号**：读取 `evals/workspace/<skill_name>/` 下最大 iteration-N
3. **对每个用例循环**：
   - 创建 `evals/workspace/<skill_name>/iteration-N/eval-<name>/` 目录
   - Bash 调用 `vault-snapshot init`：从模板初始化工作 vault
   - Bash 调用 `vault-snapshot snapshot`：创建 initial_vault 快照
   - 启动 **executor subagent**：读取 eval.json 中的 prompt 和 skill 指令，在工作 vault 上执行 skill
   - Bash 调用 `vault-snapshot snapshot`：创建 final_vault 快照
   - Bash 调用 `vault-snapshot diff`：获取变更 JSON，格式化为 vault_diff.txt
   - 启动 **grader subagent**：读取 initial_vault、final_vault、diff，逐条评估断言
   - 写入 grading.json、timing.json
4. **聚合**：计算各用例统计指标，与上一轮对比，写入 benchmark.json

## Subagent 设计

### Executor Subagent

- **Prompt**：包含 eval.json 的 prompt、description、expected_output，以及 skill 的 SKILL.md 内容
- **工作目录**：隔离的 vault 工作目录
- **允许的工具**：Read, Write, Bash, Edit, Grep, Glob
- **输出**：agent 结束后，由主 agent 创建 final vault 快照

### Grader Subagent

- **Prompt**：包含断言列表、vault diff 摘要、initial 和 final vault 目录路径
- **允许的工具**：Read, Bash（用于查看文件内容）
- **输出**：按 `GRADING_SCHEMA` 输出 JSON 格式评分结果
- **约束**：只读，不修改任何文件

## 输出格式

保持不变：

- `grading.json`：逐条断言的 passed/evidence
- `timing.json`：`{ total_tokens, duration_ms }`
- `vault_diff.txt`：文件变更可读摘要
- `benchmark.json`：聚合指标 + 与上一轮 delta

## 删除的文件

- `evals/runner/runner.ts`
- `evals/runner/grader.ts`

## 修改的文件

- `evals/CLAUDE.md` — 重写为评估流程描述
- `evals/runner/vault-snapshot.ts` — 增加 CLI 子命令入口
