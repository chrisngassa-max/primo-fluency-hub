import { useNavigate } from "react-router-dom";
import { AlertTriangle, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSandbox } from "@/contexts/SandboxContext";
import SandboxSwitcher from "@/components/sandbox/SandboxSwitcher";

export default function SandboxBanner() {
  const navigate = useNavigate();
  const { session, displayHint, setup, reset } = useSandbox();
  if (!displayHint && !session) return null;

  const expired = session?.statut === "expired";

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex h-12 items-center gap-2 bg-[#92400E] px-3 text-white shadow-lg">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <strong className="mr-auto text-sm">
        MODE SANDBOX {expired ? "- Session expiree" : "- Donnees de test isolees"}
      </strong>
      {expired ? (
        <Button size="sm" variant="secondary" onClick={() => void setup(false)}>
          Reactiver
        </Button>
      ) : (
        <SandboxSwitcher />
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
      <Button size="sm" variant="secondary" onClick={() => navigate("/formateur/sandbox")}>
        <XCircle className="mr-2 h-4 w-4" />
        Quitter
      </Button>
    </div>
  );
}
