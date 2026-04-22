import { useCallback, useRef, useState } from "react";
import { ExternalLink, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useExternalResourceEvents } from "@/hooks/useExternalResourceEvents";
import { useTabReturn } from "@/hooks/useTabReturn";

export type ExternalProvider = "wordwall" | "learningapps" | "h5p" | "generic";
export type ExternalEmbedType = "iframe" | "link_only";

export interface ExternalResource {
  id: string;
  session_id: string;
  title: string;
  url: string;
  embed_type: ExternalEmbedType;
  provider: ExternalProvider;
  embeddable_result?: boolean | null;
}

const PROVIDER_LABEL: Record<ExternalProvider, string> = {
  wordwall: "Wordwall",
  learningapps: "LearningApps",
  h5p: "H5P",
  generic: "Externe",
};

interface Props {
  resource: ExternalResource;
  onCompleted: (autoScore?: number) => void;
  onAutoScore?: (score: number) => void;
}

export function ExternalResourceViewer({ resource, onCompleted, onAutoScore }: Props) {
  const canEmbed =
    resource.embed_type === "iframe" && resource.embeddable_result !== false;

  const [forceLink, setForceLink] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [autoScore, setAutoScore] = useState<number | undefined>(undefined);
  const windowRef = useRef<Window | null>(null);

  const showIframe = canEmbed && !forceLink;

  // Auto-score via xAPI/H5P postMessage
  useExternalResourceEvents({
    enabled: showIframe,
    onScore: (score) => {
      setAutoScore(score);
      onAutoScore?.(score);
      onCompleted(score);
    },
  });

  const handleReturn = useCallback(() => {
    onCompleted(autoScore);
  }, [onCompleted, autoScore]);

  const { markLeftTab } = useTabReturn({
    onReturn: handleReturn,
    enabled: !showIframe,
  });

  const openExternal = () => {
    windowRef.current = window.open(resource.url, "_blank", "noopener,noreferrer");
    setHasOpened(true);
    markLeftTab();
  };

  const closeExternal = () => {
    try {
      windowRef.current?.close();
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">{resource.title}</h2>
        <Badge variant="secondary">{PROVIDER_LABEL[resource.provider]}</Badge>
      </div>

      {showIframe ? (
        <>
          <div className="overflow-hidden rounded-md border bg-background">
            <iframe
              src={resource.url}
              title={resource.title}
              className="w-full"
              style={{ minHeight: 500 }}
              allow="fullscreen; autoplay; microphone"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setForceLink(true)}
              className="text-muted-foreground"
            >
              <HelpCircle className="mr-1 h-4 w-4" />
              Ça ne s'affiche pas&nbsp;? Ouvrir dans un nouvel onglet
            </Button>
            <Button onClick={() => onCompleted(autoScore)}>J'ai terminé</Button>
          </div>
        </>
      ) : (
        <Card className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Cet exercice s'ouvre dans un autre onglet. Revenez ici quand vous avez terminé.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={openExternal}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Ouvrir l'exercice
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={!hasOpened}
              onClick={() => onCompleted()}
            >
              J'ai terminé
            </Button>
            {hasOpened && (
              <Button size="lg" variant="ghost" onClick={closeExternal}>
                <X className="mr-2 h-4 w-4" />
                Fermer l'onglet et revenir
              </Button>
            )}
          </div>
          {hasOpened && (
            <Alert>
              <AlertDescription className="text-sm">
                Si rien ne se passe, fermez l'onglet manuellement puis revenez ici.
              </AlertDescription>
            </Alert>
          )}
        </Card>
      )}
    </div>
  );
}
