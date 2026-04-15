/**
 * Eval Runner — 有状态技能评估主流程
 *
 * 流程：
 * 1. 扫描 evals/vaults/<skill_name>/{scenario}/eval.json 发现测试用例
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

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { initVaultFromTemplate, createSnapshot, diffVault, formatVaultDiff, VaultDiff } from "./vault-snapshot.js";
import { gradeEval, GradingResult } from "./grader.js";

const THIS_DIR = dirname(new URL(import.meta.url).pathname);
// vault 数据（markdown）在源码 evals/ 下，不在 dist/ 中
// 从 dist/evals/runner 找源码根目录：寻找包含 evals/runner/runner.js 源码的目录
function findProjectRoot(distThisDir: string): string {
  // dist/evals/runner → 上 3 级 = 项目根
  const candidate = resolve(join(distThisDir, "..", "..", ".."));
  if (existsSync(join(candidate, "evals", "vaults"))) {
    return candidate;
  }
  // 回退：上 2 级
  const fallback = resolve(join(distThisDir, "..", ".."));
  return fallback;
}

const PROJECT_ROOT = findProjectRoot(THIS_DIR);
const EVALS_DIR = join(PROJECT_ROOT, "evals");
const VAULTS_DIR = join(EVALS_DIR, "vaults");
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

interface BenchmarkResult {
  run_summary: Record<string, {
    pass_rate: { mean: number; stddev: number };
    time_seconds: { mean: number; stddev: number };
    tokens: { mean: number; stddev: number };
  }>;
}

/**
 * 扫描指定技能目录下的所有 eval.json，返回测试用例列表
 */
function loadEvalCases(skillName: string): EvalCase[] {
  const skillVaultsDir = join(VAULTS_DIR, skillName);
  if (!existsSync(skillVaultsDir)) {
    console.error(`找不到 vault 目录: ${skillVaultsDir}`);
    process.exit(1);
  }

  const cases: EvalCase[] = [];
  const entries = readdirSync(skillVaultsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const scenarioDir = join(skillVaultsDir, entry.name);
    const evalFile = join(scenarioDir, "eval.json");

    if (!existsSync(evalFile)) continue;

    const evalData = JSON.parse(readFileSync(evalFile, "utf-8"));
    cases.push({
      ...evalData,
      initial_vault: `vaults/${skillName}/${entry.name}/`,
    } as EvalCase);
  }

  cases.sort((a, b) => a.id - b.id);
  return cases;
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

  // 从 vault 快照目录加载测试用例
  const evalCases = loadEvalCases(skillName);
  if (evalCases.length === 0) {
    console.error(`未在 ${join(VAULTS_DIR, skillName)} 下找到任何 eval.json`);
    process.exit(1);
  }

  console.log(`\n=== ${skillName} 评估开始 ===`);
  console.log(`测试用例数: ${evalCases.length}`);
  console.log(`Skill 路径: ${skillPath}\n`);

  // 创建 iteration 目录
  const iterationNum = getNextIterationNumber(skillName);
  const iterationDir = join(WORKSPACE_DIR, `${skillName}/iteration-${iterationNum}`);
  mkdirSync(iterationDir, { recursive: true });

  const allGradingResults: Record<string, GradingResult> = {};
  const allTiming: Record<string, { total_tokens: number; duration_ms: number }> = {};

  runNextEvalInLoop(evalCases, skillPath, iterationDir, iterationNum, allGradingResults, allTiming, 0);
}

/**
 * 顺序执行 eval 用例，每个用例完成后等待用户确认
 */
function runNextEvalInLoop(
  evalCases: EvalCase[],
  skillPath: string,
  iterationDir: string,
  iterationNum: number,
  allGradingResults: Record<string, GradingResult>,
  allTiming: Record<string, { total_tokens: number; duration_ms: number }>,
  index: number
) {
  if (index >= evalCases.length) {
    // 所有用例完成，聚合结果
    const benchmark = computeBenchmark(allGradingResults, allTiming);
    writeFileSync(join(iterationDir, "benchmark.json"), JSON.stringify(benchmark, null, 2));

    console.log("\n=== 评估完成 ===\n");
    console.log(`Benchmark 已保存: ${join(iterationDir, "benchmark.json")}`);
    printBenchmark(benchmark);
    return;
  }

  const evalCase = evalCases[index];

  console.log(`\n--- 运行 #${evalCase.id}: ${evalCase.name} ---`);
  console.log(`描述: ${evalCase.description}`);

  const startTime = Date.now();

  // 1. 从快照恢复 vault
  const templateDir = resolve(EVALS_DIR, evalCase.initial_vault);
  if (!existsSync(templateDir)) {
    console.error(`  初始 vault 快照不存在: ${templateDir}`);
    console.log(`  跳过 #${evalCase.id}\n`);
    runNextEvalInLoop(evalCases, skillPath, iterationDir, iterationNum, allGradingResults, allTiming, index + 1);
    return;
  }

  const evalDir = join(iterationDir, `eval-${evalCase.name}`);
  const initialVaultDir = join(evalDir, "initial_vault");
  const finalVaultDir = join(evalDir, "final_vault");
  const workingVaultDir = join(evalDir, "vault");

  mkdirSync(evalDir, { recursive: true });

  // 复制快照到 working vault
  initVaultFromTemplate(templateDir, workingVaultDir);
  console.log(`  Vault 从模板恢复: ${evalCase.initial_vault}`);

  // 创建初始快照副本（用于 diff）
  createSnapshot(workingVaultDir, initialVaultDir);

  // 2. 触发 skill（这里需要子 agent 或外部触发）
  console.log(`  Prompt: ${evalCase.prompt}`);
  console.log(`  Working Vault: ${workingVaultDir}`);
  console.log(`  Skill Path: ${skillPath}`);
  console.log(`  ⚠  现在需要触发 skill 执行。`);
  console.log(`  执行完成后按 Enter 继续评分，或按 Ctrl+C 中止...`);

  // 等待用户确认 skill 执行完成
  const stdin = process.stdin;
  stdin.resume();
  stdin.once("data", () => {
    // 3. 捕获最终状态
    createSnapshot(workingVaultDir, finalVaultDir);

    const duration = Date.now() - startTime;
    allTiming[evalCase.name] = {
      total_tokens: 0,
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
      total_tokens: 0,
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
    runNextEvalInLoop(evalCases, skillPath, iterationDir, iterationNum, allGradingResults, allTiming, index + 1);
  });
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
  console.log("\n聚合结果:");
  console.log(`  平均通过率: ${(summary.pass_rate.mean * 100).toFixed(0)}% (σ=${(summary.pass_rate.stddev * 100).toFixed(0)}%)`);
  console.log(`  平均耗时: ${summary.time_seconds.mean.toFixed(1)}s (σ=${summary.time_seconds.stddev.toFixed(1)}s)`);
  console.log(`  平均 Token: ${summary.tokens.mean.toFixed(0)} (σ=${summary.tokens.stddev.toFixed(0)})`);
}

function indent(text: string, prefix: string): string {
  return text.split("\n").map(line => prefix + line).join("\n");
}

main();
