import { useEffect, useState } from "react";
import { Download, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { syncPendingSubmissions } from "@/lib/offlineExercise";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function OfflineStatus() {
  const { user } = useAuth();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const sync = async () => {
      setOnline(true);
      setSyncing(true);
      try {
        const count = await syncPendingSubmissions(user?.id);
        if (count > 0) {
          toast.success(`${count} exercice${count > 1 ? "s" : ""} synchronisé${count > 1 ? "s" : ""}`);
        }
      } catch {
        toast.error("La synchronisation n’a pas abouti.", {
          description: "Tes réponses restent enregistrées sur cet appareil.",
        });
      } finally {
        setSyncing(false);
      }
    };
    const offline = () => setOnline(false);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("online", sync);
    window.addEventListener("offline", offline);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    if (navigator.onLine) void sync();

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", offline);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
    };
  }, [user?.id]);

  if (!online) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-amber-500 px-3 py-2 text-sm font-semibold text-black"
      >
        <WifiOff className="h-4 w-4" />
        Mode hors ligne : tes réponses sont enregistrées sur cet appareil
      </div>
    );
  }

  if (syncing) {
    return (
      <div role="status" aria-live="polite" className="sr-only">
        Connexion retrouvée. Synchronisation des réponses en cours.
      </div>
    );
  }

  if (!installPrompt) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="fixed bottom-24 right-4 z-40 gap-2 bg-white shadow-lg lg:bottom-5"
      onClick={async () => {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === "accepted") setInstallPrompt(null);
      }}
    >
      <Download className="h-4 w-4" />
      Installer CAP TCF
    </Button>
  );
}
