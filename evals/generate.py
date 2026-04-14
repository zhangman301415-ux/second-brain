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


def validate_file(filepath: str) -> tuple:
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
    stats["errors_count"] = len(file_errors)
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
                      f"{stats['valid']} 有效, {stats['errors_count']} 错误")
                for err in errors:
                    print(f"  {err}")
                    total_errors += 1
        if total_errors == 0:
            print("所有验证通过")
        else:
            print(f"共 {total_errors} 个错误")
        build_evals_index()
        sys.exit(1 if total_errors > 0 else 0)
