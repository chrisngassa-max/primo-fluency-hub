import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Monté en haut de l'app UNIQUEMENT quand isSandboxEmbed() est vrai.
 * - Si une session sandbox existe déjà -> redirige vers #/eleve
 * - Sinon : attend un postMessage { type: "SANDBOX_AUTH", token_hash }
 *   depuis window.parent (même origine), consomme le magic link via
 *   verifyOtp, puis redirige vers #/eleve.
 * Le token_hash ne transite QUE par postMessage, jamais par URL,
 * et n'est jamais loggé.
 */
export default function SandboxEmbedBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const goToEleve = () => {
      if (!window.location.hash.startsWith("#/eleve")) {
        window.location.hash = "#/eleve";
      }
      setReady(true);
    };

    const reportFailure = (message: string) => {
      setError(message);
      try {
        window.parent?.postMessage({ type: "SANDBOX_AUTH_FAILED" }, window.location.origin);
      } catch {
        /* ignore */
      }
    };

    const consume = async (tokenHash: string) => {
      try {
        const { error: otpError } = await supabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: tokenHash,
        });
        if (otpError) throw otpError;
        if (cancelled) return;
        goToEleve();
      } catch (err) {
        if (cancelled) return;
        reportFailure(
          err instanceof Error
            ? `Connexion sandbox impossible : ${err.message}`
            : "Connexion sandbox impossible.",
        );
      }
    };

    // Vérifie une session existante sur la storageKey isolée
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        goToEleve();
      }
    });

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; token_hash?: string } | null;
      if (!data || data.type !== "SANDBOX_AUTH" || typeof data.token_hash !== "string") return;
      void consume(data.token_hash);
    };

    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
  }, []);

  if (ready) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-50 p-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-lg font-semibold text-amber-900">Aperçu élève sandbox</h1>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-amber-800">
            Connexion à l'environnement sandbox en cours…
          </p>
        )}
      </div>
    </div>
  );
}
