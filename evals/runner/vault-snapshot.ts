/**
 * Vault 快照管理
 *
 * 负责：
 * - 从模板初始化 vault
 * - 创建快照（运行前状态）
 * - 恢复快照（迭代重置）
 * - 比较快照（生成 vault diff）
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";

/**
 * 从模板目录初始化 vault
 */
export function initVaultFromTemplate(templateDir: string, vaultPath: string): void {
  if (existsSync(vaultPath)) {
    rmSync(vaultPath, { recursive: true });
  }
  copyDirRecursive(templateDir, vaultPath);
}

/**
 * 创建快照（保存运行前状态）
 */
export function createSnapshot(vaultPath: string, snapshotPath: string): void {
  if (existsSync(snapshotPath)) {
    rmSync(snapshotPath, { recursive: true });
  }
  copyDirRecursive(vaultPath, snapshotPath);
}

/**
 * 比较两个 vault 状态，返回 diff 信息
 */
export function diffVault(beforePath: string, afterPath: string): VaultDiff {
  const beforeFiles = collectFiles(beforePath);
  const afterFiles = collectFiles(afterPath);

  const diff: VaultDiff = {
    added: [],
    modified: [],
    deleted: [],
    unchanged: [],
  };

  // Find added and modified files
  for (const [relPath, absPath] of Object.entries(afterFiles)) {
    if (!(relPath in beforeFiles)) {
      diff.added.push(relPath);
    } else {
      const beforeContent = readFileSync(beforeFiles[relPath], "utf-8");
      const afterContent = readFileSync(absPath, "utf-8");
      if (beforeContent !== afterContent) {
        diff.modified.push(relPath);
      } else {
        diff.unchanged.push(relPath);
      }
    }
  }

  // Find deleted files
  for (const relPath of Object.keys(beforeFiles)) {
    if (!(relPath in afterFiles)) {
      diff.deleted.push(relPath);
    }
  }

  return diff;
}

export interface VaultDiff {
  added: string[];
  modified: string[];
  deleted: string[];
  unchanged: string[];
}

/**
 * 格式化 diff 为可读文本
 */
export function formatVaultDiff(diff: VaultDiff): string {
  const lines: string[] = [];

  if (diff.added.length > 0) {
    lines.push("=== Added ===");
    for (const f of diff.added) lines.push(`  + ${f}`);
    lines.push("");
  }

  if (diff.modified.length > 0) {
    lines.push("=== Modified ===");
    for (const f of diff.modified) lines.push(`  ~ ${f}`);
    lines.push("");
  }

  if (diff.deleted.length > 0) {
    lines.push("=== Deleted ===");
    for (const f of diff.deleted) lines.push(`  - ${f}`);
    lines.push("");
  }

  lines.push(`Total: ${diff.added.length} added, ${diff.modified.length} modified, ${diff.deleted.length} deleted, ${diff.unchanged.length} unchanged`);

  return lines.join("\n");
}

// -- Private helpers --

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function collectFiles(dir: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!existsSync(dir)) return result;

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        result[relative(dir, fullPath)] = fullPath;
      }
    }
  }

  walk(dir);
  return result;
}
