#!/usr/bin/env node
/**
 * 构建时复制模板文件到 dist/
 *
 * tsc 只编译 .ts → .js，不复制 .md 等非 TS 文件。
 * 此脚本在 tsc 之后运行，将模板文件同步到 dist/ 对应位置，
 * 确保 npm 安装后 CLI 能通过 import.meta.url 相对路径找到模板。
 */
import { cpSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "..", "dist");

// 从 skills/references 复制到 dist/templates/（供 CLI 运行时读取）
const templateCopies = [
  [
    join(ROOT, "..", "skills", "refine-knowledge", "references", "session-summary-template.md"),
    join(DIST, "templates"),
  ],
  [
    join(ROOT, "..", "skills", "refine-knowledge", "references", "vault-templates"),
    join(DIST, "templates"),
  ],
];

for (const [src, destDir] of templateCopies) {
  if (!existsSync(src)) {
    process.stderr.write(`跳过: ${src} 不存在\n`);
    continue;
  }
  mkdirSync(destDir, { recursive: true });
  cpSync(src, join(destDir, src.split("/").pop()), { recursive: true });
}
