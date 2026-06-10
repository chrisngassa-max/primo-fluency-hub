import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, Copy, RefreshCw, ShieldCheck, Trash2, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import SandboxCredentialsDialog from "@/components/sandbox/SandboxCredentialsDialog";
import { useSandbox, type SandboxLevel, type SandboxStudent } from "@/contexts/SandboxContext";
import { supabase } from "@/integrations/supabase/client";

export default function SandboxControlPanel() {
  const navigate = useNavigate();
  const { session, counts, loading, refresh, setup, reset, invite, exitSandboxMode } = useSandbox();
  const [credentials, setCredentials] = useState<SandboxStudent[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session?.id) return;
    const channel = supabase
      .channel(`sandbox-control-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "resultats", filter: `sandbox_session_id=eq.${session.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "devoirs", filter: `sandbox_session_id=eq.${session.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `sandbox_session_id=eq.${session.id}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh, session?.id]);

  const runSetup = async (force = false) => {
    setBusy(true);
    try {
      const students = await setup(force);
      const withPasswords = students.filter((student) => student.mot_de_passe_initial);
      if (withPasswords.length) setCredentials(withPasswords);
      toast.success(force ? "Comptes sandbox regeneres" : "Sandbox pret");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation impossible");
    } finally {
      setBusy(false);
    }
  };

  const runReset = async (scope: "attempts_only" | "sessions" | "everything") => {
    setBusy(true);
    try {
      await reset(scope);
      if (scope === "everything") await runSetup(true);
      else toast.success("Donnees sandbox effacees");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation impossible");
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async (level: SandboxLevel) => {
    try {
      await navigator.clipboard.writeText(await invite(level));
      toast.success(`Lien ${level} copie`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lien impossible");
    }
  };

  const runExit = async () => {
    setBusy(true);
    try {
      await exitSandboxMode();
      toast.success("Mode sandbox quitte. Tes donnees reelles sont a nouveau affichees.");
      navigate("/formateur");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sortie du mode sandbox impossible");
    } finally {
      setBusy(false);
    }
  };

  const expiresIn = session
    ? Math.max(0, Math.ceil((new Date(session.expires_at).getTime() - Date.now()) / 3_600_000))
    : 0;

  if (!session || session.statut === "reset") {
    return (
      <>
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Mode Sandbox</CardTitle>
            <CardDescription>Cree un groupe isole avec quatre eleves A1, A2, B1 et B2.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" disabled={busy || loading} onClick={() => void runSetup()}>
              <ShieldCheck className="mr-2 h-5 w-5" />
              Creer mon environnement sandbox
            </Button>
          </CardContent>
        </Card>
        <SandboxCredentialsDialog students={credentials} onAcknowledge={() => setCredentials([])} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mode Sandbox</h1>
          <p className="text-muted-foreground">Teste le parcours formateur et eleve sans polluer les donnees reelles.</p>
        </div>
        <Button variant="destructive" disabled={busy} onClick={() => void runExit()}>
          <XCircle className="mr-2 h-4 w-4" />
          Quitter le mode sandbox
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Statut</CardDescription><CardTitle><Badge>{session.statut}</Badge></CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Expiration</CardDescription><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" />{expiresIn} h</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Groupe</CardDescription><CardTitle className="text-lg">{session.group?.nom ?? "Sandbox"}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Comptes eleves</CardTitle>
          <CardDescription>Le mot de passe initial n'est plus recuperable. Utilise les liens rapides.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left">Niveau</th><th className="p-3 text-left">Email</th><th className="p-3 text-right">Connexion</th></tr></thead>
              <tbody>
                {(session.eleve_emails ?? []).map((student) => (
                  <tr key={student.user_id} className="border-b last:border-0">
                    <td className="p-3 font-semibold">{student.niveau}</td>
                    <td className="p-3">{student.email}</td>
                    <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => void copyInvite(student.niveau)}><Copy className="mr-2 h-4 w-4" />Lien rapide</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void runSetup(false)}><RefreshCw className="mr-2 h-4 w-4" />Prolonger de 24h</Button>
            <Button variant="outline" disabled={busy} onClick={() => void runSetup(true)}>Regenerer les comptes</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Compteurs en direct</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted p-4"><strong className="text-2xl">{counts.resultats}</strong><p className="text-sm text-muted-foreground">Resultats</p></div>
          <div className="rounded-lg bg-muted p-4"><strong className="text-2xl">{counts.devoirs}</strong><p className="text-sm text-muted-foreground">Devoirs</p></div>
          <div className="rounded-lg bg-muted p-4"><strong className="text-2xl">{counts.sessions}</strong><p className="text-sm text-muted-foreground">Sessions</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5" />Reinitialiser</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {([
            ["attempts_only", `Supprimer ${counts.resultats} resultats et ${counts.devoirs} devoirs`],
            ["sessions", `Supprimer aussi ${counts.sessions} sessions`],
            ["everything", "Tout effacer et recreer les quatre comptes"],
          ] as const).map(([scope, label]) => (
            <AlertDialog key={scope}>
              <AlertDialogTrigger asChild><Button variant={scope === "everything" ? "destructive" : "outline"} disabled={busy}>{label}</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Confirmer la reinitialisation</AlertDialogTitle><AlertDialogDescription>{label}. Les donnees reelles resteront intactes.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => void runReset(scope)}>Confirmer</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ))}
        </CardContent>
      </Card>

      <SandboxCredentialsDialog students={credentials} onAcknowledge={() => setCredentials([])} />
    </div>
  );
}
