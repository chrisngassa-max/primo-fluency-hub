import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SessionToolId =
  | "retrospective"
  | "diagnostic"
  | "common"
  | "differentiation"
  | "synthesis"
  | "homework";

type PreparationStatus = "pending" | "generating" | "ready" | "failed";

export interface SessionTool {
  id: SessionToolId;
  title: string;
  description: string;
  icon: ElementType;
  content: ReactNode;
  preparationStatus?: PreparationStatus;
  preparationWarning?: string | null;
  onPrepare?: () => void;
}

interface SessionToolboxProps {
  sessionId: string;
  tools: SessionTool[];
}

const STATUS_LABEL: Record<PreparationStatus, string> = {
  pending: "À préparer",
  generating: "Préparation",
  ready: "Prêt",
  failed: "Échec",
};

export default function SessionToolbox({ sessionId, tools }: SessionToolboxProps) {
  const storageKey = `session-toolbox:${sessionId}`;
  const [openTools, setOpenTools] = useState<SessionToolId[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      const availableIds = new Set(tools.map((tool) => tool.id));
      return Array.isArray(parsed)
        ? parsed.filter((id): id is SessionToolId => availableIds.has(id))
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(openTools));
  }, [openTools, storageKey]);

  const openSet = useMemo(() => new Set(openTools), [openTools]);

  const toggleTool = (toolId: SessionToolId) => {
    setOpenTools((current) =>
      current.includes(toolId)
        ? current.filter((id) => id !== toolId)
        : [...current, toolId]
    );
  };

  return (
    <section className="print:hidden space-y-4" aria-labelledby="session-toolbox-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="session-toolbox-title" className="text-lg font-semibold">
            Outils de séance
          </h2>
          <p className="text-sm text-muted-foreground">
            Ouvrez uniquement les outils utiles, dans l'ordre qui convient a la classe.
          </p>
        </div>
        {openTools.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setOpenTools([])}>
            Tout replier
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isOpen = openSet.has(tool.id);
          const status = tool.preparationStatus;
          return (
            <div
              key={tool.id}
              className={cn(
                "border bg-background p-3 transition-colors",
                isOpen && "border-primary/50 bg-primary/[0.03]"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{tool.title}</p>
                    {status && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          status === "ready" && "border-emerald-300 text-emerald-700",
                          status === "failed" && "border-destructive/40 text-destructive"
                        )}
                      >
                        {status === "generating" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        {status === "ready" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {status === "failed" && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {STATUS_LABEL[status]}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.description}</p>
                  {tool.preparationWarning && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {tool.preparationWarning}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isOpen ? "secondary" : "outline"}
                  className="flex-1 gap-1.5"
                  onClick={() => toggleTool(tool.id)}
                  aria-expanded={isOpen}
                >
                  <Play className="h-3.5 w-3.5" />
                  {isOpen ? "Masquer" : "Ouvrir"}
                </Button>
                {tool.onPrepare && status !== "ready" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    disabled={status === "generating"}
                    onClick={tool.onPrepare}
                  >
                    {status === "generating" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    {status === "failed" ? "Réessayer" : "Préparer"}
                  </Button>
                )}
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-5">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return openSet.has(tool.id) ? (
            <section key={tool.id} aria-label={tool.title} className="scroll-mt-4">
              <div className="mb-2 flex items-center gap-2 border-b pb-2">
                <Icon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{tool.title}</h3>
              </div>
              {tool.content}
            </section>
          ) : null;
        })}
      </div>
    </section>
  );
}
