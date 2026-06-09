import { useState } from "react";
import { Copy, ExternalLink, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSandbox, type SandboxLevel } from "@/contexts/SandboxContext";

const LEVELS: SandboxLevel[] = ["A1", "A2", "B1", "B2"];

export default function SandboxSwitcher() {
  const { invite } = useSandbox();
  const [link, setLink] = useState("");
  const [level, setLevel] = useState<SandboxLevel>("A1");
  const [loading, setLoading] = useState(false);

  const createLink = async (nextLevel: SandboxLevel) => {
    setLoading(true);
    try {
      setLevel(nextLevel);
      setLink(await invite(nextLevel));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de creer le lien");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary" disabled={loading}>
            <UserRound className="mr-2 h-4 w-4" />
            Basculer eleve
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {LEVELS.map((item) => (
            <DropdownMenuItem key={item} onSelect={() => void createLink(item)}>
              Eleve Test {item}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!link} onOpenChange={(open) => !open && setLink("")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lien rapide Eleve Test {level}</DialogTitle>
            <DialogDescription>
              Lien valable selon la duree OTP configuree dans Supabase Auth, annoncee ici comme 1 heure.
              Ouvre-le dans un onglet prive ou sur ton telephone.
            </DialogDescription>
          </DialogHeader>
          <div className="break-all rounded-md bg-muted p-3 text-xs">{link}</div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                toast.success("Lien copie");
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copier
            </Button>
            <Button onClick={() => window.location.assign(link)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Ouvrir ici
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
