import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Calendar, Loader2, BookOpen, Pencil, Copy, Rocket, Trash2, Route, ArrowRight, Target, Clock } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { COMPETENCES_ORDER, COMPETENCE_COLORS, resolveSessionCompetences } from "@/lib/competences";

const NIVEAUX = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

const getSessionBadge = (statut: string, dateSeance: string): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } => {
  if (statut === "annulee") return { label: "Annulée", variant: "destructive" };
  if (statut === "terminee") return { label: "Terminée", variant: "secondary" };
  if (statut === "en_cours") return { label: "En cours", variant: "default" };

  const now = new Date();
  const seanceDate = new Date(dateSeance);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const seanceDay = new Date(seanceDate.getFullYear(), seanceDate.getMonth(), seanceDate.getDate());

  if (seanceDay.getTime() === today.getTime()) return { label: "Aujourd'hui", variant: "default" };
  if (seanceDay < today) return { label: "Terminée", variant: "secondary" };
  return { label: "Planifiée", variant: "outline" };
};

/** Toggle a competence in a Set-like array */
const toggleComp = (comps: string[], comp: string): string[] =>
  comps.includes(comp) ? comps.filter((c) => c !== comp) : [...comps, comp];

/** Competence multi-select UI block */
const CompetenceMultiSelect = ({
  value,
  onChange,
  label = "Compétences TCF ciblées",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  label?: string;
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="flex flex-wrap gap-2">
      {COMPETENCES_ORDER.map((c) => {
        const selected = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(toggleComp(value, c))}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              selected
                ? `${COMPETENCE_COLORS[c]} border-current ring-1 ring-current/30`
                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  </div>
);

const SeancesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titre, setTitre] = useState("");
  const [groupId, setGroupId] = useState("");
  const [dateSeance, setDateSeance] = useState("");
  const [niveauCible, setNiveauCible] = useState("A2");
  const [objectifs, setObjectifs] = useState("");
  const [dureeMinutes, setDureeMinutes] = useState("90");
  const [lieu, setLieu] = useState("");
  const [competencesCibles, setCompetencesCibles] = useState<string[]>([]);

  // Delete state
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  // Sequence attachment
  const [selectedSequenceId, setSelectedSequenceId] = useState("");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());

  // Fetch groups
  const { data: groups } = useQuery({
    queryKey: ["formateur-groups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups").select("id, nom, niveau")
        .eq("formateur_id", user!.id).eq("is_active", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch sessions with exercise competences for fallback
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["formateur-sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, group:groups(nom, formateur_id)")
        .order("date_seance", { ascending: false });
      if (error) throw error;
      const filtered = (data ?? []).filter((s: any) => s.group?.formateur_id === user!.id);

      // Fetch exercise competences for sessions without competences_cibles
      const sessionIds = filtered.map((s: any) => s.id);
      if (sessionIds.length === 0) return filtered;

      const { data: seLinks } = await supabase
        .from("session_exercices")
        .select("session_id, exercice:exercices(competence)")
        .in("session_id", sessionIds);

      const exerciseCompsBySession: Record<string, string[]> = {};
      for (const link of seLinks ?? []) {
        const comp = (link as any).exercice?.competence;
        if (comp) {
          if (!exerciseCompsBySession[link.session_id]) exerciseCompsBySession[link.session_id] = [];
          exerciseCompsBySession[link.session_id].push(comp);
        }
      }

      return filtered.map((s: any) => ({
        ...s,
        _resolvedComps: resolveSessionCompetences(
          (s as any).competences_cibles,
          exerciseCompsBySession[s.id] || []
        ),
      }));
    },
    enabled: !!user,
  });

  // Fetch sequences for attachment
  const { data: sequences } = useQuery({
    queryKey: ["formateur-sequences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sequences_pedagogiques").select("id, titre")
        .eq("formateur_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && createOpen,
  });

  // Fetch exercises for selected sequence
  const { data: sequenceExercises } = useQuery({
    queryKey: ["sequence-exercises", selectedSequenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices").select("id, titre, competence, format")
        .eq("sequence_id", selectedSequenceId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSequenceId,
  });

  const toggleExercise = (id: string) => {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllExercises = () => {
    if (!sequenceExercises) return;
    const allSelected = sequenceExercises.every((e) => selectedExerciseIds.has(e.id));
    if (allSelected) {
      setSelectedExerciseIds(new Set());
    } else {
      setSelectedExerciseIds(new Set(sequenceExercises.map((e) => e.id)));
    }
  };

  const handleCreate = async () => {
    if (!titre.trim()) { toast.error("Le titre est obligatoire."); return; }
    if (!groupId) { toast.error("Sélectionnez un groupe."); return; }
    if (!dateSeance) { toast.error("Choisissez une date."); return; }

    setSaving(true);
    try {
      const { data: session, error: sErr } = await supabase
        .from("sessions")
        .insert({
          titre,
          group_id: groupId,
          date_seance: new Date(dateSeance).toISOString(),
          niveau_cible: niveauCible as any,
          objectifs: objectifs || null,
          duree_minutes: parseInt(dureeMinutes) || 90,
          lieu: lieu || null,
          competences_cibles: competencesCibles.length > 0 ? competencesCibles : null,
        } as any)
        .select()
        .single();
      if (sErr) throw sErr;

      if (selectedExerciseIds.size > 0) {
        const sessionExercises = Array.from(selectedExerciseIds).map((exId, i) => ({
          session_id: session.id,
          exercice_id: exId,
          ordre: i + 1,
        }));
        const { error: seErr } = await supabase.from("session_exercices").insert(sessionExercises);
        if (seErr) throw seErr;
      }

      toast.success("Séance créée !", {
        description: selectedExerciseIds.size > 0
          ? `${selectedExerciseIds.size} exercice(s) rattaché(s).`
          : "Aucun exercice rattaché.",
      });
      setCreateOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setTitre(""); setGroupId(""); setDateSeance(""); setNiveauCible("A2");
    setObjectifs(""); setDureeMinutes("90"); setLieu("");
    setSelectedSequenceId(""); setSelectedExerciseIds(new Set());
    setCompetencesCibles([]);
  };

  // ── Edit session state ──
  const [editOpen, setEditOpen] = useState(false);
  const [editSession, setEditSession] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editGroupId, setEditGroupId] = useState("");
  const [editTitre, setEditTitre] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNiveau, setEditNiveau] = useState("A2");
  const [editDuree, setEditDuree] = useState("90");
  const [editLieu, setEditLieu] = useState("");
  const [editObjectifs, setEditObjectifs] = useState("");
  const [editStatut, setEditStatut] = useState("planifiee");
  const [editCompetences, setEditCompetences] = useState<string[]>([]);

  // ── Duplicate session state ──
  const [dupOpen, setDupOpen] = useState(false);
  const [dupSession, setDupSession] = useState<any>(null);
  const [dupGroupId, setDupGroupId] = useState("");
  const [dupDate, setDupDate] = useState("");
  const [dupSaving, setDupSaving] = useState(false);

  const openDuplicate = (s: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setDupSession(s);
    setDupGroupId("");
    setDupDate("");
    setDupOpen(true);
  };

  const handleDuplicate = async () => {
    if (!dupSession || !dupGroupId || !dupDate) {
      toast.error("Choisissez un groupe et une date.");
      return;
    }
    setDupSaving(true);
    try {
      const { data: newSession, error: sErr } = await supabase
        .from("sessions")
        .insert({
          titre: dupSession.titre,
          group_id: dupGroupId,
          date_seance: new Date(dupDate).toISOString(),
          niveau_cible: dupSession.niveau_cible,
          objectifs: dupSession.objectifs,
          duree_minutes: dupSession.duree_minutes,
          lieu: dupSession.lieu,
          competences_cibles: (dupSession as any).competences_cibles || null,
        } as any)
        .select()
        .single();
      if (sErr) throw sErr;

      const { data: srcExercises } = await supabase
        .from("session_exercices")
        .select("exercice_id, ordre")
        .eq("session_id", dupSession.id)
        .order("ordre");

      if (srcExercises && srcExercises.length > 0) {
        const newExercises = srcExercises.map((se: any) => ({
          session_id: newSession.id,
          exercice_id: se.exercice_id,
          ordre: se.ordre,
        }));
        const { error: seErr } = await supabase.from("session_exercices").insert(newExercises);
        if (seErr) throw seErr;
      }

      const targetGroup = (groups ?? []).find((g) => g.id === dupGroupId);
      toast.success("Séance dupliquée !", {
        description: `Pour le groupe ${targetGroup?.nom || ""} avec ${srcExercises?.length || 0} exercice(s).`,
      });
      setDupOpen(false);
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setDupSaving(false);
    }
  };

  const openEdit = (s: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditSession(s);
    setEditGroupId(s.group_id);
    setEditTitre(s.titre);
    setEditDate(new Date(s.date_seance).toISOString().slice(0, 16));
    setEditNiveau(s.niveau_cible);
    setEditDuree(String(s.duree_minutes));
    setEditLieu(s.lieu ?? "");
    setEditObjectifs(s.objectifs ?? "");
    setEditStatut(s.statut);
    setEditCompetences((s as any).competences_cibles || []);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editTitre.trim()) { toast.error("Le titre est obligatoire."); return; }
    if (!editGroupId) { toast.error("Sélectionnez un groupe."); return; }
    if (!editDate) { toast.error("Choisissez une date."); return; }

    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .update({
          titre: editTitre,
          group_id: editGroupId,
          date_seance: new Date(editDate).toISOString(),
          niveau_cible: editNiveau as any,
          duree_minutes: parseInt(editDuree) || 90,
          lieu: editLieu || null,
          objectifs: editObjectifs || null,
          statut: editStatut as any,
          competences_cibles: editCompetences.length > 0 ? editCompetences : null,
        } as any)
        .eq("id", editSession.id);
      if (error) throw error;
      toast.success("Séance modifiée !");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setEditSaving(false); }
  };

  const handleDeleteSession = async () => {
    if (!deleteSessionId) return;
    try {
      await supabase.from("session_exercices").delete().eq("session_id", deleteSessionId);
      const { error } = await supabase.from("sessions").delete().eq("id", deleteSessionId);
      if (error) throw error;
      toast.success("Séance supprimée");
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setDeleteSessionId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Séances</h1>
          <p className="text-sm text-muted-foreground">Planifiez et gérez vos séances.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nouvelle séance</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Planifier une séance</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex: Séance 1 — Vie quotidienne" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Groupe</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>
                      {(groups ?? []).map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.nom} ({g.niveau})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Niveau cible</Label>
                  <Select value={niveauCible} onValueChange={setNiveauCible}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Competences TCF */}
              <CompetenceMultiSelect value={competencesCibles} onChange={setCompetencesCibles} />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date et heure</Label>
                  <Input type="datetime-local" value={dateSeance} onChange={(e) => setDateSeance(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Durée (min)</Label>
                  <Input type="number" value={dureeMinutes} onChange={(e) => setDureeMinutes(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lieu (optionnel)</Label>
                <Input value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Salle A3 / Lien Zoom" />
              </div>
              <div className="space-y-2">
                <Label>Objectifs (optionnel)</Label>
                <Textarea value={objectifs} onChange={(e) => setObjectifs(e.target.value)} rows={2} placeholder="Ce que les élèves doivent maîtriser..." />
              </div>

              {/* Exercise attachment */}
              <div className="space-y-3 border-t pt-4">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Rattacher des exercices
                </Label>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Depuis une séquence existante</Label>
                  <Select value={selectedSequenceId} onValueChange={(v) => {
                    setSelectedSequenceId(v);
                    setSelectedExerciseIds(new Set());
                  }}>
                    <SelectTrigger><SelectValue placeholder="Choisir une séquence..." /></SelectTrigger>
                    <SelectContent>
                      {(sequences ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.titre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {sequenceExercises && sequenceExercises.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{sequenceExercises.length} exercice(s)</span>
                      <button onClick={selectAllExercises} className="text-xs text-primary hover:underline">
                        {sequenceExercises.every((e) => selectedExerciseIds.has(e.id)) ? "Tout désélectionner" : "Tout sélectionner"}
                      </button>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
                      {sequenceExercises.map((ex) => (
                        <label key={ex.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={selectedExerciseIds.has(ex.id)}
                            onCheckedChange={() => toggleExercise(ex.id)}
                          />
                          <span className="text-sm flex-1">{ex.titre}</span>
                          <Badge variant="secondary" className="text-[10px]">{ex.competence}</Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer la séance
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit session dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier la séance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={editTitre} onChange={(e) => setEditTitre(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Groupe</Label>
                <Select value={editGroupId} onValueChange={setEditGroupId}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {(groups ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.nom} ({g.niveau})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Niveau cible</Label>
                <Select value={editNiveau} onValueChange={setEditNiveau}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Competences TCF */}
            <CompetenceMultiSelect value={editCompetences} onChange={setEditCompetences} />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date et heure</Label>
                <Input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Durée (min)</Label>
                <Input type="number" value={editDuree} onChange={(e) => setEditDuree(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lieu (optionnel)</Label>
              <Input value={editLieu} onChange={(e) => setEditLieu(e.target.value)} placeholder="Salle A3 / Lien Zoom" />
            </div>
            <div className="space-y-2">
              <Label>Objectifs (optionnel)</Label>
              <Textarea value={editObjectifs} onChange={(e) => setEditObjectifs(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={editStatut} onValueChange={setEditStatut}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planifiee">Planifiée</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="terminee">Terminée</SelectItem>
                  <SelectItem value="annulee">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate session dialog */}
      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Dupliquer la séance</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            « {dupSession?.titre} » — les exercices seront copiés automatiquement.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Groupe cible</Label>
              <Select value={dupGroupId} onValueChange={setDupGroupId}>
                <SelectTrigger><SelectValue placeholder="Choisir un groupe..." /></SelectTrigger>
                <SelectContent>
                  {(groups ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.nom} ({g.niveau})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date et heure</Label>
              <Input type="datetime-local" value={dupDate} onChange={(e) => setDupDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupOpen(false)}>Annuler</Button>
            <Button onClick={handleDuplicate} disabled={dupSaving}>
              {dupSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Dupliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sessions list */}
      {sessions && sessions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucune séance</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Créez votre première séance.</p>
            <Button onClick={() => setCreateOpen(true)} className="mt-4"><Plus className="h-4 w-4 mr-2" />Créer ma première séance</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(sessions ?? []).map((s: any) => {
          const badge = getSessionBadge(s.statut, s.date_seance);
          const comps: string[] = s._resolvedComps || [];
          return (
            <Card key={s.id} className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => navigate(`/formateur/seances/${s.id}/pilote`)}>
              <CardContent className="py-4 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{s.titre}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.group?.nom} · {new Date(s.date_seance).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      {comps.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {comps.map((c) => (
                            <span key={c} className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${COMPETENCE_COLORS[c] || ""}`}>
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                   <div className="flex items-center gap-1 shrink-0">
                     <Button
                       variant="default"
                       size="sm"
                       className="gap-1.5 h-8"
                       onClick={(e) => { e.stopPropagation(); navigate(`/formateur/seances/${s.id}/pilote`); }}
                       title="Piloter la séance"
                     >
                       <Rocket className="h-3.5 w-3.5" /> Piloter
                     </Button>
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-8 w-8"
                       onClick={(e) => openDuplicate(s, e)}
                       title="Dupliquer pour un autre groupe"
                     >
                       <Copy className="h-4 w-4" />
                     </Button>
                     <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => openEdit(s, e)}
                        title="Modifier la séance"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteSessionId(s.id); }}
                        title="Supprimer la séance"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                     <Badge variant={badge.variant}>{badge.label}</Badge>
                   </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={(v) => { if (!v) setDeleteSessionId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer cette séance ? Les exercices rattachés seront également détachés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SeancesPage;
