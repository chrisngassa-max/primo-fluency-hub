import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { SandboxLevel } from "@/contexts/SandboxContext";

export type SandboxPreviewMode = "formateur" | "eleve" | "mosaic";

interface SandboxPreviewContextValue {
  mode: SandboxPreviewMode;
  niveau: SandboxLevel | null;
  enterStudentPreview: (niveau: SandboxLevel) => void;
  exitStudentPreview: () => void;
  enterMosaicView: () => void;
}

const SandboxPreviewContext = createContext<SandboxPreviewContextValue | null>(null);

export function SandboxPreviewProvider({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<SandboxPreviewMode>("formateur");
  const [niveau, setNiveau] = useState<SandboxLevel | null>(null);

  useEffect(() => {
    if (!active) {
      setMode("formateur");
      setNiveau(null);
    }
  }, [active]);

  const value = useMemo<SandboxPreviewContextValue>(() => ({
    mode,
    niveau,
    enterStudentPreview: (nextLevel) => {
      setNiveau(nextLevel);
      setMode("eleve");
    },
    exitStudentPreview: () => {
      setMode("formateur");
      setNiveau(null);
    },
    enterMosaicView: () => {
      setNiveau(null);
      setMode("mosaic");
    },
  }), [active, mode, niveau]);

  return (
    <SandboxPreviewContext.Provider value={value}>
      {children}
    </SandboxPreviewContext.Provider>
  );
}

export function useSandboxPreview() {
  const context = useContext(SandboxPreviewContext);
  if (!context) throw new Error("useSandboxPreview must be used within SandboxPreviewProvider");
  return context;
}
