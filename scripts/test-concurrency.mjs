import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as crypto from "crypto";
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
  console.log("=== STARTING DIRECT CONCURRENCY TEST FOR claim_session_block ===");
  
  const isLinked = process.argv.includes("--linked");
  if (isLinked) {
    const projectRef = getProjectRef();
    if (!projectRef) {
      console.error("ERROR: Cannot identify the linked Supabase project.");
      process.exit(1);
    }
    if (projectRef === "gudcenhmzlcvhgbgklzw") {
      console.error("ERROR: Execution on the production project (gudcenhmzlcvhgbgklzw) is forbidden.");
      console.error("Please run locally, or link a staging/development project first.");
      process.exit(1);
    }
    if (process.env.ALLOW_LINKED_TESTS !== "true") {
      console.error("ERROR: Linked concurrency tests require ALLOW_LINKED_TESTS=true on an approved staging project.");
      process.exit(1);
    }
  }

  const queryFlag = isLinked ? "--linked" : "";

  // Generate random UUIDs for isolated synthetic test data
  const formateurId = crypto.randomUUID();
  const groupId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  
  console.log(`Generated synthetic IDs:`);
  console.log(`- Formateur: ${formateurId}`);
  console.log(`- Group:     ${groupId}`);
  console.log(`- Session:   ${sessionId}`);

  // 1. Setup SQL: Insert synthetic test data
  const setupSql = `
    -- Insert synthetic formateur user (using mock example.com email to avoid email triggers)
    INSERT INTO auth.users (id, email, raw_user_meta_data) 
    VALUES ('${formateurId}', 'concurrency-test-${formateurId}@example.com', '{"role":"formateur"}'::jsonb);

    INSERT INTO public.user_roles (user_id, role) 
    VALUES ('${formateurId}', 'formateur');

    -- Insert synthetic group
    INSERT INTO public.groups (id, nom, formateur_id, niveau)
    VALUES ('${groupId}', 'Group Concurrency Test', '${formateurId}', 'A2');

    -- Insert synthetic session
    INSERT INTO public.sessions (
      id, group_id, titre, date_seance, niveau_cible,
      nb_exercices_souhaite, nb_exercices_retrospective, duree_retrospective,
      nb_questions_diagnostic, difficulte_par_defaut, generation_automatique_activee
    ) VALUES (
      '${sessionId}', '${groupId}', 'Session Concurrency Test', now(), 'A2',
      5, 3, 10, 10, 5, true
    );
  `;

  console.log("Writing setup SQL to temp file...");
  fs.writeFileSync("temp_concurrency_setup.sql", setupSql, "utf8");

  try {
    console.log("Deploying synthetic test records...");
    await execAsync(`npx --no-install supabase db query ${queryFlag} -f temp_concurrency_setup.sql`);
    console.log("Synthetic test records deployed successfully.");

    // 2. Query SQL: Call claim_session_block concurrently
    const querySql = `
      SET ROLE service_role;
      SELECT public.claim_session_block('${sessionId}', 'diagnostic');
    `;
    fs.writeFileSync("temp_concurrency_query.sql", querySql, "utf8");

    console.log("Launching concurrent claim requests...");
    const cmd = `npx --no-install supabase db query ${queryFlag} -f temp_concurrency_query.sql`;
    
    // Execute both in parallel
    const p1 = execAsync(cmd);
    const p2 = execAsync(cmd);

    const [r1, r2] = await Promise.all([p1, p2]);
    
    const parseClaimResult = (output) => {
      const match = output.match(/"claim_session_block":\s*(true|false)/);
      return match ? match[1] === "true" : null;
    };

    const c1 = parseClaimResult(r1.stdout);
    const c2 = parseClaimResult(r2.stdout);

    console.log(`Connection 1 claim result: ${c1}`);
    console.log(`Connection 2 claim result: ${c2}`);

    if ((c1 === true && c2 === false) || (c1 === false && c2 === true)) {
      console.log("\x1b[32m%s\x1b[0m", "SUCCESS: Concurrency check passed! Exactly one connection acquired the block.");
    } else {
      console.error("\x1b[31m%s\x1b[0m", `FAILURE: Concurrency check failed! c1=${c1}, c2=${c2}`);
      process.exitCode = 1;
    }

  } catch (err) {
    console.error("Test execution failed:", err);
    process.exitCode = 1;
  } finally {
    // Clean up temporary files
    try { fs.unlinkSync("temp_concurrency_setup.sql"); } catch {}
    try { fs.unlinkSync("temp_concurrency_query.sql"); } catch {}

    // 3. Cleanup SQL: Delete synthetic test data (cascades automatically delete session_blocks)
    const cleanupSql = `
      DELETE FROM public.sessions WHERE id = '${sessionId}';
      DELETE FROM public.groups WHERE id = '${groupId}';
      DELETE FROM public.user_roles WHERE user_id = '${formateurId}';
      DELETE FROM auth.users WHERE id = '${formateurId}';
    `;
    
    fs.writeFileSync("temp_concurrency_cleanup.sql", cleanupSql, "utf8");
    console.log("Cleaning up synthetic test records...");
    await execAsync(`npx --no-install supabase db query ${queryFlag} -f temp_concurrency_cleanup.sql`).catch(cleanupErr => {
      console.error("Cleanup command failed:", cleanupErr);
    });
    try { fs.unlinkSync("temp_concurrency_cleanup.sql"); } catch {}
    console.log("Cleanup finished.");
  }
}

run();
