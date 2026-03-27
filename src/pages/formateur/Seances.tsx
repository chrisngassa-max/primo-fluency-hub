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
import { Plus, Calendar, Loader2, BookOpen, Pencil } from "lucide-react";

const NIVEAUX = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

const getSessionBadge = (statut: string, dateSeance: string): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } => {
  if (statut === "annulee") return { label: "Annulée", variant: "destructive" };
  if (statut === "terminee") return { label: "Terminée", variant: "secondary" };
  if (statut === "en_cours") return { label: "En cours", variant: "default" };

  // For planifiee, determine based on date
  const now = new Date();
  const seanceDate = new Date(dateSeance);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const seanceDay = new Date(seanceDate.getFullYear(), seanceDate.getMonth(), seanceDate.getDate());

  if (seanceDay.getTime() === today.getTime()) return { label: "Aujourd'hui", variant: "default" };
  if (seanceDay < today) return { label: "Terminée", variant: "secondary" };
  return { label: "Planifiée", variant: "outline" };
};

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

  // Fetch sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["formateur-sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, group:groups(nom, formateur_id)")
        .order("date_seance", { ascending: false });
      if (error) throw error;
      // Filter by formateur (RLS should handle this but double check)
      return (data ?? []).filter((s: any) => s.group?.formateur_id === user!.id);
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
      // Create session
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
        })
        .select()
        .single();
      if (sErr) throw sErr;

      // Attach selected exercises
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
        })
        .eq("id", editSession.id);
      if (error) throw error;
      toast.success("Séance modifiée !");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setEditSaving(false); }
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

      {/* Sessions list */}
      {sessions && sessions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucune séance</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Créez votre première séance.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(sessions ?? []).map((s: any) => {
          const badge = getSessionBadge(s.statut, s.date_seance);
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => openEdit(s, e)}
                      title="Modifier la séance"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SeancesPage;
