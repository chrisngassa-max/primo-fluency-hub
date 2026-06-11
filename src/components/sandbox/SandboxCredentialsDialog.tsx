import { useEffect, useState } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SandboxStudent } from "@/contexts/SandboxContext";

export default function SandboxCredentialsDialog({
  students,
  onAcknowledge,
}: {
  students: SandboxStudent[];
  onAcknowledge: () => void;
}) {
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    if (!students.length) return;
    setSeconds(5);
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [students]);

  const download = () => {
    const text = students
      .map((student) => `${student.niveau}\t${student.display_name}\t${student.email}\t${student.mot_de_passe_initial}`)
      .join("\n");
    const url = URL.createObjectURL(new Blob([`Niveau\tNom\tEmail\tMot de passe\n${text}\n`], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "identifiants-sandbox.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={students.length > 0}>
      <DialogContent
        className="max-w-3xl border-amber-500 bg-amber-50"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-950">
            <ShieldAlert className="h-5 w-5" />
            Mots de passe affiches une seule fois
          </DialogTitle>
          <DialogDescription>
            Ils ne sont enregistres ni dans la base ni dans le navigateur.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/60"><th className="p-3 text-left">Niveau</th><th className="p-3 text-left">Nom</th><th className="p-3 text-left">Email</th><th className="p-3 text-left">Mot de passe</th></tr></thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.user_id} className="border-b last:border-0">
                  <td className="p-3 font-semibold">{student.niveau}</td>
                  <td className="p-3 font-medium">{student.display_name}</td>
                  <td className="p-3">{student.email}</td>
                  <td className="p-3 font-mono">{student.mot_de_passe_initial}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-amber-950">
          Si tu fermes sans les noter, utilise Regenerer les comptes pour en creer de nouveaux.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={download}>
            <Download className="mr-2 h-4 w-4" />
            Telecharger identifiants.txt
          </Button>
          <Button disabled={seconds > 0} onClick={onAcknowledge}>
            {seconds > 0 ? `Continuer dans ${seconds}s` : "J'ai note ou telecharge - Continuer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
