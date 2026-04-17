import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Archive, Trash2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

type Scope = "eleve" | "group" | "session";
type Mode = "archive" | "delete";

interface CleanupDevoirsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, scope is locked to a single eleve */
  fixedEleveId?: string;
  fixedEleveName?: string;
  /** If provided, scope is locked to a single group */
  fixedGroupId?: string;
  fixedGroupName?: string;
  /** If provided, scope is locked to a previous session */
  fixedSessionId?: string;
  fixedSessionTitle?: string;
  onSuccess?: () => void;
}

export default function CleanupDevoirsDialog({
  open,
  onOpenChange,
  fixedEleveId,
  fixedEleveName,
  fixedGroupId,
  fixedGroupName,
  fixedSessionId,
  fixedSessionTitle,
  onSuccess,
}: CleanupDevoirsDialogProps) {
  const { user } = useAuth();

  // Determine initial scope
  const initialScope: Scope = fixedEleveId
    ? "eleve"
    : fixedSessionId
    ? "session"
    : "group";

  const [scope, setScope] = useState<Scope>(initialScope);
  const [mode, setMode] = useState<Mode>("archive");
  const [selectedGroupId, setSelectedGroupId] = useState<string>(fixedGroupId ?? "");
  const [selectedEleveId, setSelectedEleveId] = useState<string>(fixedEleveId ?? "");
  const [selectedSessionId, setSelectedSessionId] = useState<string>(fixedSessionId ?? "");
  const [groups, setGroups] = useState<any[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [impactCount, setImpactCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Load groups for selection
  useEffect(() => {
    if (!open || !user?.id || fixedGroupId || fixedEleveId || fixedSessionId) return;
    (async () => {
      const { data } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("formateur_id", user.id)
        .eq("is_active", true)
        .order("nom");
      setGroups(data ?? []);
    })();
  }, [open, user?.id, fixedGroupId, fixedEleveId, fixedSessionId]);

  // Load eleves for selected group when scope = eleve
  useEffect(() => {
    if (!open || scope !== "eleve" || fixedEleveId || !selectedGroupId) return;
    (async () => {
      const { data } = await supabase
        .from("group_members")
        .select("eleve_id, eleve:profiles!group_members_eleve_id_fkey(prenom, nom)")
        .eq("group_id", selectedGroupId);
      setEleves(data ?? []);
    })();
  }, [open, scope, selectedGroupId, fixedEleveId]);

  // Load previous sessions for selected group
  useEffect(() => {
    if (!open || scope !== "session" || fixedSessionId || !selectedGroupId) return;
    (async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, statut")
        .eq("group_id", selectedGroupId)
        .order("date_seance", { ascending: false })
        .limit(20);
      setSessions(data ?? []);
    })();
  }, [open, scope, selectedGroupId, fixedSessionId]);

  // Compute impact count whenever scope/target changes
  useEffect(() => {
    if (!open || !user?.id) return;
    const compute = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("devoirs")
          .select("id", { count: "exact", head: true })
          .eq("formateur_id", user.id)
          .eq("statut", "en_attente"); // assigned (in_progress not yet a status here)

        if (scope === "eleve") {
          if (!selectedEleveId) {
            setImpactCount(null);
            return;
          }
          query = query.eq("eleve_id", selectedEleveId);
        } else if (scope === "group") {
          if (!selectedGroupId) {
            setImpactCount(null);
            return;
          }
          // Resolve eleves of group
          const { data: members } = await supabase
            .from("group_members")
            .select("eleve_id")
            .eq("group_id", selectedGroupId);
          const ids = (members ?? []).map((m: any) => m.eleve_id);
          if (ids.length === 0) {
            setImpactCount(0);
            return;
          }
          query = query.in("eleve_id", ids);
        } else if (scope === "session") {
          if (!selectedSessionId) {
            setImpactCount(null);
            return;
          }
          query = query.eq("session_id", selectedSessionId);
        }

        const { count, error } = await query;
        if (error) throw error;
        setImpactCount(count ?? 0);
      } catch (e: any) {
        setImpactCount(null);
      } finally {
        setLoading(false);
      }
    };
    compute();
  }, [open, user?.id, scope, selectedEleveId, selectedGroupId, selectedSessionId]);

  const scopeLabel = useMemo(() => {
    if (scope === "eleve") {
      const name = fixedEleveName ?? eleves.find((e) => e.eleve_id === selectedEleveId)?.eleve;
      return fixedEleveName ?? (name ? `${name.prenom ?? ""} ${name.nom ?? ""}`.trim() : "Élève");
    }
    if (scope === "group") {
      return fixedGroupName ?? groups.find((g) => g.id === selectedGroupId)?.nom ?? "Groupe";
    }
    return fixedSessionTitle ?? sessions.find((s) => s.id === selectedSessionId)?.titre ?? "Séance";
  }, [scope, eleves, groups, sessions, selectedEleveId, selectedGroupId, selectedSessionId, fixedEleveName, fixedGroupName, fixedSessionTitle]);

  const canExecute =
    !executing &&
    impactCount !== null &&
    impactCount > 0 &&
    ((scope === "eleve" && (selectedEleveId || fixedEleveId)) ||
      (scope === "group" && (selectedGroupId || fixedGroupId)) ||
      (scope === "session" && (selectedSessionId || fixedSessionId)));

  const handleExecute = async () => {
    if (!user?.id) return;
    setExecuting(true);
    try {
      // Build base query to get target devoir IDs (only en_attente — never touch fait/arrete)
      let q = supabase
        .from("devoirs")
        .select("id")
        .eq("formateur_id", user.id)
        .eq("statut", "en_attente");

      if (scope === "eleve") {
        q = q.eq("eleve_id", selectedEleveId);
      } else if (scope === "group") {
        const { data: members } = await supabase
          .from("group_members")
          .select("eleve_id")
          .eq("group_id", selectedGroupId);
        const ids = (members ?? []).map((m: any) => m.eleve_id);
        if (ids.length === 0) {
          toast.info("Aucun élève dans ce groupe");
          setExecuting(false);
          return;
        }
        q = q.in("eleve_id", ids);
      } else {
        q = q.eq("session_id", selectedSessionId);
      }

      const { data: targets, error: selErr } = await q;
      if (selErr) throw selErr;
      const ids = (targets ?? []).map((t: any) => t.id);

      if (ids.length === 0) {
        toast.info("Aucun devoir non fait à nettoyer");
        setExecuting(false);
        return;
      }

      let okCount = 0;
      let errCount = 0;

      // Batch operation in chunks of 100
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        if (mode === "archive") {
          const { error } = await supabase
            .from("devoirs")
            .update({
              statut: "archive" as any,
              updated_at: new Date().toISOString(),
            })
            .in("id", chunk);
          if (error) {
            errCount += chunk.length;
            console.error("Archive error:", error);
          } else {
            okCount += chunk.length;
          }
        } else {
          const { error } = await supabase
            .from("devoirs")
            .delete()
            .in("id", chunk);
          if (error) {
            errCount += chunk.length;
            console.error("Delete error:", error);
          } else {
            okCount += chunk.length;
          }
        }
      }

      if (errCount === 0) {
        toast.success(
          mode === "archive"
            ? `${okCount} devoir(s) archivé(s)`
            : `${okCount} devoir(s) supprimé(s)`
        );
      } else {
        toast.warning(
          `${okCount} traité(s), ${errCount} en erreur. Voir la console.`
        );
      }
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erreur de nettoyage", { description: e.message });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" /> Vider les devoirs non faits
          </DialogTitle>
          <DialogDescription>
            Nettoyer les devoirs en attente pour repartir d'une page propre. Les devoirs terminés ne sont jamais touchés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scope selection (only if no fixed scope) */}
          {!fixedEleveId && !fixedSessionId && !fixedGroupId && (
            <div className="space-y-2">
              <Label>Portée du nettoyage</Label>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="group" id="scope-group" />
                  <Label htmlFor="scope-group" className="font-normal cursor-pointer">
                    Tout un groupe
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="eleve" id="scope-eleve" />
                  <Label htmlFor="scope-eleve" className="font-normal cursor-pointer">
                    Un élève précis
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="session" id="scope-session" />
                  <Label htmlFor="scope-session" className="font-normal cursor-pointer">
                    Une séance précédente
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Group selector (used by group / eleve / session scopes when not fixed) */}
          {!fixedGroupId && !fixedEleveId && !fixedSessionId && (
            <div className="space-y-2">
              <Label>Groupe</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un groupe" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nom} ({g.niveau})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Eleve selector */}
          {scope === "eleve" && !fixedEleveId && selectedGroupId && (
            <div className="space-y-2">
              <Label>Élève</Label>
              <Select value={selectedEleveId} onValueChange={setSelectedEleveId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un élève" />
                </SelectTrigger>
                <SelectContent>
                  {eleves.map((e) => (
                    <SelectItem key={e.eleve_id} value={e.eleve_id}>
                      {e.eleve?.prenom} {e.eleve?.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Session selector */}
          {scope === "session" && !fixedSessionId && selectedGroupId && (
            <div className="space-y-2">
              <Label>Séance précédente</Label>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une séance" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.titre} — {new Date(s.date_seance).toLocaleDateString("fr-FR")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Mode */}
          <div className="space-y-2">
            <Label>Mode d'action</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="archive" id="mode-archive" className="mt-1" />
                <Label htmlFor="mode-archive" className="font-normal cursor-pointer flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    <Archive className="h-4 w-4" /> Archiver (recommandé)
                  </span>
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    Soft delete : invisibles côté élève, restent disponibles pour audit.
                  </span>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="delete" id="mode-delete" className="mt-1" />
                <Label htmlFor="mode-delete" className="font-normal cursor-pointer flex-1">
                  <span className="flex items-center gap-2 font-medium text-destructive">
                    <Trash2 className="h-4 w-4" /> Supprimer définitivement
                  </span>
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    Suppression irréversible. À éviter sauf besoin spécifique.
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Impact summary */}
          <Alert className={mode === "delete" ? "border-destructive/40" : ""}>
            {mode === "delete" ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Info className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm">Portée :</span>
                  <Badge variant="outline">{scopeLabel}</Badge>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm">Devoirs impactés :</span>
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Badge
                      variant={
                        impactCount && impactCount > 0
                          ? mode === "delete"
                            ? "destructive"
                            : "default"
                          : "secondary"
                      }
                    >
                      {impactCount ?? "—"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Les devoirs terminés (statut « fait » / « arrêté ») ne sont jamais touchés.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={executing}>
            Annuler
          </Button>
          <Button
            variant={mode === "delete" ? "destructive" : "default"}
            onClick={handleExecute}
            disabled={!canExecute}
          >
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Traitement…
              </>
            ) : mode === "archive" ? (
              <>
                <Archive className="h-4 w-4 mr-2" /> Archiver {impactCount ?? 0}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" /> Supprimer {impactCount ?? 0}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
