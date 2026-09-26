/**
 * CAPTCF Lot 0.5 — bootstrap-test-accounts DISABLED.
 * Do not restore account-creation logic in this function for production.
 * Temporary emergency redeploy (owner decision only): restore from git history
 * prior to Lot 0.5 and deploy with verify_jwt=true — never with hardcoded passwords.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bootstrap-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: "gone",
      message:
        "bootstrap-test-accounts is disabled (CAPTCF Lot 0.5 security confinement).",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
