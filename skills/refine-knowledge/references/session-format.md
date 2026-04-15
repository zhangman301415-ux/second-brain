# Agent Session 摘要格式

`04-Working/YYYY-MM-DD/agent-sessions.md` 的结构定义。这是知识萃取管线的输入契约。

## 来源

每个 `agent-sessions.md` 由 Stop Hook（`queue-session.sh`）在会话结束时自动生成：备份完整 JSONL 到归档，启动后台 tmux + `claude --resume` 生成摘要写入此文件。

## 文件结构

```markdown
---
date: YYYY-MM-DD
type: agent-session
processed: false
session_id: <claude-code-session-id>
---

## Session: <时间范围>
**任务：** <用户的核心任务>

**做了什么：**
- 按时间顺序列出关键动作。多步骤操作按阶段分组（探索阶段→设计阶段→实现阶段）
- 每个动作写清楚用了什么方法/工具，不只写动作名

**结果：** <结果是什么，以及是否有效/用户是否满意>
- 如创建了重要文件/代码，用 [[文件名]] 格式引用

**决策/犹豫：**
- <做出了哪些选择？替代选项是什么？为什么选这个？>
- 特别注意：如果用户纠正、否定或要求改变方向，必须记录——原来做了什么，用户说了什么，改成了什么
- 用户的预期和实际结果有差异吗？

**教训：**
- <发现了什么不对/什么有效/什么比预期好或差？>
- <在什么条件下有效/无效？>

**涉及概念：**
- <概念名> — <在这个上下文中学到了什么/用它做了什么>
- <概念名> — <...>

**用户自我描述：**
<用户在 session 中关于自己的角色、能力、偏好、自我认知的表述。如果用户没有此类表述，留空。>

**建议提炼：**
<Episodic/Semantic/Procedural/都不需要> — <原因。如果之前出现过类似问题，提及>
```

## 字段说明

| 字段 | 类型 | 用途 |
|------|------|------|
| `date` | frontmatter | 会话日期，用于文件命名和索引 |
| `type` | frontmatter | 固定值 `agent-session`，用于类型识别 |
| `processed` | frontmatter | `false` = 未处理（管线扫描目标），`true` = 已处理（跳过） |
| `session_id` | frontmatter | Claude Code 会话 ID，用于溯源和去重 |
| **任务** | 正文 | Episodic 背景提取来源 |
| **做了什么** | 正文 | Episodic 关键动作来源，Procedural 模式检测来源 |
| **结果** | 正文 | Episodic 结果来源 |
| **决策/犹豫** | 正文 | Procedural 模式检测、Identity 信号检测（角色/偏好变化） |
| **教训** | 正文 | Episodic 教训/价值来源 |
| **涉及概念** | 正文 | Semantic 知识检测来源 |
| **用户自我描述** | 正文 | Identity 信号检测主要来源 |
| **建议提炼** | 正文 | 管线分流参考（Episodic/Semantic/Procedural） |

## 与管线的对应关系

- **Step 1（扫描）**：读取 frontmatter 的 `processed` 标记
- **Step 2（提炼 Episodic）**：从「任务」「做了什么」「结果」「决策/犹豫」「教训」中提取
- **Step 2.5（检测 Identity）**：主要读取「用户自我描述」，补充读取「决策/犹豫」
- **Step 3（检测模式）**：扫描「做了什么」「教训」「涉及概念」中重复出现的做法
- **Step 4（更新索引）**：从文件名和 frontmatter 中提取索引条目元数据
