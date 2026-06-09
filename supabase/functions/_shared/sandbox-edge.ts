import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { NiveauSandbox } from "./sandbox.types.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function getSandboxClients(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) throw Object.assign(new Error("Non autorise"), { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: { user }, error } = await callerClient.auth.getUser();
  if (error || !user) throw Object.assign(new Error("Non autorise"), { status: 401 });

  const { data: role } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "formateur")
    .maybeSingle();
  if (!role) throw Object.assign(new Error("Acces reserve aux formateurs"), { status: 403 });

  return { admin, user };
}

export async function deleteAuthUsers(admin: any, userIds: string[]) {
  for (const userId of userIds ?? []) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && !error.message?.toLowerCase().includes("not found")) throw error;
  }
}

export async function deleteSandboxRows(admin: any, sessionId: string) {
  for (const table of ["resultats", "devoirs", "sessions", "group_members", "profils_eleves", "groups"]) {
    const { error } = await admin.from(table).delete().eq("sandbox_session_id", sessionId);
    if (error) throw error;
  }
}

export function createReadablePassword() {
  const words = [
    "Soleil", "Bleu", "Maison", "Riviere", "Jardin", "Clair",
    "Nuage", "Paris", "Livre", "Matin", "Calme", "Etoile",
  ];
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return `${words[bytes[0] % words.length]}-${words[bytes[1] % words.length]}-${words[bytes[2] % words.length]}-${bytes[3] % 10}`;
}

const PREVIEW_LEVELS: NiveauSandbox[] = ["A1", "A2", "B1", "B2"];

export async function resolveSandboxPreviewStudent(
  admin: any,
  formateurId: string,
  niveau: NiveauSandbox,
) {
  if (!PREVIEW_LEVELS.includes(niveau)) {
    throw Object.assign(new Error("Niveau sandbox invalide"), { status: 400 });
  }

  const { data: session, error: sessionError } = await admin
    .from("sandbox_sessions")
    .select("id, statut, expires_at, eleve_emails")
    .eq("formateur_id", formateurId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) throw Object.assign(new Error("Sandbox introuvable"), { status: 404 });
  if (session.statut !== "active" || new Date(session.expires_at) <= new Date()) {
    throw Object.assign(new Error("Sandbox expiree ou inactive"), { status: 409 });
  }

  const student = (session.eleve_emails ?? []).find((item: any) => item.niveau === niveau);
  if (!student?.user_id) {
    throw Object.assign(new Error("Profil sandbox introuvable"), { status: 400 });
  }

  const { data: learner, error: learnerError } = await admin
    .from("profils_eleves")
    .select("*")
    .eq("eleve_id", student.user_id)
    .maybeSingle();
  if (learnerError) throw learnerError;
  if (!learner) {
    throw Object.assign(new Error("Profil non rattache a cette sandbox"), { status: 403 });
  }
  if (learner.sandbox_session_id && learner.sandbox_session_id !== session.id) {
    throw Object.assign(new Error("Profil rattache a une autre sandbox"), { status: 403 });
  }
  if (!learner.sandbox_session_id) {
    const { error: repairError } = await admin
      .from("profils_eleves")
      .update({ sandbox_session_id: session.id })
      .eq("eleve_id", student.user_id)
      .is("sandbox_session_id", null);
    if (repairError) throw repairError;
    learner.sandbox_session_id = session.id;
  }

  return { session, student, learner };
}
