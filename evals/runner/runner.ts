/**
 * Eval Runner — 有状态技能评估主流程
 *
 * 流程：
 * 1. 加载 evals.json 测试用例
 * 2. 对每个用例：从快照恢复 vault → 记录初始状态 → 触发 skill → 记录最终状态
 * 3. 比较 vault diff
 * 4. 断言评分
 * 5. 聚合结果
 *
 * 用法:
 *   node dist/evals/runner/runner.js <skill_name> [--skill-path <path>]
 *
 * 例如:
 *   node dist/evals/runner/runner.js refine-knowledge --skill-path skills/refine-knowledge
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs";
import { dirname, join, resolve } from "path";
import { initVaultFromTemplate, createSnapshot, diffVault, formatVaultDiff, VaultDiff } from "./vault-snapshot.js";
import { gradeEval, GradingResult } from "./grader.js";

const THIS_DIR = dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = resolve(join(THIS_DIR, "..", ".."));
const EVALS_DIR = join(PROJECT_ROOT, "evals");
const WORKSPACE_DIR = join(EVALS_DIR, "workspace");

interface EvalCase {
  id: number;
  name: string;
  prompt: string;
  description: string;
  expected_output: string;
  initial_vault: string;
  assertions: string[];
}

interface EvalConfig {
  skill_name: string;
  evals: EvalCase[];
}

interface BenchmarkResult {
  run_summary: Record<string, {
    pass_rate: { mean: number; stddev: number };
    time_seconds: { mean: number; stddev: number };
    tokens: { mean: number; stddev: number };
  }>;
}

function main() {
  const args = process.argv.slice(2);
  const skillName = args[0];
  if (!skillName) {
    console.error("用法: node runner.js <skill_name> [--skill-path <path>]");
    process.exit(1);
  }

  const skillPathFlag = args.indexOf("--skill-path");
  const skillPath = skillPathFlag >= 0 ? resolve(args[skillPathFlag + 1]) : resolve(`skills/${skillName}`);

  // 加载 evals 配置
  const evalsFile = join(EVALS_DIR, `evals-${skillName}.json`);
  if (!existsSync(evalsFile)) {
    console.error(`找不到 evals 文件: ${evalsFile}`);
    process.exit(1);
  }

  const config: EvalConfig = JSON.parse(readFileSync(evalsFile, "utf-8"));
  console.log(`\n=== ${config.skill_name} 评估开始 ===`);
  console.log(`测试用例数: ${config.evals.length}`);
  console.log(`Skill 路径: ${skillPath}\n`);

  // 创建 iteration 目录
  const iterationNum = getNextIterationNumber(skillName);
  const iterationDir = join(WORKSPACE_DIR, `${skillName}/iteration-${iterationNum}`);
  mkdirSync(iterationDir, { recursive: true });

  const allGradingResults: Record<string, GradingResult> = {};
  const allTiming: Record<string, { total_tokens: number; duration_ms: number }> = {};

  for (const evalCase of config.evals) {
    console.log(`\n--- 运行 #${evalCase.id}: ${evalCase.name} ---`);
    console.log(`描述: ${evalCase.description}`);

    const startTime = Date.now();

    // 1. 从快照恢复 vault
    const templateDir = resolve(EVALS_DIR, evalCase.initial_vault);
    if (!existsSync(templateDir)) {
      console.error(`  初始 vault 快照不存在: ${templateDir}`);
      console.log(`  跳过 #${evalCase.id}\n`);
      continue;
    }

    const evalDir = join(iterationDir, `eval-${evalCase.name}`);
    const initialVaultDir = join(evalDir, "initial_vault");
    const finalVaultDir = join(evalDir, "final_vault");
    const workingVaultDir = join(evalDir, "vault");  // skill 实际操作的目录

    mkdirSync(evalDir, { recursive: true });

    // 复制快照到 working vault
    initVaultFromTemplate(templateDir, workingVaultDir);
    console.log(`  Vault 从模板恢复: ${evalCase.initial_vault}`);

    // 创建初始快照副本（用于 diff）
    createSnapshot(workingVaultDir, initialVaultDir);

    // 2. 触发 skill（这里需要子 agent 或外部触发）
    // 当前版本只输出指令，实际执行需要手动或通过子 agent
    console.log(`  Prompt: ${evalCase.prompt}`);
    console.log(`  Working Vault: ${workingVaultDir}`);
    console.log(`  Skill Path: ${skillPath}`);
    console.log(`  ⚠  现在需要触发 skill 执行。`);
    console.log(`  执行完成后按 Enter 继续评分，或按 Ctrl+C 中止...`);

    // 等待用户确认 skill 执行完成
    // （在自动化版本中，这里会通过子 agent 直接执行）
    // For now, we just wait for stdin
    const stdin = process.stdin;
    stdin.resume();
    stdin.once("data", () => {
      // 3. 捕获最终状态
      createSnapshot(workingVaultDir, finalVaultDir);

      const duration = Date.now() - startTime;
      allTiming[evalCase.name] = {
        total_tokens: 0,  // 需要子 agent 提供
        duration_ms: duration,
      };

      // 4. 比较 vault diff
      const diff = diffVault(initialVaultDir, finalVaultDir);
      const diffText = formatVaultDiff(diff);
      writeFileSync(join(evalDir, "vault_diff.txt"), diffText);
      console.log(`\n  Vault Diff:\n${indent(diffText, "    ")}`);

      // 5. 断言评分
      const grading = gradeEval(evalCase.assertions, diff, finalVaultDir, allTiming[evalCase.name]);
      allGradingResults[evalCase.name] = grading;
      allTiming[evalCase.name] = {
        ...allTiming[evalCase.name],
        total_tokens: 0,  // TODO: 从子 agent 获取
      };

      console.log(`\n  评分结果:`);
      for (const result of grading.assertion_results) {
        const icon = result.passed ? "✅" : "❌";
        console.log(`    ${icon} ${result.text}`);
        console.log(`       ${result.evidence}`);
      }
      console.log(`  通过率: ${grading.summary.passed}/${grading.summary.total} (${(grading.summary.pass_rate * 100).toFixed(0)}%)`);

      // 保存 grading.json 和 timing.json
      writeFileSync(join(evalDir, "grading.json"), JSON.stringify(grading, null, 2));
      writeFileSync(join(evalDir, "timing.json"), JSON.stringify(allTiming[evalCase.name], null, 2));

      console.log(`\n  结果已保存: ${evalDir}`);
      console.log("--- 完成 ---\n");

      // 继续下一个
      runNextEval(config, skillPath, iterationDir, iterationNum, allGradingResults, allTiming);
    });
  }
}

function runNextEval(
  config: EvalConfig,
  skillPath: string,
  iterationDir: string,
  iterationNum: number,
  allGradingResults: Record<string, GradingResult>,
  allTiming: Record<string, { total_tokens: number; duration_ms: number }>
) {
  // 聚合 benchmark
  const benchmark = computeBenchmark(allGradingResults, allTiming);
  writeFileSync(join(iterationDir, "benchmark.json"), JSON.stringify(benchmark, null, 2));

  console.log("\n=== 评估完成 ===\n");
  console.log(`Benchmark 已保存: ${join(iterationDir, "benchmark.json")}`);
  printBenchmark(benchmark);
}

function computeBenchmark(
  results: Record<string, GradingResult>,
  timing: Record<string, { total_tokens: number; duration_ms: number }>
): BenchmarkResult {
  const passRates = Object.values(results).map(r => r.summary.pass_rate);
  const times = Object.values(timing).map(t => t.duration_ms / 1000);
  const tokens = Object.values(timing).map(t => t.total_tokens);

  return {
    run_summary: {
      with_skill: {
        pass_rate: stats(passRates),
        time_seconds: stats(times),
        tokens: stats(tokens),
      },
    },
  };
}

function stats(values: number[]): { mean: number; stddev: number } {
  if (values.length === 0) return { mean: 0, stddev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.length === 1 ? 0 : values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}

function getNextIterationNumber(skillName: string): number {
  const skillWorkspace = join(WORKSPACE_DIR, skillName);
  if (!existsSync(skillWorkspace)) return 1;

  const entries = readdirSync(skillWorkspace);
  let max = 0;
  for (const entry of entries) {
    const match = entry.match(/iteration-(\d+)/);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return max + 1;
}

function printBenchmark(benchmark: BenchmarkResult) {
  const summary = benchmark.run_summary.with_skill;
  console.log("\n📊 聚合结果:");
  console.log(`  平均通过率: ${(summary.pass_rate.mean * 100).toFixed(0)}% (σ=${(summary.pass_rate.stddev * 100).toFixed(0)}%)`);
  console.log(`  平均耗时: ${summary.time_seconds.mean.toFixed(1)}s (σ=${summary.time_seconds.stddev.toFixed(1)}s)`);
  console.log(`  平均 Token: ${summary.tokens.mean.toFixed(0)} (σ=${summary.tokens.stddev.toFixed(0)})`);
}

function indent(text: string, prefix: string): string {
  return text.split("\n").map(line => prefix + line).join("\n");
}

function readdirSync(dir: string): string[] {
  const { readdirSync: fsReaddir, statSync: fsStat } = require("fs");
  return fsReaddir(dir);
}

main();
