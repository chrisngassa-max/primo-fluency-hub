import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useExternalResourceEvents } from "@/hooks/useExternalResourceEvents";

export interface ExternalResource {
  id: string;
  session_id: string;
  title: string;
  url: string;
  embed_type: "iframe" | "link_only";
  provider: "wordwall" | "learningapps" | "h5p" | "generic";
}

const PROVIDER_LABEL: Record<ExternalResource["provider"], string> = {
  wordwall: "Wordwall",
  learningapps: "LearningApps",
  h5p: "H5P",
  generic: "Externe",
};

interface Props {
  resource: ExternalResource;
  onDone: (autoScore?: number) => void;
}

export function ExternalResourceViewer({ resource, onDone }: Props) {
  const [autoScore, setAutoScore] = useState<number | undefined>(undefined);

  useExternalResourceEvents({
    onScore: (score) => setAutoScore(score),
    enabled: resource.embed_type === "iframe",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">{resource.title}</h2>
        <Badge variant="secondary">{PROVIDER_LABEL[resource.provider]}</Badge>
      </div>

      {resource.embed_type === "iframe" ? (
        <div className="overflow-hidden rounded-md border bg-background">
          <iframe
            src={resource.url}
            title={resource.title}
            className="w-full"
            style={{ height: 500 }}
            allow="fullscreen; autoplay; microphone"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <Card className="p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Cette ressource s'ouvre sur le site externe.
          </p>
          <Button asChild>
            <a href={resource.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Ouvrir dans un nouvel onglet
            </a>
          </Button>
        </Card>
      )}

      {autoScore !== undefined && (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          Score détecté automatiquement : <strong>{autoScore}/100</strong>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => onDone(autoScore)}>J'ai terminé</Button>
      </div>
    </div>
  );
}
