import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import type { SandboxLevel } from "@/contexts/SandboxContext";

interface InviteResponse {
  token_hash?: string;
  invite_url?: string;
  niveau: string;
  expires_in_seconds: number;
}

type Status = "loading" | "ready" | "error";

function getTokenHashFromInvite(data: InviteResponse | null): string | null {
  if (data?.token_hash) return data.token_hash;
  if (!data?.invite_url) return null;
  try {
    return new URL(data.invite_url).searchParams.get("token");
  } catch {
    return null;
  }
}

export default function SandboxEmbedFrame({ niveau }: { niveau: SandboxLevel }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const tokenRef = useRef<string | null>(null);
  const retriedRef = useRef(false);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string>("");
  const [reloadKey, setReloadKey] = useState(0);

  const iframeSrc = useMemo(() => {
    return `${window.location.origin}${window.location.pathname}?sandbox_embed=1#/eleve`;
  }, []);

  const requestInvite = useCallback(async (): Promise<string | null> => {
    const redirectTo = iframeSrc;
    const { data, error: invokeError } = await supabase.functions.invoke<InviteResponse>(
      "sandbox-invite",
      { body: { niveau, origin: window.location.origin, redirect_to: redirectTo } },
    );
    if (invokeError) {
      const message = await getEdgeFunctionErrorMessage(
        invokeError,
        "Sandbox indisponible — ouvre le panneau Sandbox pour la relancer.",
      );
      setStatus("error");
      setError(message);
      return null;
    }
    const tokenHash = getTokenHashFromInvite(data ?? null);
    if (!tokenHash) {
      setStatus("error");
      setError("Réponse sandbox-invite invalide.");
      return null;
    }
    return tokenHash;
  }, [iframeSrc, niveau]);

  // Charge un nouveau token à chaque changement de niveau / reload
  useEffect(() => {
    let cancelled = false;
    tokenRef.current = null;
    retriedRef.current = false;
    setStatus("loading");
    setError("");
    void requestInvite().then((token) => {
      if (cancelled || !token) return;
      tokenRef.current = token;
      // Si l'iframe est déjà chargée, on poste tout de suite
      const win = iframeRef.current?.contentWindow;
      if (win) {
        win.postMessage({ type: "SANDBOX_AUTH", token_hash: token }, window.location.origin);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [niveau, reloadKey, requestInvite]);

  // Écoute les échecs côté iframe
  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string } | null;
      if (!data || data.type !== "SANDBOX_AUTH_FAILED") return;
      if (retriedRef.current) {
        setStatus("error");
        setError("Connexion sandbox impossible après une nouvelle tentative.");
        return;
      }
      retriedRef.current = true;
      const token = await requestInvite();
      if (!token) return;
      tokenRef.current = token;
      // Recharge l'iframe pour rejouer le bootstrap proprement
      setReloadKey((k) => k + 1);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [requestInvite]);

  const handleIframeLoad = () => {
    const token = tokenRef.current;
    const win = iframeRef.current?.contentWindow;
    if (!token || !win) return;
    win.postMessage({ type: "SANDBOX_AUTH", token_hash: token }, window.location.origin);
    setStatus("ready");
  };

  if (status === "error") {
    return (
      <Card className="border-destructive">
        <CardContent className="space-y-4 p-6">
          <p className="text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                retriedRef.current = false;
                setReloadKey((k) => k + 1);
              }}
            >
              Réessayer
            </Button>
            <Button asChild variant="secondary">
              <Link to="/formateur/sandbox">Panneau Sandbox</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] w-full flex-col">
      <iframe
        key={reloadKey}
        ref={iframeRef}
        src={iframeSrc}
        onLoad={handleIframeLoad}
        title={`Aperçu élève sandbox ${niveau}`}
        allow="microphone; autoplay"
        className="h-full w-full flex-1 rounded-lg border border-amber-300 bg-background"
      />
    </div>
  );
}
