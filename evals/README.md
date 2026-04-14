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
