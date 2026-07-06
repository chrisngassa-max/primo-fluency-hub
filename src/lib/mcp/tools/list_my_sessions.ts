import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_my_sessions",
  title: "Lister mes séances",
  description:
    "Liste les séances associées à l'utilisateur connecté (formateur ou élève selon RLS).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20)
      .describe("Nombre maximum de séances à retourner."),
    statut: z.enum(["planifiee", "en_cours", "terminee", "annulee"]).nullable()
      .describe("Filtrer par statut, ou null pour tous."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, statut }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const supa = supabaseForUser(ctx);
    let q = supa
      .from("sessions")
      .select("id, titre, date, statut, group_id, niveau_cible")
      .order("date", { ascending: false })
      .limit(limit);
    if (statut) q = q.eq("statut", statut);
    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { sessions: data ?? [] },
    };
  },
});
