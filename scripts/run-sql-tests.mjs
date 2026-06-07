import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

function getProjectRef() {
  const tempRefPath = path.join("supabase", ".temp", "project-ref");
  if (fs.existsSync(tempRefPath)) {
    return fs.readFileSync(tempRefPath, "utf8").trim();
  }
  const configPath = path.join("supabase", "config.toml");
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf8");
    const match = content.match(/project_id\s*=\s*"([^"]+)"/);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

async function run() {
  console.log("=== COMBINING MIGRATION AND TEST SQL FILES ===");
  const migrationPath = path.join("supabase", "migrations", "20260606020000_session_automation.sql");
  const testPath = path.join("supabase", "tests", "session_automation_test.sql");
  const tempPath = "temp_test_run.sql";

  try {
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    if (!fs.existsSync(testPath)) {
      throw new Error(`Test file not found: ${testPath}`);
    }

    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    let testSql = fs.readFileSync(testPath, "utf8");

    // Replace the \i command with the migration SQL content
    const includePattern = /\\i\s+supabase\/migrations\/20260606020000_session_automation\.sql/;
    if (!includePattern.test(testSql)) {
      throw new Error("Could not find inclusion line '\\i supabase/migrations/20260606020000_session_automation.sql' in test file.");
    }

    testSql = testSql.replace(includePattern, migrationSql);

    fs.writeFileSync(tempPath, testSql, "utf8");
    console.log(`Successfully generated combined SQL test runner: ${tempPath}`);

    const isLinked = process.argv.includes("--linked");
    if (isLinked) {
      const projectRef = getProjectRef();
      if (!projectRef) {
        throw new Error("Cannot identify the linked Supabase project.");
      }
      if (projectRef === "gudcenhmzlcvhgbgklzw") {
        throw new Error("SQL tests are forbidden on the production project gudcenhmzlcvhgbgklzw.");
      }
      if (process.env.ALLOW_LINKED_TESTS !== "true") {
        throw new Error("Linked SQL tests require ALLOW_LINKED_TESTS=true on an approved staging project.");
      }
    }

    const runTests = process.argv.includes("--run");
    if (runTests) {
      const cmd = isLinked
        ? `npx --no-install supabase db query --linked -f ${tempPath}`
        : `npx --no-install supabase db query -f ${tempPath}`;

      console.log(`Executing SQL test command: ${cmd}`);
      const { stdout, stderr } = await execAsync(cmd);
      console.log("=== SQL TEST RESULTS ===");
      console.log(stdout);
      if (stderr) console.error(stderr);
    } else {
      console.log(`To run tests, execute this script with '--run': node scripts/run-sql-tests.mjs ${isLinked ? "--linked " : ""}--run`);
    }

  } catch (err) {
    console.error("Failed to run SQL tests:", err);
    process.exit(1);
  } finally {
    try { fs.unlinkSync(tempPath); } catch {}
  }
}

run();
