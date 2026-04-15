# Skill 评估试运行

## 快速开始

```bash
# 1. 编译
npm run build

# 2. 运行场景 1（refine-knowledge）
node dist/evals/trial/run-scenario-1.js

# 3. 运行场景 2（context-loader）
node dist/evals/trial/run-scenario-2.js
```

## 场景说明

### 场景 1: refine-knowledge
测试知识萃取 skill 能否正确处理模拟会话数据，生成：
- Episodic 情景记忆
- Procedural 方法提案
- Identity 信号检测

### 场景 2: context-loader
测试上下文加载 skill 能否正确注入：
- active.md 当前关注点
- 各层索引
- 相关条目全文

## 评估流程

1. 运行场景脚本，记录临时目录路径
2. 使用子 agent 触发对应 skill，传入临时目录中的 skills 和 vault
3. skill 执行完成后，检查 vault 中的输出文件
4. 填写 `report-template.md` 评估报告

## 文件结构

```
evals/trial/
├── scenario-1-data.ts      # 场景 1 数据生成
├── scenario-2-data.ts      # 场景 2 数据生成
├── run-scenario-1.ts       # 场景 1 运行脚本
├── run-scenario-2.ts       # 场景 2 运行脚本
├── report-template.md      # 评估报告模板
└── README.md               # 使用说明
```
