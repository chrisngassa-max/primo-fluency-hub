import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

interface CheckResult {
  embeddable: boolean;
  reason: string;
  provider: "wordwall" | "learningapps" | "h5p" | "generic";
}

function detectProvider(url: string): CheckResult["provider"] {
  const u = url.toLowerCase();
  if (u.includes("wordwall.net")) return "wordwall";
  if (u.includes("learningapps.org")) return "learningapps";
  if (u.includes("h5p.org") || u.includes("h5p.com") || u.includes("/h5p/")) return "h5p";
  return "generic";
}

// SSRF protection
function isUrlSafe(rawUrl: string): { ok: boolean; reason?: string; parsed?: URL } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL invalide" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Schéma non autorisé (http/https uniquement)" };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".localhost")
  ) {
    return { ok: false, reason: "Hôte local interdit" };
  }
  // IPv4 privées
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1]), parseInt(ipv4[2])];
    if (a === 10) return { ok: false, reason: "Plage IP privée 10/8 interdite" };
    if (a === 172 && b >= 16 && b <= 31) return { ok: false, reason: "Plage IP privée 172.16/12 interdite" };
    if (a === 192 && b === 168) return { ok: false, reason: "Plage IP privée 192.168/16 interdite" };
    if (a === 169 && b === 254) return { ok: false, reason: "Plage link-local interdite" };
    if (a === 127) return { ok: false, reason: "Plage loopback interdite" };
  }
  return { ok: true, parsed };
}

function analyzeHeaders(headers: Headers): { embeddable: boolean; reason: string } {
  const xfo = headers.get("x-frame-options");
  if (xfo) {
    const v = xfo.toUpperCase();
    if (v.includes("DENY")) return { embeddable: false, reason: "X-Frame-Options: DENY" };
    if (v.includes("SAMEORIGIN")) return { embeddable: false, reason: "X-Frame-Options: SAMEORIGIN" };
  }
  const csp = headers.get("content-security-policy");
  if (csp) {
    const match = csp.match(/frame-ancestors\s+([^;]+)/i);
    if (match) {
      const directive = match[1].trim().toLowerCase();
      if (directive.includes("'none'")) {
        return { embeddable: false, reason: "CSP frame-ancestors 'none'" };
      }
      if (directive === "'self'") {
        return { embeddable: false, reason: "CSP frame-ancestors 'self'" };
      }
      // si une liste précise sans wildcard, on considère bloqué
      if (!directive.includes("*") && !directive.includes("https:")) {
        return { embeddable: false, reason: `CSP frame-ancestors restreint : ${directive}` };
      }
    }
  }
  return { embeddable: true, reason: "Aucun en-tête bloquant détecté" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth obligatoire
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentification requise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "JWT invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body?.url || typeof body.url !== "string") {
      return new Response(JSON.stringify({ error: "Paramètre 'url' requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safety = isUrlSafe(body.url);
    if (!safety.ok) {
      return new Response(
        JSON.stringify({ embeddable: false, reason: safety.reason, provider: "generic" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const provider = detectProvider(body.url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let res: Response | null = null;
    try {
      res = await fetch(safety.parsed!.toString(), {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "PrimoFluencyHub-EmbedCheck/1.0" },
      });
      if (!res.ok || res.status >= 400) {
        // fallback GET
        res = await fetch(safety.parsed!.toString(), {
          method: "GET",
          signal: controller.signal,
          redirect: "follow",
          headers: { "User-Agent": "PrimoFluencyHub-EmbedCheck/1.0" },
        });
      }
    } catch (e) {
      try {
        res = await fetch(safety.parsed!.toString(), {
          method: "GET",
          signal: controller.signal,
          redirect: "follow",
          headers: { "User-Agent": "PrimoFluencyHub-EmbedCheck/1.0" },
        });
      } catch (e2) {
        clearTimeout(timeoutId);
        return new Response(
          JSON.stringify({
            embeddable: false,
            reason: `Impossible de contacter l'URL (${(e2 as Error).message})`,
            provider,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    clearTimeout(timeoutId);

    const analysis = analyzeHeaders(res!.headers);
    const result: CheckResult = { ...analysis, provider };
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
