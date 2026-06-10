import { useNavigate } from "react-router-dom";
import { AlertTriangle, Grid2X2, RotateCcw, UserCog, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSandbox } from "@/contexts/SandboxContext";
import SandboxSwitcher from "@/components/sandbox/SandboxSwitcher";
import { useSandboxPreview } from "@/contexts/SandboxPreviewContext";

const LEVELS = ["A1", "A2", "B1", "B2"] as const;

export default function SandboxBanner() {
  const navigate = useNavigate();
  const { session, displayHint, setup, reset, exitSandboxMode } = useSandbox();
  const {
    mode,
    niveau,
    enterStudentPreview,
    exitStudentPreview,
    enterMosaicView,
  } = useSandboxPreview();
  if (!displayHint || !session) return null;

  const expired = session?.statut === "expired";

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex h-12 items-center gap-2 overflow-x-auto bg-[#92400E] px-3 text-white shadow-lg">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <strong className="shrink-0 text-sm">
        MODE SANDBOX {expired ? "- Session expiree" : "- Donnees de test isolees"}
      </strong>
      {expired ? (
        <Button size="sm" variant="secondary" onClick={() => void setup(false)}>
          Reactiver
        </Button>
      ) : (
        <>
          <div className="ml-auto flex shrink-0 items-center gap-1 rounded-md bg-black/15 p-1">
            <Button
              size="sm"
              variant={mode === "formateur" ? "default" : "secondary"}
              disabled={mode === "formateur"}
              onClick={exitStudentPreview}
            >
              <UserCog className="mr-1 h-4 w-4" />
              Formateur
            </Button>
            {LEVELS.map((level) => (
              <Button
                key={level}
                size="sm"
                variant={mode === "eleve" && niveau === level ? "default" : "secondary"}
                disabled={mode === "eleve" && niveau === level}
                onClick={() => enterStudentPreview(level)}
              >
                {level}
              </Button>
            ))}
            <Button
              size="sm"
              variant={mode === "mosaic" ? "default" : "secondary"}
              disabled={mode === "mosaic"}
              onClick={enterMosaicView}
            >
              <Grid2X2 className="mr-1 h-4 w-4" />
              Mosaique
            </Button>
          </div>
          <SandboxSwitcher />
        </>
      )}
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await reset("attempts_only");
            toast.success("Resultats et devoirs sandbox effaces");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Echec de la reinitialisation");
          }
        }}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Reinitialiser
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          exitStudentPreview();
          exitSandboxMode();
          toast.success("Sortie du mode sandbox. Tes donnees reelles sont a nouveau affichees.");
          navigate("/formateur");
        }}
      >
        <XCircle className="mr-2 h-4 w-4" />
        Quitter
      </Button>

    </div>
  );
}
