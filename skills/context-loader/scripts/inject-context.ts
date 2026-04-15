#!/usr/bin/env node
import { existsSync, readFileSync } from "fs";

const VAULT = process.env.OBSIDIAN_VAULT_PATH ?? `${process.env.HOME}/Documents/obsidian-workspace/obsidian_workspace`;
const CONTEXT = `${VAULT}/06-Archive/ingest/context/latest.md`;

if (existsSync(CONTEXT)) {
  process.stdout.write(readFileSync(CONTEXT, "utf-8"));
}
process.exit(0);
