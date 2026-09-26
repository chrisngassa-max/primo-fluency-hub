/**
 * CAPTCF Lot 0.6 — create-formateur-account DISABLED.
 * Do not restore account-creation logic in this function for production.
 * Temporary emergency redeploy (owner decision only): restore from git history
 * prior to Lot 0.6 and deploy with verify_jwt=true — never with hardcoded passwords.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: "gone",
      message:
        "create-formateur-account is disabled (CAPTCF Lot 0.6 security confinement).",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
