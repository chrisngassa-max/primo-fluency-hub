import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Typed wrapper around the beta supabase.auth.oauth namespace.
type OAuthClient = {
  name?: string;
  client_name?: string;
};
type AuthorizationDetails = {
  client?: OAuthClient;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
const oauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
    approveAuthorization: (id: string) => Promise<OAuthResult>;
    denyAuthorization: (id: string) => Promise<OAuthResult>;
  };
}).oauth;

export default function OAuthConsent() {
  const params = new URLSearchParams(window.location.search);
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("authorization_id manquant.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        // The app uses HashRouter — the login route lives after the '#'.
        window.location.href = `/#/formateur/login?next=${encodeURIComponent(next)}`;
        return;
      }
      const res = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (res.error) {
        setError(res.error.message);
        return;
      }
      const immediate = res.data?.redirect_url ?? res.data?.redirect_to;
      if (immediate && !res.data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(res.data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const res = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (res.error) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    const target = res.data?.redirect_url ?? res.data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Aucune redirection renvoyée par le serveur d'autorisation.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "cette application";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, width: "100%" }}>
        {error ? (
          <>
            <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Autorisation impossible</h1>
            <p style={{ color: "#b00020" }}>{error}</p>
          </>
        ) : !details ? (
          <p>Chargement…</p>
        ) : (
          <>
            <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
              Connecter {clientName} à votre compte
            </h1>
            <p style={{ color: "#444", marginBottom: "1.5rem" }}>
              {clientName} pourra accéder aux outils de la plateforme Cap CF en votre nom.
              L'accès reste limité à vos propres données (RLS Supabase).
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                disabled={busy}
                onClick={() => decide(true)}
                style={{
                  padding: "0.6rem 1.2rem",
                  background: "#111827",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Approuver
              </button>
              <button
                disabled={busy}
                onClick={() => decide(false)}
                style={{
                  padding: "0.6rem 1.2rem",
                  background: "white",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Refuser
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
