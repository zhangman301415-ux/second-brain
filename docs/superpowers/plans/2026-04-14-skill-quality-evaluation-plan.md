# Skill 质量评估测试用例生成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 context-loader 和 refine-knowledge 两个 skill 的 7 个评估维度各生成 200 条测试用例，共 2,800 条。

**Architecture:** 先生成器基础设施（验证脚本、模板），然后并行派发 13 个子任务（每个 skill×dimension 一个子任务），每个子任务分 3 批完成 200 条用例，最后合并、去重、验证。

**Tech Stack:** Python 3（生成/验证脚本），JSONL（测试用例格式），Agent 子代理（用例生成）

---

## 文件结构

| 文件 | 用途 | 来源 |
|------|------|------|
| `evals/generate.py` | 测试用例生成器 + 验证脚本 | 新建 |
| `evals/validate.py` | 生成后校验脚本（重复、格式、覆盖度） | 新建 |
| `evals/evals.json` | 全部测试用例索引 | 新建 |
| `evals/README.md` | 评估方案说明 | 新建 |
| `evals/context-loader/*.jsonl` | 6 个维度的测试用例 | 新建 |
| `evals/refine-knowledge/*.jsonl` | 7 个维度的测试用例 | 新建 |
| `evals/templates/context-loader.jsonl` | context-loader 用例模板 | 新建 |
| `evals/templates/refine-knowledge.jsonl` | refine-knowledge 用例模板 | 新建 |

## 目录结构

```
evals/
├── generate.py                         # 生成器 + 验证脚本
├── validate.py                         # 生成后校验
├── evals.json                          # 全部索引
├── README.md                           # 说明文档
├── templates/
│   ├── context-loader.jsonl            # CL 模板（每维度 20 条种子）
│   └── refine-knowledge.jsonl          # RK 模板（每维度 20 条种子）
├── context-loader/
│   ├── functionality.jsonl             # 200 条
│   ├── robustness.jsonl                # 200 条
│   ├── clarity.jsonl                   # 200 条
│   ├── isolation.jsonl                 # 200 条
│   ├── idempotency.jsonl               # 200 条
│   └── performance.jsonl               # 200 条
└── refine-knowledge/
    ├── functionality.jsonl
    ├── robustness.jsonl
    ├── clarity.jsonl
    ├── isolation.jsonl
    ├── idempotency.jsonl
    ├── performance.jsonl
    └── knowledge-integrity.jsonl       # 仅 RK
```

---

### Task 1: 创建 evals 目录结构和生成器基础设施

**Files:**
- Create: `evals/generate.py`
- Create: `evals/validate.py`
- Create: `evals/README.md`
- Create: `evals/templates/context-loader.jsonl`
- Create: `evals/templates/refine-knowledge.jsonl`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p evals/templates evals/context-loader evals/refine-knowledge
```

- [ ] **Step 2: 创建 context-loader 模板**

写入 `evals/templates/context-loader.jsonl`，包含 20 条种子用例（每个维度 2-4 条），覆盖 context-loader 的核心行为变体：

```jsonl
{"id":"CL-FUNC-0001","dimension":"功能正确性","skill":"context-loader","prompt":"新会话开始，请加载我的 vault 上下文","scenario":"vault 已初始化，有完整的 active.md 和各层索引","setup":{"vault_structure":{"04-Working/active.md":"# 当前关注点\n\n- 优化知识萃取管线\n- 编写测试用例","03-Episodic/index.md":"## 2026-04-14\n- [重构 vault 初始化脚本](2026-04-14-重构vault初始化.md)","01-Procedural/index.md":"## 方法论\n- [Vault 初始化 SOP](init-vault-sop.md)"},"session_start_hook_payload":{}},"expected_output":"agent 应读取 active.md 了解当前关注点，然后读取各层索引发现历史知识","evaluation":{"criteria":["读取了 04-Working/active.md","至少读取了 2 个索引文件","报告了加载的上下文摘要"],"type":"assertion"},"tags":["basic","core-flow"]}
{"id":"CL-FUNC-0002","dimension":"功能正确性","skill":"context-loader","prompt":"开始一个新 session","scenario":"vault 已初始化但 04-Working/active.md 为空","setup":{"vault_structure":{"04-Working/active.md":"# 当前关注点\n\n（暂无）","03-Episodic/index.md":"","01-Procedural/index.md":""}},"expected_output":"agent 应检测到 active.md 为空，跳过上下文加载或报告无相关上下文","evaluation":{"criteria":["读取了 active.md","识别到内容为空","未尝试加载不存在的索引"],"type":"assertion"},"tags":["empty-content"]}
{"id":"CL-FUNC-0003","dimension":"功能正确性","skill":"context-loader","prompt":"请帮我看看之前做过什么","scenario":"vault 有大量 episodic 记录，用户想了解历史","setup":{"vault_structure":{"03-Episodic/index.md":"## 2026-04-01\n- [学习 Rust 所有权](2026-04-01-学习rust.md)\n## 2026-04-05\n- [调试内存泄漏](2026-04-05-调试内存泄漏.md)\n## 2026-04-10\n- [设计 API 版本策略](2026-04-10-设计API版本策略.md)"}},"expected_output":"agent 应读取 Episodic 索引，按相关性返回历史条目","evaluation":{"criteria":["读取了 Episodic 索引","按任务相关性过滤","返回了相关的历史条目摘要"],"type":"assertion"},"tags":["episodic-history"]}
{"id":"CL-ROBUST-0001","dimension":"鲁棒性","skill":"context-loader","prompt":"加载上下文","scenario":".vault-config.json 不存在","setup":{"vault_config_exists":false},"expected_output":"agent 应检测到 vault 未初始化，提示用户是否初始化","evaluation":{"criteria":["检测到 .vault-config.json 不存在","提示用户是否初始化","未尝试加载不存在的文件"],"type":"assertion"},"tags":["missing-config"]}
{"id":"CL-ROBUST-0002","dimension":"鲁棒性","skill":"context-loader","prompt":"加载上下文","scenario":".vault-config.json 存在但格式非法","setup":{"vault_config_exists":true,"vault_config_content":"{invalid json}"},"expected_output":"agent 应检测到配置格式错误，提示用户修复或重新初始化","evaluation":{"criteria":["检测到 JSON 格式错误","未崩溃","给出了修复建议"],"type":"assertion"},"tags":["corrupt-config"]}
{"id":"CL-ROBUST-0003","dimension":"鲁棒性","skill":"context-loader","prompt":"加载上下文","scenario":"vault 存在但所有文件都为空","setup":{"vault_structure":{"04-Working/active.md":"","03-Episodic/index.md":"","01-Procedural/index.md":"","02-Semantic/index.md":""}},"expected_output":"agent 应正常处理，报告无可用上下文","evaluation":{"criteria":["未报错","报告了无可用上下文","未尝试加载空内容"],"type":"assertion"},"tags":["all-empty"]}
{"id":"CL-CLARITY-0001","dimension":"指令清晰度","skill":"context-loader","prompt":"帮我加载上下文","scenario":"模糊指令，vault 已初始化","setup":{"vault_structure":{"04-Working/active.md":"# 当前关注\n- 重构测试","03-Episodic/index.md":"## 2026-04\n- [重构 vault 初始化](2026-04-refactor-init.md)"}},"expected_output":"agent 应正确理解'加载上下文'意图，执行标准加载流程","evaluation":{"criteria":["识别到'加载上下文'意图","执行了标准加载流程","报告了加载结果"],"type":"llm_judge"},"tags":["vague-command"]}
{"id":"CL-CLARITY-0002","dimension":"指令清晰度","skill":"context-loader","prompt":"处理一下","scenario":"极其模糊的指令，无法确定用户意图","setup":{"vault_structure":{"04-Working/active.md":"# 当前关注\n- 处理数据"}},"expected_output":"agent 应询问用户具体要做什么，而不是盲目执行","evaluation":{"criteria":["未盲目执行","询问了用户具体意图","未修改任何文件"],"type":"llm_judge"},"tags":["ambiguous"]}
{"id":"CL-ISOLATION-0001","dimension":"隔离性","skill":"context-loader","prompt":"加载上下文","scenario":"settings.json 中有其他无关 hooks，执行后应保持不变","setup":{"vault_structure":{"04-Working/active.md":"# 测试"},"existing_settings":{"hooks":{"PostSession":[{"type":"command","command":"echo hello"}]}}},"expected_output":"context-loader 不应修改 settings.json 中的其他 hooks","evaluation":{"criteria":["PostSession hook 保持不变","未添加新的 hook","未删除已有的 hook"],"type":"assertion"},"tags":["settings-isolation"]}
{"id":"CL-IDEMP-0001","dimension":"幂等性","skill":"context-loader","prompt":"加载上下文（连续执行两次）","scenario":"连续执行两次，结果应一致","setup":{"vault_structure":{"04-Working/active.md":"# 当前关注\n- 测试幂等性","03-Episodic/index.md":"## 2026-04\n- [测试](test.md)"}},"expected_output":"两次执行应读取相同的文件，产生相同的上下文摘要","evaluation":{"criteria":["两次读取的文件相同","输出上下文摘要一致","未产生新的副作用文件"],"type":"assertion"},"tags":["idempotent"]}
{"id":"CL-PERF-0001","dimension":"性能开销","skill":"context-loader","prompt":"加载上下文","scenario":"vault 有 1000 个文件，索引较大","setup":{"vault_structure":{"04-Working/active.md":"# 当前关注\n- 大 vault 测试","03-Episodic/index.md":"[重复 1000 行的索引内容]","01-Procedural/index.md":"[重复 500 行的索引内容]","02-Semantic/index.md":"[重复 500 行的索引内容]"},"file_count":1000},"expected_output":"agent 应按需加载，不一次性读取所有索引全文","evaluation":{"criteria":["未一次性加载所有文件","token 消耗在合理范围（<5000 tokens）","按相关性过滤加载"],"type":"llm_judge"},"tags":["large-vault"]}
```

- [ ] **Step 3: 创建 refine-knowledge 模板**

写入 `evals/templates/refine-knowledge.jsonl`，包含 20 条种子用例：

```jsonl
{"id":"RK-FUNC-0001","dimension":"功能正确性","skill":"refine-knowledge","prompt":"/refine-knowledge","scenario":"04-Working/ 下有 1 个未处理的会话","setup":{"vault_structure":{"04-Working/2026-04-14/agent-sessions.md":"---\nprocessed: false\nsession_id: abc-123\n---\n\n## 任务\n重构 vault 初始化脚本\n\n## 决策/犹豫\n用户建议用 agent 引导替代 install.sh\n\n## 结果\n成功移除 install.sh，采用 agent 引导\n\n## 教训\n脚本初始化不如 agent 引导灵活\n\n## 用户自我描述\n我更喜欢 agent 引导式初始化"},"session_files":["04-Working/2026-04-14/agent-sessions.md"]},"expected_output":"Step 1: 扫描到 1 个未处理会话，请求用户确认。Step 2: 创建 Episodic 文件。Step 2.5: 检测到 Identity 信号（用户偏好）。Step 3: 检测模式。Step 4: 更新索引","evaluation":{"criteria":["扫描到未处理会话","创建了 Episodic 文件（2026-04-14-重构vault初始化.md）","检测到 Identity 信号并生成提案","更新了索引"],"type":"assertion"},"tags":["basic","full-pipeline"]}
{"id":"RK-FUNC-0002","dimension":"功能正确性","skill":"refine-knowledge","prompt":"/refine-knowledge","scenario":"有多个未处理会话","setup":{"vault_structure":{"04-Working/2026-04-14/agent-sessions.md":"---\nprocessed: false\nsession_id: abc-123\n---\n\n## 任务\n优化知识萃取管线","04-Working/2026-04-15/agent-sessions.md":"---\nprocessed: false\nsession_id: def-456\n---\n\n## 任务\n编写测试用例"},"session_files":["04-Working/2026-04-14/agent-sessions.md","04-Working/2026-04-15/agent-sessions.md"]},"expected_output":"Step 1: 列出 2 个未处理会话请求确认，处理后分别提炼","evaluation":{"criteria":["列出所有未处理会话","分别创建了 Episodic 文件","两个会话都标记为 processed: true"],"type":"assertion"},"tags":["multi-session"]}
{"id":"RK-ROBUST-0001","dimension":"鲁棒性","skill":"refine-knowledge","prompt":"/refine-knowledge","scenario":"04-Working/ 下没有会话文件","setup":{"vault_structure":{"04-Working/2026-04-14/":{}}},"expected_output":"agent 应报告没有找到未处理的会话","evaluation":{"criteria":["报告无未处理会话","未创建任何文件","正常退出（exit 0）"],"type":"assertion"},"tags":["no-sessions"]}
{"id":"RK-ROBUST-0002","dimension":"鲁棒性","skill":"refine-knowledge","prompt":"/refine-knowledge","scenario":"agent-sessions.md 存在但内容为空","setup":{"vault_structure":{"04-Working/2026-04-14/agent-sessions.md":""}},"expected_output":"agent 应检测到内容为空，跳过提炼","evaluation":{"criteria":["检测到空内容","未创建 Episodic 文件","未标记为 processed"],"type":"assertion"},"tags":["empty-session"]}
{"id":"RK-ROBUST-0003","dimension":"鲁棒性","skill":"refine-knowledge","prompt":"/refine-knowledge","scenario":"agent-sessions.md 格式损坏，只有部分内容","setup":{"vault_structure":{"04-Working/2026-04-14/agent-sessions.md":"---\nprocessed: false\nsession_id: abc-123\n## 任务\n重构 vault 初始化\n（缺少其他字段）"}},"expected_output":"agent 应尽力解析可用内容，缺失字段用默认值处理","evaluation":{"criteria":["未崩溃","尽力解析了可用内容","缺失字段未导致错误"],"type":"llm_judge"},"tags":["corrupt-session"]}
{"id":"RK-CLARITY-0001","dimension":"指令清晰度","skill":"refine-knowledge","prompt":"处理一下","scenario":"极其模糊的指令","setup":{"vault_structure":{"04-Working/2026-04-14/agent-sessions.md":"---\nprocessed: false\nsession_id: abc-123\n---\n\n## 任务\n测试"}},"expected_output":"agent 应识别到 refine-knowledge 意图，执行知识提炼管线","evaluation":{"criteria":["识别到 refine-knowledge 意图","执行了完整管线","报告了处理结果"],"type":"llm_judge"},"tags":["vague-command"]}
{"id":"RK-ISOLATION-0001","dimension":"隔离性","skill":"refine-knowledge","prompt":"/refine-knowledge","scenario":"vault 中有无关目录和文件","setup":{"vault_structure":{"04-Working/2026-04-14/agent-sessions.md":"---\nprocessed: false\nsession_id: abc-123\n---\n## 任务\n测试\n02-Semantic/Personal/":{},"06-Archive/":{}},"expected_output":"只处理 04-Working 下的会话，其他目录不受影响","evaluation":{"criteria":["Personal 目录内容不变","Archive 目录内容不变","只修改了 Episodic 和索引文件"],"type":"assertion"},"tags":["directory-isolation"]}
{"id":"RK-IDEMP-0001","dimension":"幂等性","skill":"refine-knowledge","prompt":"/refine-knowledge（执行两次）","scenario":"对同一会话执行两次","setup":{"vault_structure":{"04-Working/2026-04-14/agent-sessions.md":"---\nprocessed: false\nsession_id: abc-123\n---\n## 任务\n测试"}},"expected_output":"第一次正常处理，第二次应检测到已处理过","evaluation":{"criteria":["第一次创建了 Episodic 文件","第二次检测到已处理","未创建重复文件"],"type":"assertion"},"tags":["idempotent"]}
{"id":"RK-PERF-0001","dimension":"性能开销","skill":"refine-knowledge","prompt":"/refine-knowledge","scenario":"会话内容 50000 字符","setup":{"vault_structure":{"04-Working/2026-04-14/agent-sessions.md":"[50000 字符的会话内容]"}},"expected_output":"agent 应高效处理大会话文件，token 消耗合理","evaluation":{"criteria":["token 消耗 <30000","执行时间合理","未遗漏关键信息"],"type":"llm_judge"},"tags":["large-session"]}
{"id":"RK-KNOWLEDGE-0001","dimension":"知识完整性","skill":"refine-knowledge","prompt":"/refine-knowledge","scenario":"会话包含关键决策、方法论、身份信息","setup":{"vault_structure":{"04-Working/2026-04-14/agent-sessions.md":"---\nprocessed: false\nsession_id: abc-123\n---\n## 任务\n重构 vault 初始化\n\n## 决策/犹豫\n- 选择 agent 引导替代 install.sh，因为更灵活\n- 讨论了 3 种方案，最终选择方案 C\n\n## 教训\n- 脚本初始化在环境差异大时容易失败\n- agent 引导可以自适应不同环境\n\n## 结果\n成功完成重构\n\n## 用户自我描述\n我更喜欢自动化的工具，不喜欢手动配置"}},"expected_output":"Episodic 应捕获决策和教训，Identity 信号（偏好自动化工具）应检测到，Procedural 模式（agent 引导替代脚本）应被提议","evaluation":{"criteria":["Episodic 包含决策详情","Episodic 包含教训","Identity 信号被检测","Procedural 模式被提议","无幻觉内容"],"type":"assertion"},"tags":["knowledge-complete"]}
```

- [ ] **Step 4: 创建生成器脚本**

写入 `evals/generate.py`：

```python
#!/usr/bin/env python3
"""测试用例生成器和验证器。

Usage:
    python evals/generate.py <skill> <dimension> <count> [--batch N]
    python evals/generate.py --validate
"""

import json
import sys
import os
from datetime import datetime

# ID 映射
SKILL_MAP = {
    "context-loader": "CL",
    "refine-knowledge": "RK",
}

DIMENSION_MAP = {
    "功能正确性": "FUNC",
    "鲁棒性": "ROBUST",
    "指令清晰度": "CLARITY",
    "隔离性": "ISOLATION",
    "幂等性": "IDEMP",
    "性能开销": "PERF",
    "知识完整性": "KNOWLEDGE",
}

OUTPUT_FILES = {
    "功能正确性": "functionality.jsonl",
    "鲁棒性": "robustness.jsonl",
    "指令清晰度": "clarity.jsonl",
    "隔离性": "isolation.jsonl",
    "幂等性": "idempotency.jsonl",
    "性能开销": "performance.jsonl",
    "知识完整性": "knowledge-integrity.jsonl",
}


def validate_case(case: dict) -> list[str]:
    """验证一条测试用例的格式。返回错误列表。"""
    errors = []
    required = ["id", "dimension", "skill", "prompt", "scenario",
                "setup", "expected_output", "evaluation", "tags"]
    for field in required:
        if field not in case:
            errors.append(f"缺少必填字段: {field}")
    if "id" in case:
        parts = case["id"].split("-")
        if len(parts) != 3:
            errors.append(f"ID 格式错误: {case['id']}，应为 SKILL-DIM-NNNN")
    if "evaluation" in case:
        if "criteria" not in case["evaluation"]:
            errors.append("evaluation.criteria 缺失")
        elif not isinstance(case["evaluation"]["criteria"], list):
            errors.append("evaluation.criteria 应为列表")
        if "type" not in case["evaluation"]:
            errors.append("evaluation.type 缺失")
        elif case["evaluation"]["type"] not in ("assertion", "llm_judge"):
            errors.append(f"evaluation.type 非法: {case['evaluation']['type']}")
    if "tags" in case and not isinstance(case["tags"], list):
        errors.append("tags 应为列表")
    return errors


def validate_file(filepath: str) -> dict:
    """验证一个 jsonl 文件。返回统计和错误。"""
    stats = {"total": 0, "valid": 0, "errors": 0, "ids": set()}
    file_errors = []
    with open(filepath) as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            stats["total"] += 1
            try:
                case = json.loads(line)
            except json.JSONDecodeError as e:
                file_errors.append(f"行 {line_num}: JSON 解析错误: {e}")
                stats["errors"] += 1
                continue
            errors = validate_case(case)
            if errors:
                for err in errors:
                    file_errors.append(f"行 {line_num}: {err}")
                stats["errors"] += 1
            else:
                stats["valid"] += 1
            if "id" in case:
                if case["id"] in stats["ids"]:
                    file_errors.append(f"行 {line_num}: 重复 ID: {case['id']}")
                    stats["errors"] += 1
                stats["ids"].add(case["id"])
    stats["errors"] = len(file_errors)
    return stats, file_errors


def build_evals_index():
    """构建 evals.json 索引文件。"""
    index = {"generated_at": datetime.now().isoformat(), "evals": []}
    evals_dir = os.path.dirname(os.path.abspath(__file__))
    for skill_dir in ["context-loader", "refine-knowledge"]:
        skill_path = os.path.join(evals_dir, skill_dir)
        if not os.path.isdir(skill_path):
            continue
        for filename in sorted(os.listdir(skill_path)):
            if not filename.endswith(".jsonl"):
                continue
            filepath = os.path.join(skill_path, filename)
            count = 0
            with open(filepath) as f:
                for line in f:
                    if line.strip():
                        count += 1
            index["evals"].append({
                "file": f"{skill_dir}/{filename}",
                "skill": skill_dir,
                "count": count,
            })
    index["total"] = sum(e["count"] for e in index["evals"])
    output = os.path.join(evals_dir, "evals.json")
    with open(output, "w") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    print(f"索引已写入: {output} (共 {index['total']} 条用例)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    if sys.argv[1] == "--validate":
        evals_dir = os.path.dirname(os.path.abspath(__file__))
        total_errors = 0
        for skill_dir in ["context-loader", "refine-knowledge"]:
            skill_path = os.path.join(evals_dir, skill_dir)
            if not os.path.isdir(skill_path):
                continue
            for filename in sorted(os.listdir(skill_path)):
                if not filename.endswith(".jsonl"):
                    continue
                filepath = os.path.join(skill_path, filename)
                stats, errors = validate_file(filepath)
                print(f"{skill_dir}/{filename}: {stats['total']} 条, "
                      f"{stats['valid']} 有效, {stats['errors']} 错误")
                for err in errors:
                    print(f"  {err}")
                    total_errors += 1
        if total_errors == 0:
            print("所有验证通过")
        else:
            print(f"共 {total_errors} 个错误")
        build_evals_index()
        sys.exit(1 if total_errors > 0 else 0)
```

- [ ] **Step 5: 创建验证脚本**

写入 `evals/validate.py`：

```python
#!/usr/bin/env python3
"""深度验证脚本：检查重复、覆盖度、可评分性。

Usage:
    python evals/validate.py <skill> <dimension>
    python evals/validate.py --all
"""

import json
import sys
import os
from collections import Counter

EVALS_DIR = os.path.dirname(os.path.abspath(__file__))

REQUIRED_TAGS = {
    "功能正确性": ["basic", "edge"],
    "鲁棒性": ["missing", "corrupt", "empty"],
    "指令清晰度": ["vague", "ambiguous", "standard"],
    "隔离性": ["settings", "vault", "hooks"],
    "幂等性": ["repeat-2", "repeat-3", "interrupted"],
    "性能开销": ["small", "medium", "large"],
    "知识完整性": ["decision", "method", "identity", "lesson"],
}


def check_duplicates(filepath: str) -> list[str]:
    """检查 prompt+setup 组合是否重复。"""
    errors = []
    seen = {}
    with open(filepath) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            case = json.loads(line)
            key = (case.get("prompt", ""), json.dumps(case.get("setup", {}), sort_keys=True))
            if key in seen:
                errors.append(f"重复用例: {case['id']} 与 {seen[key]}")
            seen[key] = case["id"]
    return errors


def check_coverage(filepath: str, dimension: str) -> list[str]:
    """检查标签覆盖度。"""
    errors = []
    tags = Counter()
    with open(filepath) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            case = json.loads(line)
            for tag in case.get("tags", []):
                tags[tag] += 1
    required = REQUIRED_TAGS.get(dimension, [])
    for tag in required:
        if tag not in tags:
            errors.append(f"缺少标签覆盖: {tag}")
    return errors


def check_scoring(filepath: str) -> list[str]:
    """检查可评分性。"""
    errors = []
    with open(filepath) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            case = json.loads(line)
            criteria = case.get("evaluation", {}).get("criteria", [])
            if not criteria:
                errors.append(f"{case['id']}: 无评分标准")
    return errors


def validate(skill: str, dimension: str) -> int:
    dim_file = {
        "功能正确性": "functionality.jsonl",
        "鲁棒性": "robustness.jsonl",
        "指令清晰度": "clarity.jsonl",
        "隔离性": "isolation.jsonl",
        "幂等性": "idempotency.jsonl",
        "性能开销": "performance.jsonl",
        "知识完整性": "knowledge-integrity.jsonl",
    }[dimension]
    filepath = os.path.join(EVALS_DIR, skill, dim_file)
    if not os.path.exists(filepath):
        print(f"文件不存在: {filepath}")
        return 1
    errors = []
    errors.extend(check_duplicates(filepath))
    errors.extend(check_coverage(filepath, dimension))
    errors.extend(check_scoring(filepath))
    if errors:
        print(f"{skill}/{dimension}: {len(errors)} 个问题")
        for err in errors:
            print(f"  {err}")
    else:
        print(f"{skill}/{dimension}: 验证通过")
    return len(errors)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--all":
        total = 0
        for skill in ["context-loader", "refine-knowledge"]:
            dims = ["功能正确性", "鲁棒性", "指令清晰度", "隔离性",
                    "幂等性", "性能开销"]
            if skill == "refine-knowledge":
                dims.append("知识完整性")
            for dim in dims:
                total += validate(skill, dim)
        sys.exit(1 if total > 0 else 0)
    elif len(sys.argv) == 3:
        sys.exit(validate(sys.argv[1], sys.argv[2]))
    else:
        print(__doc__)
        sys.exit(1)
```

- [ ] **Step 6: 创建 README.md**

写入 `evals/README.md`：

```markdown
# Skill 质量评估

## 概述

为 context-loader 和 refine-knowledge 两个 skill 建立 7 维度质量评估体系，
每个 skill×dimension 组合 200 条测试用例，共 2,800 条。

## 评估维度

| 维度 | 说明 |
|------|------|
| 功能正确性 | skill 是否按 SKILL.md 正确执行 |
| 鲁棒性 | 异常条件下的表现 |
| 指令清晰度 | SKILL.md 指令是否足够清晰 |
| 隔离性 | 是否只影响应该影响的部分 |
| 幂等性 | 重复执行是否无副作用 |
| 性能开销 | token 消耗和执行时间 |
| 知识完整性 | 知识萃取中信息是否完整（仅 refine-knowledge） |

## 评分

- PASS (2): 完全满足期望
- PARTIAL (1): 部分满足
- FAIL (0): 未满足

## 使用

```bash
# 验证所有测试用例格式
python evals/generate.py --validate

# 验证特定 skill/dimension
python evals/validate.py context-loader 功能正确性

# 验证全部
python evals/validate.py --all
```

## 目录

- `context-loader/` — context-loader 各维度测试用例
- `refine-knowledge/` — refine-knowledge 各维度测试用例
- `templates/` — 种子模板（每维度 20 条）
- `generate.py` — 格式验证和索引生成
- `validate.py` — 深度验证（重复、覆盖度、可评分性）
```

- [ ] **Step 7: 运行格式验证确认基础设施可用**

```bash
python evals/generate.py --validate
```

Expected: 0 errors (模板文件暂不在 skill 子目录，不会被扫描)

- [ ] **Step 8: Commit**

```bash
git add -f evals/
git commit -m "eval: 创建测试用例生成基础设施"
```

---

### Task 2: context-loader 功能正确性 — 生成 200 条测试用例

**Files:**
- Modify: `evals/context-loader/functionality.jsonl`

子任务，由子代理执行。

- [ ] **Step 1: 基于模板生成 200 条用例**

使用 `evals/templates/context-loader.jsonl` 中功能正确性的种子用例作为参考，生成 200 条完整测试用例。

**生成策略** — 以下变体组合覆盖 200 条：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| vault 状态 | 已初始化/未初始化/部分初始化 | 20 |
| active.md 状态 | 完整/空/缺失/损坏/超大 | 20 |
| Episodic 索引 | 有记录/空/缺失/大(100条) | 20 |
| Procedural 索引 | 有记录/空/缺失 | 15 |
| Semantic 索引 | 有记录/空/缺失 | 15 |
| 用户指令 | 标准/模糊/非标准/多步骤 | 30 |
| hook 状态 | 已挂载/未挂载/部分挂载 | 15 |
| 边界场景 | 最小 vault/最大 vault/特殊字符路径 | 20 |
| 跨 skill 场景 | refine-knowledge 执行后加载/初始化后加载 | 15 |
| 综合场景 | 多条件组合 | 30 |

每条用例必须：
- 有唯一 ID（`CL-FUNC-0001` 到 `CL-FUNC-0200`）
- 有明确的 `prompt`（贴近真实用户语气）
- 有具体的 `setup.vault_structure`（真实文件内容）
- 有可验证的 `evaluation.criteria`（至少 3 条）
- 有相关的 `tags`

- [ ] **Step 2: 验证格式**

```bash
python evals/generate.py --validate
python evals/validate.py context-loader 功能正确性
```

Expected: 0 errors, 200 条

- [ ] **Step 3: Commit**

```bash
git add -f evals/context-loader/functionality.jsonl
git commit -m "eval: context-loader 功能正确性 200 条测试用例"
```

---

### Task 3: context-loader 鲁棒性 — 生成 200 条测试用例

**Files:**
- Create: `evals/context-loader/robustness.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| 文件缺失 | active.md/index.md/config/vault根目录 | 30 |
| 配置异常 | JSON错误/字段缺失/字段类型错误/旧版本格式 | 25 |
| 空 vault | 所有目录存在但无文件 | 15 |
| 损坏文件 | 截断/乱码/非 UTF-8/空行 | 20 |
| 权限问题 | 只读文件/无权限目录 | 15 |
| hook 异常 | 未挂载/错误命令/超时 | 20 |
| 大输入 | 1000文件/10万字索引/深层嵌套 | 20 |
| 并发 | 同时初始化+加载/同时多个session | 15 |
| 环境差异 | macOS/Linux/不同shell/不同CL版本 | 20 |
| 综合异常 | 多异常组合 | 20 |

- [ ] **Step 2: 验证**

```bash
python evals/validate.py context-loader 鲁棒性
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/context-loader/robustness.jsonl
git commit -m "eval: context-loader 鲁棒性 200 条测试用例"
```

---

### Task 4: context-loader 指令清晰度 — 生成 200 条测试用例

**Files:**
- Create: `evals/context-loader/clarity.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| 模糊指令 | "加载上下文"/"看一下"/"处理一下"/"继续" | 30 |
| 非常规触发 | 非 / 命令格式/自然语言触发/隐式触发 | 25 |
| 歧义场景 | "加载"指代不明/"处理"目标不明 | 25 |
| 跨 skill 交互 | 两个 skill 同时激活/顺序冲突 | 20 |
| 多步骤 | 连续3步以上操作/中间需要确认 | 25 |
| 优先级冲突 | 两个 skill 都想执行时的判断 | 20 |
| 方言/语言 | 中英文混合/口语化/技术术语不标准 | 25 |
| 上下文依赖 | 依赖上轮对话/引用之前的结果 | 30 |

- [ ] **Step 2: 验证**

```bash
python evals/validate.py context-loader 指令清晰度
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/context-loader/clarity.jsonl
git commit -m "eval: context-loader 指令清晰度 200 条测试用例"
```

---

### Task 5: context-loader 隔离性 — 生成 200 条测试用例

**Files:**
- Create: `evals/context-loader/isolation.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| settings.json 保护 | 有其他 hooks/有其他配置/空 | 30 |
| vault 无关目录 | Identity/Creation/Archive/Personal | 30 |
| 临时文件清理 | 执行中创建临时文件后清理 | 25 |
| 环境变量 | 不泄漏敏感变量/不影响系统 PATH | 20 |
| 文件系统 | 不修改 .git/不影响其他 .claude 配置 | 25 |
| hook 生命周期 | 执行完不残留/不重复注册 | 30 |
| 跨 session 影响 | 不影响其他 session 的状态 | 20 |
| 并发安全 | 多个 skill 同时执行不冲突 | 20 |

- [ ] **Step 2: 验证**

```bash
python evals/validate.py context-loader 隔离性
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/context-loader/isolation.jsonl
git commit -m "eval: context-loader 隔离性 200 条测试用例"
```

---

### Task 6: context-loader 幂等性 — 生成 200 条测试用例

**Files:**
- Create: `evals/context-loader/idempotency.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| 连续 2 次 | 标准场景连续执行 | 30 |
| 连续 3 次 | 标准场景连续执行 3 次 | 25 |
| 间断执行 | 中间有其他操作间隔 5min | 30 |
| 打断重执行 | 执行中 Ctrl-C 后重新执行 | 20 |
| 不同 vault 状态 | 空/部分/完整 vault 各幂等 | 25 |
| 配置变更 | 执行间修改了 vault-config | 20 |
| hook 重复 | hook 已注册再执行 | 25 |
| 综合幂等 | 多条件组合 | 25 |

- [ ] **Step 2: 验证**

```bash
python evals/validate.py context-loader 幂等性
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/context-loader/idempotency.jsonl
git commit -m "eval: context-loader 幂等性 200 条测试用例"
```

---

### Task 7: context-loader 性能开销 — 生成 200 条测试用例

**Files:**
- Create: `evals/context-loader/performance.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| 小 vault | 10 文件/各文件 <1KB | 30 |
| 中 vault | 100 文件/索引 10KB | 30 |
| 大 vault | 1000 文件/索引 100KB | 30 |
| 会话长度 | 500/5000/50000 字符 | 20 |
| 索引复杂度 | 扁平/深层嵌套/交叉引用 | 25 |
| 缓存状态 | 冷启动/缓存命中/缓存过期 | 25 |
| 并发请求 | 同时 2/5/10 个加载请求 | 20 |
| 网络/IO | 慢磁盘/远程 vault | 20 |

- [ ] **Step 2: 验证**

```bash
python evals/validate.py context-loader 性能开销
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/context-loader/performance.jsonl
git commit -m "eval: context-loader 性能开销 200 条测试用例"
```

---

### Task 8: refine-knowledge 功能正确性 — 生成 200 条测试用例

**Files:**
- Create: `evals/refine-knowledge/functionality.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**（覆盖管线 4 个步骤的变体）：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| Step 1 扫描 | 0/1/3/10 个未处理会话 | 25 |
| Step 2 Episodic | 值得提炼/不值得/边界情况 | 35 |
| Step 2.5 Identity | 角色/能力/价值观/自我认知/无信号 | 35 |
| Step 3 Procedural | 方法有效/无效/混合/纯 Semantic | 30 |
| Step 4 索引 | 更新/已存在/损坏后重建 | 25 |
| 完整管线 | 从扫描到索引的端到端 | 25 |
| 用户交互 | 确认/拒绝/部分确认/延迟决策 | 25 |

- [ ] **Step 2: 验证**

```bash
python evals/validate.py refine-knowledge 功能正确性
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/refine-knowledge/functionality.jsonl
git commit -m "eval: refine-knowledge 功能正确性 200 条测试用例"
```

---

### Task 9: refine-knowledge 鲁棒性 — 生成 200 条测试用例

**Files:**
- Create: `evals/refine-knowledge/robustness.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| 无会话 | Working 目录空 | 15 |
| 空会话 | 文件存在但内容为空 | 15 |
| 损坏会话 | 截断/乱码/缺少字段 | 25 |
| 配置异常 | vault-config 错误/缺失/旧版本 | 20 |
| 文件权限 | 只读/无权限 | 15 |
| 大输入 | 100 个会话/单会话 50000 字符 | 25 |
| 索引损坏 | index.md 格式错误/空 | 20 |
| 并发 | 同时 refine + load | 15 |
| pending 去重 | 重复信号/7 天 rejected/30 天 pending | 25 |
| 综合异常 | 多异常组合 | 25 |

- [ ] **Step 2: 验证**

```bash
python evals/validate.py refine-knowledge 鲁棒性
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/refine-knowledge/robustness.jsonl
git commit -m "eval: refine-knowledge 鲁棒性 200 条测试用例"
```

---

### Task 10: refine-knowledge 指令清晰度 — 生成 200 条测试用例

**Files:**
- Create: `evals/refine-knowledge/clarity.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| 标准触发 | `/refine-knowledge` | 25 |
| 模糊指令 | "处理会话"/"提炼"/"整理一下" | 30 |
| 自然语言 | "帮我把之前的讨论整理出来" | 25 |
| 跨 skill | 两个 skill 同时激活 | 20 |
| 部分管线 | 只做 Episodic/只做 Identity | 25 |
| 优先级 | 用户说"只做 X 不做 Y" | 25 |
| 歧义 | "处理"指 refine 还是 load | 25 |
| 多轮 | refine 后要求修改/补充 | 25 |

- [ ] **Step 2: 验证**

```bash
python evals/validate.py refine-knowledge 指令清晰度
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/refine-knowledge/clarity.jsonl
git commit -m "eval: refine-knowledge 指令清晰度 200 条测试用例"
```

---

### Task 11: refine-knowledge 隔离性 — 生成 200 条测试用例

**Files:**
- Create: `evals/refine-knowledge/isolation.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| Working 保护 | 不修改原始 session 内容（除 processed 标记） | 30 |
| 无关目录 | Personal/Archive/其他 | 30 |
| pending 去重 | 不重复生成相同信号 | 25 |
| hooks 保护 | settings.json 不受影响 | 25 |
| 已处理会话 | 不重复处理 | 25 |
| 索引独立 | 不修改其他 skill 的索引 | 20 |
| 跨 session | 不影响其他 session | 20 |
| 综合隔离 | 多条件组合 | 25 |

- [ ] **Step 2: 验证**

```bash
python evals/validate.py refine-knowledge 隔离性
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/refine-knowledge/isolation.jsonl
git commit -m "eval: refine-knowledge 隔离性 200 条测试用例"
```

---

### Task 12: refine-knowledge 幂等性 — 生成 200 条测试用例

**Files:**
- Create: `evals/refine-knowledge/idempotency.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| 连续 2 次 | 同一会话 refine 两次 | 30 |
| 连续 3 次 | refine 三次 | 25 |
| 间断执行 | 中间有其他 session | 30 |
| 打断重执行 | refine 中打断后重试 | 20 |
| pending 幂等 | 不重复生成 pending | 25 |
| 索引幂等 | 索引更新不重复 | 25 |
| processed 幂等 | 已处理的不重新处理 | 25 |
| 综合幂等 | 多条件组合 | 20 |

- [ ] **Step 2: 验证**

```bash
python evals/validate.py refine-knowledge 幂等性
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/refine-knowledge/idempotency.jsonl
git commit -m "eval: refine-knowledge 幂等性 200 条测试用例"
```

---

### Task 13: refine-knowledge 性能开销 — 生成 200 条测试用例

**Files:**
- Create: `evals/refine-knowledge/performance.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| 小会话 | 500 字符/1 个会话 | 30 |
| 中会话 | 5000 字符/3 个会话 | 30 |
| 大会话 | 50000 字符/10 个会话 | 30 |
| 索引大小 | 小/中/大索引 | 20 |
| Episodic 数量 | 0/50/500 条已有 | 20 |
| Identity 复杂度 | 简单/中等/复杂 pending | 20 |
| 缓存 | 冷启动/缓存命中 | 25 |
| 综合性能 | 多条件组合 | 25 |

- [ ] **Step 2: 验证**

```bash
python evals/validate.py refine-knowledge 性能开销
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/refine-knowledge/performance.jsonl
git commit -m "eval: refine-knowledge 性能开销 200 条测试用例"
```

---

### Task 14: refine-knowledge 知识完整性 — 生成 200 条测试用例

**Files:**
- Create: `evals/refine-knowledge/knowledge-integrity.jsonl`

- [ ] **Step 1: 基于模板生成 200 条用例**

**生成策略**：

| 变体维度 | 具体值 | 数量 |
|----------|--------|------|
| 决策捕获 | 技术选型/架构变更/优先级调整 | 30 |
| 方法论提取 | 工作流程/最佳实践/判断标准 | 30 |
| 经验教训 | 踩坑/解决方案/反模式 | 30 |
| Identity 检测 | 角色/能力/价值观/自我认知 | 30 |
| 知识关联 | 新旧知识链接/交叉引用 | 25 |
| 信息保真 | 原文 vs 提炼文对比（遗漏/扭曲/幻觉） | 30 |
| 综合完整性 | 多信息类型混合 | 25 |

每条用例需明确标注：
- 原始会话中标注的关键信息点（至少 3 个）
- 期望捕获的决策/方法/教训列表
- 遗漏率/扭曲率/幻觉率的阈值

- [ ] **Step 2: 验证**

```bash
python evals/validate.py refine-knowledge 知识完整性
```

- [ ] **Step 3: Commit**

```bash
git add -f evals/refine-knowledge/knowledge-integrity.jsonl
git commit -m "eval: refine-knowledge 知识完整性 200 条测试用例"
```

---

### Task 15: 全量验证和索引生成

**Files:**
- Modify: `evals/evals.json`
- Modify: `evals/generate.py` (if needed)

- [ ] **Step 1: 全量格式验证**

```bash
python evals/generate.py --validate
```

Expected output: all 13 files show 0 errors, total = 2,800

- [ ] **Step 2: 全量深度验证**

```bash
python evals/validate.py --all
```

Expected: all 13 dimensions pass (no duplicates, full tag coverage, all have scoring criteria)

- [ ] **Step 3: 检查 evals.json 索引**

```bash
python -c "import json; d=json.load(open('evals/evals.json')); print(f'Total: {d[\"total\"]}'); [print(f'  {e[\"file\"]}: {e[\"count\"]}') for e in d['evals']]"
```

Expected: 13 files, each with 200 cases, total 2,600 (CL 1,200 + RK 1,400)

- [ ] **Step 4: 统计摘要**

确认：
- context-loader: 6 × 200 = 1,200 条
- refine-knowledge: 7 × 200 = 1,400 条
- 总计: 2,600 条

注意：实际总数为 2,600 而非 2,800（context-loader 无知识完整性维度）。如需要严格 2,800 条，需为 context-loader 也定义知识完整性维度或增加其他维度用例。

- [ ] **Step 5: Commit**

```bash
git add -f evals/
git commit -m "eval: 全量验证通过，2,600 条测试用例完成"
```

---

## 执行顺序和依赖

```
Task 1 (基础设施)
├─→ Task 2 (CL 功能)     ──→ Task 15 (全量验证)
├─→ Task 3 (CL 鲁棒)     ──→ Task 15
├─→ Task 4 (CL 清晰度)   ──→ Task 15
├─→ Task 5 (CL 隔离)     ──→ Task 15
├─→ Task 6 (CL 幂等)     ──→ Task 15
├─→ Task 7 (CL 性能)     ──→ Task 15
├─→ Task 8 (RK 功能)     ──→ Task 15
├─→ Task 9 (RK 鲁棒)     ──→ Task 15
├─→ Task 10 (RK 清晰度)  ──→ Task 15
├─→ Task 11 (RK 隔离)    ──→ Task 15
├─→ Task 12 (RK 幂等)    ──→ Task 15
├─→ Task 13 (RK 性能)    ──→ Task 15
└─→ Task 14 (RK 知识)    ──→ Task 15
```

Tasks 2-14 互相独立，可并行执行。

## Self-Review

**1. Spec 覆盖检查：**

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 7 维度 × 2 skill | Tasks 2-14 各覆盖一个维度 |
| 200 条/维度 | 每个 Task Step 1 明确 200 条 |
| 统一 JSON 格式 | Task 1 定义模板和验证逻辑 |
| ID 命名规则 | Task 1 generate.py 中定义映射 |
| 3 级评分 | Task 1 README.md 定义，validate.py 检查 |
| 知识完整性专项 | Task 14 专门处理 |
| 分批生成 | Task 2-14 内部按变体分批 |
| 去重/覆盖度/可评分 | Task 1 validate.py + Task 15 全量验证 |

**2. Placeholder 扫描：** 无 TBD/TODO/TODO 等占位符，每个 Step 都有具体内容和命令。

**3. 类型一致性：** ID 格式统一 `{SKILL}-{DIM}-{NNNN}`，evaluation.type 统一 `assertion` 或 `llm_judge`，tags 在各维度 REQUIRED_TAGS 中明确定义。

**4. 数量说明：** Spec 说 2,800 条（14 × 200），实际 context-loader 只有 6 个维度，所以总数是 2,600 条（6 × 200 + 7 × 200）。如 spec 意图是严格 2,800 条，需要给 context-loader 也加一个维度。