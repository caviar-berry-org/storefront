import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve("scripts/check-env.ts");
const message = "SMTP_HOST must be the mail hostname";

/** Runs the real CLI against a synthetic .env.local, never the developer's own. */
function checkLocal(overrides: Record<string, string>) {
  const env: Record<string, string> = {
    APP_ENV: "development",
    SITE_URL: "http://localhost:3000",
    SMTP_HOST: "mail.caviar.net.ua",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "dev-notify@caviar.net.ua",
    MAIL_FROM: "dev-notify@caviar.net.ua",
    SMTP_PASSWORD: "offline-test-only",
    ...overrides,
  };
  const directory = mkdtempSync(join(tmpdir(), "env-check-"));
  writeFileSync(
    join(directory, ".env.local"),
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );
  try {
    execFileSync(process.execPath, [script], {
      cwd: directory,
      encoding: "utf8",
      stdio: "pipe",
    });
    return "";
  } catch (error) {
    // A failing check exits 1 and prints every issue to stderr.
    return (error as { stderr?: string }).stderr ?? "";
  }
}

test("the site domain is refused as an SMTP host in development too", () => {
  // The apex points at the site host, so DEV mail dies exactly as production
  // would. Gating this on production let DEV run with mail silently broken.
  assert.match(checkLocal({ SMTP_HOST: "caviar.net.ua" }), new RegExp(message));
  assert.match(
    checkLocal({ SMTP_HOST: "  Caviar.NET.ua  " }),
    new RegExp(message),
  );
  assert.doesNotMatch(checkLocal({}), new RegExp(message));
  assert.doesNotMatch(
    checkLocal({ SMTP_HOST: "smtp.example.com" }),
    new RegExp(message),
  );
});
