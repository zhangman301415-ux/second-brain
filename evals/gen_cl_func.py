#!/usr/bin/env python3
"""生成 context-loader 功能正确性 200 条测试用例。"""

import json
import os

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "evals", "context-loader", "functionality.jsonl")

os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

cases = []
case_id = 0

ACTIVE_TEMPLATES = [
    "# 当前关注点\n\n- 优化知识萃取管线\n- 编写测试用例",
    "# 当前关注点\n\n（暂无）",
    "# 当前关注\n\n- 重构测试框架\n- 学习 Rust 所有权",
    "# 关注\n\n- API 版本策略设计",
    "# 当前任务\n\n- 调试内存泄漏问题",
    "# 当前\n\n- 设计数据库迁移方案\n- 编写单元测试",
    "# 当前重点\n\n- 迁移到新版本",
    "# 关注领域\n\n- 性能优化\n- 代码质量",
]

EPISODIC_VARIANTS = [
    "## 2026-04-14\n- [重构 vault 初始化脚本](2026-04-14-重构vault初始化.md)",
    "",
    "## 2026-04-01\n- [学习 Rust 所有权](2026-04-01-学习rust.md)\n## 2026-04-05\n- [调试内存泄漏](2026-04-05-调试内存泄漏.md)\n## 2026-04-10\n- [设计 API 版本策略](2026-04-10-设计API版本策略.md)",
    "## 2026-03\n- [搭建 CI 环境](2026-03-setup-ci.md)\n## 2026-04\n- [重构 vault 初始化](2026-04-refactor-init.md)\n- [编写测试](2026-04-write-tests.md)",
    "# Episodic 索引\n\n（空）",
]

PROCEDURAL_VARIANTS = [
    "## 方法论\n- [Vault 初始化 SOP](init-vault-sop.md)",
    "",
    "## 方法\n- [Git 分支策略](git-branch-strategy.md)\n- [代码审查流程](code-review-process.md)\n- [测试用例设计](test-case-design.md)",
    "## 已验证方法\n- [自动化部署 SOP](auto-deploy-sop.md)\n- [数据库迁移检查清单](db-migration-checklist.md)",
]

SEMANTIC_VARIANTS = [
    "",
    "# 知识库索引\n\n## Areas\n- [Rust](rust/)\n- [Python](python/)",
    "# 语义索引\n\n## Resources\n- [设计模式参考](design-patterns/)\n- [架构决策记录](adr/)",
    "## 知识\n- [并发模型对比](concurrency-models.md)\n- [ORM 选型指南](orm-selection.md)",
]

PROMPTS = [
    "新会话开始，请加载我的 vault 上下文",
    "加载上下文",
    "请读取我的 vault 状态",
    "开始一个新 session，先加载历史上下文",
    "启动时加载 vault",
    "读取我的知识库上下文",
    "请先了解我之前的工作",
    "加载 vault 状态",
    "读取 context",
    "请先加载我的 Second Brain 上下文",
    "帮我加载上下文",
    "看一下我的 vault",
    "继续之前的工作",
    "处理一下",
    "加载",
    "读取状态",
    "开始工作前先加载",
    "帮我看看之前做过什么",
    "看看我的上下文",
    "先加载",
    "context-loader 启动",
    "inject context",
    "load my vault please",
    "Hey, can you load my context?",
    "load vault context",
    "先跑一下 context loader",
    "执行 context 加载",
    "run context-loader",
    "帮我 init context",
    "load previous session context",
    "加载上下文，然后帮我总结一下我最近在做什么",
    "先加载 vault，然后告诉我有哪些未完成的 Episodic 条目",
    "加载上下文后，帮我检查 active.md 中的任务完成情况",
    "读取 vault 状态，然后告诉我 Procedural 层有哪些方法论",
    "加载上下文，然后看看 Semantic 层有哪些知识区域",
]


def add_case(prompt, scenario, vault_structure, expected_output, criteria, tags):
    global case_id
    case_id += 1
    cases.append({
        "id": f"CL-FUNC-{case_id:04d}",
        "dimension": "功能正确性",
        "skill": "context-loader",
        "prompt": prompt,
        "scenario": scenario,
        "setup": {
            "vault_structure": vault_structure,
            "vault_config_exists": True,
            "hook_status": "mounted",
        },
        "expected_output": expected_output,
        "evaluation": {
            "criteria": criteria,
            "type": "assertion" if len(criteria) >= 3 else "llm_judge"
        },
        "tags": tags,
    })


# === 变体 1: vault 状态 (20 条) ===
for i in range(20):
    status = ["已初始化", "部分初始化", "未初始化"][i % 3]
    if status == "已初始化":
        scenario = f"vault 完全初始化 (变体 {i})"
        expected = "agent 应完整加载所有层上下文，报告当前关注点和相关知识"
        criteria = ["读取了 04-Working/active.md", "至少读取了 2 个索引文件", "报告了加载的上下文摘要"]
        vault = {
            "04-Working/active.md": ACTIVE_TEMPLATES[i % len(ACTIVE_TEMPLATES)],
            "03-Episodic/index.md": EPISODIC_VARIANTS[i % len(EPISODIC_VARIANTS)],
            "01-Procedural/index.md": PROCEDURAL_VARIANTS[i % len(PROCEDURAL_VARIANTS)],
        }
    elif status == "部分初始化":
        scenario = f"vault 部分初始化 (变体 {i})"
        expected = "agent 应加载可用部分，报告缺失索引"
        criteria = ["读取了存在的文件", "报告了缺失或不完整的索引", "未尝试加载不存在的文件"]
        vault = {
            "04-Working/active.md": ACTIVE_TEMPLATES[i % len(ACTIVE_TEMPLATES)],
            "03-Episodic/index.md": EPISODIC_VARIANTS[i % len(EPISODIC_VARIANTS)],
        }
    else:
        scenario = f"vault 未初始化 (变体 {i})"
        expected = "agent 应检测到未初始化，提示用户"
        criteria = ["检测到未初始化状态", "提示用户是否初始化", "未尝试加载不存在的文件"]
        vault = {}
    add_case(PROMPTS[i % len(PROMPTS)], scenario, vault, expected, criteria,
             ["vault-state", status.lower(), "basic"])


# === 变体 2: active.md 状态 (20 条) ===
for i in range(20):
    statuses = ["完整", "空", "缺失", "损坏", "超大"]
    status = statuses[i % len(statuses)]
    if status == "完整":
        content = ACTIVE_TEMPLATES[i % len(ACTIVE_TEMPLATES)]
        scenario = f"active.md 内容完整 (变体 {i})"
        expected = "agent 应加载 active.md 并提取关注点"
        criteria = ["读取了 active.md", "提取了关注点列表", "报告了当前任务"]
    elif status == "空":
        content = "# 当前关注点\n\n（暂无）"
        scenario = f"active.md 内容为空 (变体 {i})"
        expected = "agent 应检测到内容为空"
        criteria = ["读取了 active.md", "识别到内容为空", "报告无活跃关注点"]
    elif status == "缺失":
        content = "__MISSING__"
        scenario = f"active.md 文件缺失 (变体 {i})"
        expected = "agent 应检测到文件不存在"
        criteria = ["检测到 active.md 不存在", "继续加载其他索引", "未报错"]
    elif status == "损坏":
        content = "# 当前\n\n\x00\x01\x02binary"
        scenario = f"active.md 内容损坏 (变体 {i})"
        expected = "agent 应检测到异常内容，跳过或报告"
        criteria = ["检测到内容异常", "未崩溃", "尝试跳过或报告异常"]
    else:
        content = "# 当前关注\n\n" + "- 任务\n" * 500
        scenario = f"active.md 内容超大 (变体 {i})"
        expected = "agent 应只读取必要部分"
        criteria = ["读取了 active.md", "未读取整个大文件", "提取了概要信息"]
    vault = {"03-Episodic/index.md": EPISODIC_VARIANTS[i % len(EPISODIC_VARIANTS)]}
    if content != "__MISSING__":
        vault["04-Working/active.md"] = content
    add_case(PROMPTS[(i+5) % len(PROMPTS)], scenario, vault, expected, criteria,
             ["active-state", status.lower(), "basic"])


# === 变体 3: Episodic 索引 (20 条) ===
for i in range(20):
    epi = EPISODIC_VARIANTS[i % len(EPISODIC_VARIANTS)]
    has_records = len(epi.strip()) > 0
    if epi:
        scenario = f"Episodic 有记录 (变体 {i})"
        expected = "agent 应提取历史事件列表"
        criteria = ["读取了 Episodic 索引", "提取了历史事件", "按时间分区展示"]
    elif not has_records:
        scenario = f"Episodic 为空或缺失 (变体 {i})"
        expected = "agent 应报告无 Episodic 记录"
        criteria = ["检测到 Episodic 为空或缺失", "跳过 Episodic 加载", "继续其他层"]
    vault = {
        "04-Working/active.md": ACTIVE_TEMPLATES[0],
        "03-Episodic/index.md": epi if epi else "__MISSING__",
        "01-Procedural/index.md": PROCEDURAL_VARIANTS[0],
    }
    add_case(PROMPTS[(i+10) % len(PROMPTS)], scenario, vault, expected, criteria,
             ["episodic-index", "has-records" if has_records else "empty", "basic"])


# === 变体 4: Procedural 索引 (15 条) ===
for i in range(15):
    proc = PROCEDURAL_VARIANTS[i % len(PROCEDURAL_VARIANTS)]
    has_records = len(proc.strip()) > 0
    if proc:
        scenario = f"Procedural 有方法论 (变体 {i})"
        expected = "agent 应提取方法论列表"
        criteria = ["读取了 Procedural 索引", "提取了方法论", "报告了数量"]
    else:
        scenario = f"Procedural 为空或缺失 (变体 {i})"
        expected = "agent 应报告无方法论"
        criteria = ["检测到 Procedural 为空或缺失", "跳过 Procedural", "未报错"]
    vault = {
        "04-Working/active.md": ACTIVE_TEMPLATES[0],
        "03-Episodic/index.md": EPISODIC_VARIANTS[0],
        "01-Procedural/index.md": proc if proc else "__MISSING__",
    }
    add_case(PROMPTS[(i+15) % len(PROMPTS)], scenario, vault, expected, criteria,
             ["procedural-index", "has-records" if has_records else "empty", "basic"])


# === 变体 5: Semantic 索引 (15 条) ===
for i in range(15):
    sem = SEMANTIC_VARIANTS[i % len(SEMANTIC_VARIANTS)]
    has_records = len(sem.strip()) > 0
    if sem:
        scenario = f"Semantic 有知识区域 (变体 {i})"
        expected = "agent 应提取知识区域列表"
        criteria = ["读取了 Semantic 索引", "提取了知识区域", "按分类展示"]
    else:
        scenario = f"Semantic 为空或缺失 (变体 {i})"
        expected = "agent 应报告无可用知识"
        criteria = ["检测到 Semantic 为空或缺失", "跳过 Semantic", "未报错"]
    vault = {
        "04-Working/active.md": ACTIVE_TEMPLATES[0],
        "03-Episodic/index.md": EPISODIC_VARIANTS[0],
        "02-Semantic/index.md": sem if sem else "__MISSING__",
    }
    add_case(PROMPTS[(i+20) % len(PROMPTS)], scenario, vault, expected, criteria,
             ["semantic-index", "has-records" if has_records else "empty", "basic"])


# === 变体 6: 用户指令 (30 条) ===
for i in range(30):
    prompt = PROMPTS[i % len(PROMPTS)]
    if "然后" in prompt:
        scenario = f"多步骤指令：加载后分析 (变体 {i})"
        expected = "agent 先加载上下文，再执行分析"
        criteria = ["先完成上下文加载", "然后执行了分析", "两步按顺序完成"]
    elif len(prompt) <= 5:
        scenario = f"极简指令 (变体 {i})"
        expected = "agent 应理解意图并加载"
        criteria = ["识别到加载意图", "执行了加载", "报告了结果"]
    else:
        scenario = f"标准/模糊指令 (变体 {i})"
        expected = "agent 应理解并加载"
        criteria = ["理解了用户意图", "执行了加载", "报告了结果"]
    vault = {
        "04-Working/active.md": ACTIVE_TEMPLATES[i % len(ACTIVE_TEMPLATES)],
        "03-Episodic/index.md": EPISODIC_VARIANTS[i % len(EPISODIC_VARIANTS)],
    }
    add_case(prompt, scenario, vault, expected, criteria,
             ["command-style", "standard" if len(prompt) > 5 else "vague", "basic"])


# === 变体 7: hook 状态 (15 条) ===
for i in range(15):
    hook = ["已挂载", "未挂载", "部分挂载"][i % 3]
    vault = {
        "04-Working/active.md": ACTIVE_TEMPLATES[0],
        "03-Episodic/index.md": EPISODIC_VARIANTS[0],
    }
    if hook == "已挂载":
        scenario = f"hook 正常工作 (变体 {i})"
        expected = "agent 应通过 hook 自动加载"
        criteria = ["hook 正确触发", "加载了完整上下文", "无错误"]
    elif hook == "未挂载":
        scenario = f"hook 未挂载 (变体 {i})"
        expected = "agent 应手动加载或提示"
        criteria = ["检测到 hook 未挂载", "仍能加载或提示", "未崩溃"]
    else:
        scenario = f"hook 部分挂载 (变体 {i})"
        expected = "agent 应检测 hook 失败并替代"
        criteria = ["检测到 hook 失败", "尝试替代方法", "报告了问题"]
    add_case(PROMPTS[i % len(PROMPTS)], scenario, vault, expected, criteria,
             ["hook-status", hook.lower().replace(" ", "-"), "basic"])


# === 变体 8: 边界场景 (20 条) ===
for i in range(20):
    if i < 5:
        scenario = f"最小 vault (变体 {i})"
        vault = {"04-Working/active.md": "# 测试\n\n- 一项任务"}
        expected = "agent 应只加载 active.md"
        criteria = ["读取了 active.md", "未尝试加载不存在的索引", "报告了最小状态"]
        tags = ["minimal-vault", "basic", "edge"]
    elif i < 10:
        large_epi = "\n".join(f"- [任务 {j}](task-{j}.md)" for j in range(100))
        scenario = f"大 vault 100 条 Episodic (变体 {i})"
        vault = {
            "04-Working/active.md": ACTIVE_TEMPLATES[0],
            "03-Episodic/index.md": large_epi,
            "01-Procedural/index.md": PROCEDURAL_VARIANTS[2],
            "02-Semantic/index.md": SEMANTIC_VARIANTS[2],
        }
        expected = "agent 应按需加载"
        criteria = ["按需加载", "提取了概要", "token 消耗合理"]
        tags = ["large-vault", "basic", "edge"]
    elif i < 15:
        scenario = f"特殊字符路径 (变体 {i})"
        vault = {
            "04-Working/active.md": "# 路径测试\n\n- 特殊字符",
            "03-Episodic/index.md": "- [测试](test with spaces.md)",
        }
        expected = "agent 应正确处理特殊字符"
        criteria = ["未因特殊字符崩溃", "正确读取了文件", "报告了结果"]
        tags = ["special-chars", "basic", "edge"]
    else:
        scenario = f"深层嵌套 (变体 {i})"
        vault = {
            "04-Working/active.md": "# 深层\n\n- 深层结构",
            "03-Episodic/index.md": "- [深层测试](nested/deep/test.md)",
            "01-Procedural/index.md": "- [深层方法](a/b/c/method.md)",
        }
        expected = "agent 应处理深层嵌套"
        criteria = ["正确解析了嵌套引用", "按需加载", "未崩溃"]
        tags = ["deep-nesting", "basic", "edge"]
    add_case(PROMPTS[i % len(PROMPTS)], scenario, vault, expected, criteria, tags)


# === 变体 9: 跨 skill 场景 (15 条) ===
for i in range(15):
    if i < 8:
        scenario = f"refine-knowledge 后有新 Episodic (变体 {i})"
        vault = {
            "04-Working/active.md": ACTIVE_TEMPLATES[0],
            "03-Episodic/index.md": EPISODIC_VARIANTS[2] + "\n- [最新](latest-session.md)",
            "01-Procedural/index.md": PROCEDURAL_VARIANTS[1],
        }
        expected = "agent 应加载最新更新的 Episodic"
        criteria = ["读取了最新 Episodic", "识别到新记录", "加载了最新内容"]
    else:
        scenario = f"初始化后首次加载 (变体 {i})"
        vault = {
            "04-Working/active.md": "# 当前\n\n- 初始",
            "03-Episodic/index.md": "",
            "01-Procedural/index.md": "",
            "02-Semantic/index.md": "",
        }
        expected = "agent 应报告空状态"
        criteria = ["识别到首次加载", "报告了空状态", "未加载空内容"]
    add_case(PROMPTS[i % len(PROMPTS)], scenario, vault, expected, criteria,
             ["cross-skill", "basic", "core-flow"])


# === 变体 10: 综合场景 (30 条) ===
for i in range(30):
    if i % 3 == 0:
        scenario = f"完整 vault 多任务多记录 (变体 {i})"
        vault = {
            "04-Working/active.md": "# 当前\n\n- A\n- B\n- C",
            "03-Episodic/index.md": "\n".join(f"## 2026-04-{j:02d}\n- [任务 {j}](task-{j}.md)" for j in range(1, 51)),
            "01-Procedural/index.md": "\n".join(f"- [方法 {j}](method-{j}.md)" for j in range(1, 11)),
            "02-Semantic/index.md": "## Areas\n- [Area A](area-a/)\n- [Area B](area-b/)",
        }
        expected = "agent 应加载所有层并按相关性过滤"
        criteria = ["读取了所有 4 个文件", "按需过滤了 Episodic", "提取了方法论", "报告了完整摘要"]
        tags = ["comprehensive", "large", "basic"]
    elif i % 3 == 1:
        scenario = f"用户只关心 Episodic (变体 {i})"
        vault = {
            "04-Working/active.md": ACTIVE_TEMPLATES[0],
            "03-Episodic/index.md": EPISODIC_VARIANTS[2],
            "01-Procedural/index.md": PROCEDURAL_VARIANTS[2],
        }
        expected = "agent 应只加载 Episodic"
        criteria = ["只加载了 Episodic", "未加载 Procedural", "报告了 Episodic 摘要"]
        tags = ["comprehensive", "focused", "basic"]
    else:
        scenario = f"多 session 场景 (变体 {i})"
        vault = {
            "04-Working/active.md": "# 当前\n\n- 多 session",
            "04-Working/latest.md": "# 当前 session: test-123",
        }
        expected = "agent 应加载当前 session 上下文"
        criteria = ["识别了当前 session", "加载了 session 相关上下文", "未加载其他 session"]
        tags = ["comprehensive", "multi-session", "basic"]
    add_case(PROMPTS[i % len(PROMPTS)], scenario, vault, expected, criteria, tags)


# === 写入 ===
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    for case in cases:
        f.write(json.dumps(case, ensure_ascii=False) + "\n")

print(f"Generated {len(cases)} test cases -> {OUTPUT_FILE}")
