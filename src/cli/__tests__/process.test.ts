import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "../../../dist/cli/index.js");
const fixtures = resolve(here, "../../../tests/fixtures");

function run(args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8"
  });
}

describe("CLI process", () => {
  it("exits 0 for identical snapshots", () => {
    const result = run([
      `${fixtures}/valid-v1.json`,
      `${fixtures}/valid-v1.json`
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No capability changes detected.");
  });

  it("exits 1 when high threshold is exceeded", () => {
    const result = run([
      `${fixtures}/valid-v1.json`,
      `${fixtures}/expanded-v2.json`,
      "--fail-on",
      "high"
    ]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("CRITICAL");
  });

  it("exits 2 for invalid snapshots", () => {
    const result = run([
      `${fixtures}/invalid.json`,
      `${fixtures}/valid-v1.json`
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Validation Error");
  });

  it("exits 3 for missing files", () => {
    const result = run([
      `${fixtures}/does-not-exist.json`,
      `${fixtures}/valid-v1.json`
    ]);

    expect(result.status).toBe(3);
    expect(result.stderr).toContain("ENOENT");
  });

  it("rejects an invalid output format", () => {
    const result = run([
      `${fixtures}/valid-v1.json`,
      `${fixtures}/valid-v1.json`,
      "--format",
      "bogus"
    ]);

    expect(result.status).toBe(3);
    expect(result.stderr).toContain("Invalid output format");
  });

  it("rejects an invalid risk threshold", () => {
    const result = run([
      `${fixtures}/valid-v1.json`,
      `${fixtures}/valid-v1.json`,
      "--fail-on",
      "bogus"
    ]);

    expect(result.status).toBe(3);
    expect(result.stderr).toContain("Invalid --fail-on threshold");
  });
});
