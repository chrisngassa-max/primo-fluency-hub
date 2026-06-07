import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

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
  console.log("=== GENERATING SUPABASE TYPES SAFELY ===");
  const isLinked = process.argv.includes("--linked");
  const tempTypesPath = path.join("src", "integrations", "supabase", "types_temp.ts");
  const finalTypesPath = path.join("src", "integrations", "supabase", "types.ts");

  if (isLinked) {
    const projectRef = getProjectRef();
    if (!projectRef) {
      console.error("ERROR: Cannot identify the linked Supabase project.");
      process.exit(1);
    }
    if (projectRef === "gudcenhmzlcvhgbgklzw") {
      console.error("ERROR: Generating types from the production project (gudcenhmzlcvhgbgklzw) is forbidden.");
      process.exit(1);
    }
    if (process.env.ALLOW_LINKED_TYPE_GENERATION !== "true") {
      console.error("ERROR: Linked type generation requires ALLOW_LINKED_TYPE_GENERATION=true on an approved staging project.");
      process.exit(1);
    }
  }

  const cmd = isLinked
    ? "npx --no-install supabase gen types typescript --linked"
    : "npx --no-install supabase gen types typescript --local";

  console.log(`Running: ${cmd}`);
  try {
    const { stdout, stderr } = await execAsync(cmd);

    // Safety check: is the output valid typescript containing expected types?
    if (!stdout || stdout.trim().length < 1000) {
      throw new Error("Generated types output is empty or too short.");
    }
    if (stdout.includes("Error:") || stdout.includes("failed")) {
      throw new Error(`CLI output contains error indications: ${stdout.substring(0, 200)}`);
    }

    fs.writeFileSync(tempTypesPath, stdout, "utf8");
    console.log(`Successfully generated temporary types to: ${tempTypesPath}`);

    // Verify file content starts with expected content (like comment or export type Json)
    const tempContent = fs.readFileSync(tempTypesPath, "utf8");
    if (!tempContent.includes("export type Json") && !tempContent.includes("export interface Database")) {
      throw new Error("Temporary types file does not contain 'Json' or 'Database' interfaces.");
    }

    // Replace the final file
    fs.copyFileSync(tempTypesPath, finalTypesPath);
    fs.unlinkSync(tempTypesPath);
    console.log(`Successfully updated: ${finalTypesPath}`);

  } catch (err) {
    console.error("Type generation failed:", err);
    process.exit(1);
  }
}

run();
