import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  analyzePedagogicalSource,
  fetchPedagogicalSourceChunks,
  type PedagogicalSourceChunk,
} from "@/lib/pedagogicalSourceAnalysis";
import type { PedagogicalSource } from "@/lib/pedagogicalSources";
import { Brain, FileText, Loader2 } from "lucide-react";

const STATUS_LABELS: Record<PedagogicalSource["status"], string> = {
  imported: "Importee",
  analyzing: "Analyse en cours",
  analyzed: "Analysee",
  error: "Erreur analyse",
};

function ChunkCard({ chunk }: { chunk: PedagogicalSourceChunk }) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{chunk.title || "Morceau analyse"}</p>
          <p className="text-xs text-muted-foreground">
            {chunk.chunk_type}
            {chunk.level ? ` · ${chunk.level}` : ""}
            {chunk.page_start ? ` · page ${chunk.page_start}${chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ""}` : ""}
          </p>
        </div>
        {chunk.theme && <Badge variant="outline">{chunk.theme}</Badge>}
      </div>
      {chunk.domains.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chunk.domains.map((domain) => (
            <Badge key={domain} variant="secondary" className="text-[10px]">
              {domain}
            </Badge>
          ))}
        </div>
      )}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{chunk.content_text}</p>
    </div>
  );
}

function SourceChunksDialog({
  source,
  open,
  onOpenChange,
}: {
  source: PedagogicalSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: chunks = [], isLoading, error } = useQuery({
    queryKey: ["pedagogical-source-chunks", source.id],
    queryFn: () => fetchPedagogicalSourceChunks(source.id),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[86vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Morceaux analyses</DialogTitle>
          <DialogDescription>{source.title}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive">Impossible de charger les morceaux : {(error as Error).message}</p>
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : chunks.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucun morceau analyse pour cette source. Lancez l'analyse pour la rendre exploitable par le moteur.
          </div>
        ) : (
          <div className="space-y-3">
            {chunks.map((chunk) => (
              <ChunkCard key={chunk.id} chunk={chunk} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SourceAnalysisActions({ source }: { source: PedagogicalSource }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const isBusy = analyzing || source.status === "analyzing";

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const result = await analyzePedagogicalSource(source.id);
      toast.success("Source analysee", {
        description: `${result.chunks_count} morceau(x) extrait(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["pedagogical-sources"] });
      queryClient.invalidateQueries({ queryKey: ["pedagogical-source-chunks", source.id] });
      setOpen(true);
    } catch (error: any) {
      toast.error("Analyse impossible", { description: error.message });
      queryClient.invalidateQueries({ queryKey: ["pedagogical-sources"] });
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={source.status === "error" ? "destructive" : "secondary"} className="text-[10px]">
          {STATUS_LABELS[source.status] ?? source.status}
        </Badge>
        {source.metadata?.analysis_model ? (
          <span className="text-[10px] text-muted-foreground">{String(source.metadata.analysis_model)}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" disabled={isBusy} onClick={handleAnalyze}>
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          {source.status === "analyzed" ? "Re-analyser" : "Analyser"}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <FileText className="h-4 w-4" />
          Morceaux
        </Button>
      </div>

      <SourceChunksDialog source={source} open={open} onOpenChange={setOpen} />
    </div>
  );
}
