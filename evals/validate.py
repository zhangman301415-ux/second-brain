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

# 维度到输出文件名的映射，与 generate.py 保持一致
OUTPUT_FILES = {
    "功能正确性": "functionality.jsonl",
    "鲁棒性": "robustness.jsonl",
    "指令清晰度": "clarity.jsonl",
    "隔离性": "isolation.jsonl",
    "幂等性": "idempotency.jsonl",
    "性能开销": "performance.jsonl",
    "知识完整性": "knowledge-integrity.jsonl",
}

REQUIRED_TAGS = {
    "功能正确性": ["basic", "edge"],
    "鲁棒性": ["missing", "corrupt", "empty"],
    "指令清晰度": ["vague", "ambiguous", "standard"],
    "隔离性": ["settings", "vault", "hooks"],
    "幂等性": ["repeat-2", "repeat-3", "interrupted"],
    "性能开销": ["small", "medium", "large"],
    "知识完整性": ["decision", "method", "identity", "lesson"],
}


def _read_jsonl(filepath: str) -> list[dict]:
    """读取 JSONL 文件，跳过损坏行。返回 (cases, parse_errors)。"""
    cases = []
    parse_errors = []
    with open(filepath) as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                cases.append(json.loads(line))
            except json.JSONDecodeError as e:
                parse_errors.append(f"行 {line_num}: JSON 解析错误: {e}")
    return cases, parse_errors


def check_duplicates(filepath: str) -> list[str]:
    """检查 prompt+setup 组合是否重复。"""
    errors = []
    cases, parse_errors = _read_jsonl(filepath)
    errors.extend(parse_errors)
    seen = {}
    for case in cases:
        key = (case.get("prompt", ""), json.dumps(case.get("setup", {}), sort_keys=True))
        if key in seen:
            errors.append(f"重复用例: {case['id']} 与 {seen[key]}")
        seen[key] = case["id"]
    return errors


def check_coverage(filepath: str, dimension: str) -> list[str]:
    """检查标签覆盖度。"""
    errors = []
    cases, parse_errors = _read_jsonl(filepath)
    errors.extend(parse_errors)
    tags = Counter()
    for case in cases:
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
    cases, parse_errors = _read_jsonl(filepath)
    errors.extend(parse_errors)
    for case in cases:
        criteria = case.get("evaluation", {}).get("criteria", [])
        if not criteria:
            errors.append(f"{case['id']}: 无评分标准")
    return errors


def validate(skill: str, dimension: str) -> int:
    dim_file = OUTPUT_FILES[dimension]
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
        common_dims = ["功能正确性", "鲁棒性", "指令清晰度", "隔离性",
                       "幂等性", "性能开销"]
        for skill in ["context-loader", "refine-knowledge"]:
            dims = common_dims + (
                ["知识完整性"] if skill == "refine-knowledge" else []
            )
            for dim in dims:
                total += validate(skill, dim)
        sys.exit(1 if total > 0 else 0)
    elif len(sys.argv) == 3:
        sys.exit(validate(sys.argv[1], sys.argv[2]))
    else:
        print(__doc__)
        sys.exit(1)
