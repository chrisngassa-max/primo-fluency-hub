import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_STORAGE_KEY = "primo-smart-text-hint-dismissed-v1";

function readDismissed(storageKey: string) {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

interface SmartTextHintProps {
  className?: string;
  storageKey?: string;
}

export default function SmartTextHint({
  className,
  storageKey = DEFAULT_STORAGE_KEY,
}: SmartTextHintProps) {
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey));

  useEffect(() => {
    setDismissed(readDismissed(storageKey));
  }, [storageKey]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // The hint can still disappear for the current session if storage is blocked.
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm shadow-sm",
        className
      )}
    >
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold text-foreground">Astuce de lecture</p>
        <p className="text-muted-foreground">
          Appuie sur un mot surligné pour l'écouter, choisir une langue de traduction, voir une définition simple et l'ajouter à ton carnet.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-mr-2 -mt-2 h-8 w-8 shrink-0"
        onClick={dismiss}
        aria-label="Masquer l'astuce"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
