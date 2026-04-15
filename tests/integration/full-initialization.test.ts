import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  createTempDirSync,
  runScript,
  setupSkills,
  readSettings,
} from "../helpers/setup";

const SCRIPTS_DIR = join(__dirname, "../../skills/scripts");

describe("full-initialization", () => {
  let TEST_TMP: string;
  let TEST_VAULT: string;
  let TEST_SKILLS: string;
  let HOME: string;

  beforeEach(() => {
    TEST_TMP = createTempDirSync();
    TEST_VAULT = `${TEST_TMP}/vault`;
    HOME = `${TEST_TMP}/home`;
    mkdirSync(join(HOME, ".claude"), { recursive: true });
    writeFileSync(join(HOME, ".claude/settings.json"), JSON.stringify({ hooks: {} }));
    TEST_SKILLS = setupSkills(TEST_TMP);
  });

  afterEach(() => {
    rmSync(TEST_TMP, { recursive: true, force: true });
  });

  test("full initialization end-to-end", () => {
    const initResult = runScript("init-vault.sh", [TEST_VAULT]);
    expect(initResult.status).toBe(0);
    expect(existsSync(join(TEST_VAULT, "00-Identity/capabilities"))).toBe(true);
    expect(existsSync(join(TEST_VAULT, "06-Archive/ingest/queue"))).toBe(true);
    expect(existsSync(join(TEST_VAULT, "00-Identity/profile.md"))).toBe(true);
    expect(existsSync(join(TEST_VAULT, "03-Episodic/index.md"))).toBe(true);
    const configPath = join(SCRIPTS_DIR, "../.vault-config.json");
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.initialized).toBe(true);
  });

  test("init then mount hooks", () => {
    const initResult = runScript("init-vault.sh", [TEST_VAULT]);
    expect(initResult.status).toBe(0);
    const mountResult = runScript("mount-hooks.sh", [TEST_SKILLS], { env: { HOME } });
    expect(mountResult.status).toBe(0);
    expect(existsSync(join(HOME, ".claude/hooks/queue-session.ts"))).toBe(true);
    expect(existsSync(join(HOME, ".claude/hooks/inject-context.ts"))).toBe(true);
    const settings = readSettings(HOME);
    expect(settings.hooks).toHaveProperty("Stop");
    expect(settings.hooks).toHaveProperty("SessionStart");
  });
});
