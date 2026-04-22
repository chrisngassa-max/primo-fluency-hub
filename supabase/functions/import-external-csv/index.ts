import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import Papa from "https://esm.sh/papaparse@5.4.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NAME_KEYS = ["name", "player", "joueur", "élève", "eleve", "student", "pseudo", "prénom", "prenom", "nom"];
const SCORE_KEYS = ["score", "result", "résultat", "resultat", "%", "note", "points", "grade"];

function decodeBytes(bytes: Uint8Array): string {
  // Try UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.slice(3));
  }
  // Try strict UTF-8
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Fallback latin-1
    return new TextDecoder("iso-8859-1").decode(bytes);
  }
}

function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: Record<string, number> = {
    ",": (firstLine.match(/,/g) ?? []).length,
    ";": (firstLine.match(/;/g) ?? []).length,
    "\t": (firstLine.match(/\t/g) ?? []).length,
  };
  let best = ",";
  let bestN = -1;
  for (const sep of Object.keys(counts)) {
    if (counts[sep] > bestN) {
      best = sep;
      bestN = counts[sep];
    }
  }
  return best;
}

function findColumn(fields: string[], candidates: string[]): string | null {
  const norm = (s: string) =>
    s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cand = candidates.map(norm);
  for (const f of fields) {
    const n = norm(f);
    if (cand.includes(n)) return f;
  }
  // partial match
  for (const f of fields) {
    const n = norm(f);
    if (cand.some((c) => n.includes(c))) return f;
  }
  return null;
}

function parseScore(raw: any): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace("%", "").replace(",", ".").trim();
  // x/y form
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (frac) {
    const a = parseFloat(frac[1]);
    const b = parseFloat(frac[2]);
    if (!isFinite(a) || !isFinite(b) || b === 0) return null;
    return Math.max(0, Math.min(100, (a / b) * 100));
  }
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return n;
}

function normalizeScores(values: number[]): number[] {
  if (!values.length) return [];
  const max = Math.max(...values);
  return values.map((v) => {
    if (max <= 1) return Math.round(v * 100 * 100) / 100;
    if (max <= 20) return Math.round(v * 5 * 100) / 100;
    if (max <= 100) return Math.round(v * 100) / 100;
    return Math.round((v / max) * 100 * 100) / 100;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const contentType = req.headers.get("content-type") || "";

    // PREVIEW: multipart with file
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const action = String(form.get("action") || "preview");
      const externalResourceId = String(form.get("external_resource_id") || "");
      const file = form.get("file");

      if (!externalResourceId) {
        return new Response(JSON.stringify({ error: "external_resource_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!(file instanceof File)) {
        return new Response(JSON.stringify({ error: "file required (multipart)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (action !== "preview") {
        return new Response(JSON.stringify({ error: "Use JSON body for confirm action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authorization: ensure formateur owns the resource
      const { data: resource, error: rErr } = await supabase
        .from("external_resources")
        .select("id, created_by, session_id")
        .eq("id", externalResourceId)
        .maybeSingle();
      if (rErr || !resource) {
        return new Response(JSON.stringify({ error: "Resource not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resource.created_by !== userId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const buf = new Uint8Array(await file.arrayBuffer());
      const text = decodeBytes(buf);
      const separator = detectSeparator(text);

      const parsed = Papa.parse(text, {
        header: true,
        delimiter: separator,
        skipEmptyLines: true,
      });

      const fields: string[] = (parsed.meta?.fields as string[]) ?? [];
      const nameCol = findColumn(fields, NAME_KEYS);
      const scoreCol = findColumn(fields, SCORE_KEYS);

      const rawRows = (parsed.data as Record<string, any>[]).filter((r) => r && Object.keys(r).length);

      let rows: { raw_name: string; score: number | null }[] = [];
      if (nameCol && scoreCol) {
        const parsedScores = rawRows.map((r) => parseScore(r[scoreCol]));
        const validIdx: number[] = [];
        const validVals: number[] = [];
        parsedScores.forEach((v, i) => {
          if (v != null) {
            validIdx.push(i);
            validVals.push(v);
          }
        });
        const normalized = normalizeScores(validVals);
        const normMap = new Map<number, number>();
        validIdx.forEach((i, k) => normMap.set(i, normalized[k]));

        rows = rawRows.map((r, i) => ({
          raw_name: String(r[nameCol] ?? "").trim(),
          score: normMap.has(i) ? normMap.get(i)! : null,
        })).filter((r) => r.raw_name);
      }

      return new Response(
        JSON.stringify({
          rows,
          separator_detected: separator === "\t" ? "tab" : separator,
          columns_detected: { name: nameCol, score: scoreCol, all: fields },
          total_rows: rawRows.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CONFIRM: JSON
    const body = await req.json();
    const action = body.action ?? "confirm";
    const externalResourceId: string = body.external_resource_id;
    const mappings: { raw_name: string; student_id: string; score: number }[] = body.mappings ?? [];

    if (action !== "confirm") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!externalResourceId || !Array.isArray(mappings)) {
      return new Response(JSON.stringify({ error: "external_resource_id and mappings required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization
    const { data: resource, error: rErr } = await supabase
      .from("external_resources")
      .select("id, created_by")
      .eq("id", externalResourceId)
      .maybeSingle();
    if (rErr || !resource) {
      return new Response(JSON.stringify({ error: "Resource not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resource.created_by !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validMappings = mappings.filter(
      (m) => m && m.student_id && typeof m.score === "number" && isFinite(m.score)
    );

    let inserted = 0;
    let updated = 0;
    let skipped_validated = 0;
    const skipped = mappings.length - validMappings.length;

    // Fetch existing rows for this resource & students to know which are validated / new / updatable
    const studentIds = validMappings.map((m) => m.student_id);
    const { data: existing } = await supabase
      .from("external_resource_results")
      .select("id, student_id, source")
      .eq("external_resource_id", externalResourceId)
      .in("student_id", studentIds);

    const existingMap = new Map<string, { id: string; source: string }>(
      (existing ?? []).map((e: any) => [e.student_id, { id: e.id, source: e.source }])
    );

    for (const m of validMappings) {
      const score = Math.max(0, Math.min(100, m.score));
      const ex = existingMap.get(m.student_id);
      if (!ex) {
        const { error } = await supabase.from("external_resource_results").insert({
          external_resource_id: externalResourceId,
          student_id: m.student_id,
          score,
          source: "imported_csv",
        });
        if (!error) inserted++;
      } else if (ex.source === "validated") {
        skipped_validated++;
      } else {
        const { error } = await supabase
          .from("external_resource_results")
          .update({
            score,
            source: "imported_csv",
            validated_by: null,
            validated_at: null,
          })
          .eq("id", ex.id);
        if (!error) updated++;
      }
    }

    return new Response(
      JSON.stringify({ inserted, updated, skipped, skipped_validated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("import-external-csv error", e);
    return new Response(JSON.stringify({ error: e.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
