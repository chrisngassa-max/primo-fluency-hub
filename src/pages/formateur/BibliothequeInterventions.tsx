import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  BookMarked,
  Plus,
  Pencil,
  Trash2,
  Volume2,
  Loader2,
  Play,
  Pause,
  Music,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Intervention = {
  id: string;
  formateur_id: string;
  titre: string;
  contenu_texte: string;
  type_erreur_id: string | null;
  competence: string | null;
  niveau_cible: string | null;
  voix: string;
  audio_url: string | null;
  audio_generated_at: string | null;
  created_at: string;
};

type TypeErreur = { id: string; label: string };

const COMPETENCES = ["CO", "CE", "EE", "EO"] as const;
const NIVEAUX = ["A0", "A1", "A2", "B1", "B2"] as const;
const VOIX_OPTIONS = [
  { value: "fr-FR-Standard-A", label: "Féminine (Standard)" },
  { value: "fr-FR-Standard-B", label: "Masculine (Standard)" },
  { value: "fr-FR-Wavenet-A", label: "Féminine HD" },
  { value: "fr-FR-Wavenet-B", label: "Masculine HD" },
];

const ERREUR_LABELS: Record<string, string> = {
  LEX_CONFUSION: "Lexique",
  CONSIGNE_NC: "Consigne",
  GRAM_ACCORD: "Accord",
  GRAM_TEMPS: "Temps verbal",
  HORS_SUJET: "Hors sujet",
  INTERPRETATION: "Interprétation",
  JUSTIFICATION: "Justification",
  PHONO: "Phonologie",
  PRODUCTION_COURTE: "Prod. courte",
  REGISTRE: "Registre",
  COHERENCE_ADMIN: "Cohérence admin.",
  CO_DISCRIMINATION: "Discrimination CO",
  METHODO_REPERAGE: "Repérage CE",
  STRUCT_CONJ: "Conjugaison ST",
  STRUCT_MORPHO: "Morphosyntaxe ST",
  STRUCT_CONNECTEURS: "Connecteurs",
};

const EMPTY_FORM = {
  titre: "",
  contenu_texte: "",
  type_erreur_id: "" as string,
  competence: "" as string,
  niveau_cible: "" as string,
  voix: "fr-FR-Standard-A",
};

export default function BibliothequeInterventions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Intervention | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteTarget, setDeleteTarget] = useState<Intervention | null>(null);
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);

  // Filters
  const [filterErreur, setFilterErreur] = useState<string>("all");
  const [filterComp, setFilterComp] = useState<string>("all");
  const [filterNiveau, setFilterNiveau] = useState<string>("all");

  const { data: interventions, isLoading } = useQuery({
    queryKey: ["interventions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("interventions")
        .select("*")
        .eq("formateur_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Intervention[];
    },
    enabled: !!user?.id,
  });

  const { data: typesErreur } = useQuery({
    queryKey: ["types-erreur"],
    queryFn: async () => {
      const { data } = await supabase.from("types_erreur").select("id, libelle_court").order("id");
      return (data ?? []).map((d: any) => ({ id: d.id, label: d.libelle_court })) as TypeErreur[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM & { id?: string }) => {
      const record = {
        formateur_id: user!.id,
        titre: payload.titre.trim(),
        contenu_texte: payload.contenu_texte.trim(),
        type_erreur_id: payload.type_erreur_id || null,
        competence: payload.competence || null,
        niveau_cible: payload.niveau_cible || null,
        voix: payload.voix,
      };
      if (payload.id) {
        const { error } = await supabase
          .from("interventions")
          .update(record)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("interventions").insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interventions"] });
      setDialogOpen(false);
      toast({ title: editTarget ? "Intervention modifiée" : "Intervention créée" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("interventions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interventions"] });
      setDeleteTarget(null);
      toast({ title: "Intervention supprimée" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(iv: Intervention) {
    setEditTarget(iv);
    setForm({
      titre: iv.titre,
      contenu_texte: iv.contenu_texte,
      type_erreur_id: iv.type_erreur_id ?? "",
      competence: iv.competence ?? "",
      niveau_cible: iv.niveau_cible ?? "",
      voix: iv.voix,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.titre.trim() || !form.contenu_texte.trim()) return;
    saveMutation.mutate({ ...form, id: editTarget?.id });
  }

  async function generateAudio(iv: Intervention) {
    setGeneratingAudioId(iv.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-tts", {
        body: { text: iv.contenu_texte, languageCode: "fr-FR", voiceName: iv.voix },
      });
      if (error) throw new Error(error.message);

      // data is ArrayBuffer from the edge function
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const path = `${user!.id}/${iv.id}.mp3`;

      const { error: upErr } = await supabase.storage
        .from("interventions-audio")
        .upload(path, blob, { upsert: true, contentType: "audio/mpeg" });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("interventions-audio")
        .getPublicUrl(path);

      const { error: updErr } = await supabase
        .from("interventions")
        .update({ audio_url: urlData.publicUrl, audio_generated_at: new Date().toISOString() })
        .eq("id", iv.id);
      if (updErr) throw updErr;

      qc.invalidateQueries({ queryKey: ["interventions"] });
      toast({ title: "Audio généré" });
    } catch (e: any) {
      toast({ title: "Erreur TTS", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingAudioId(null);
    }
  }

  function togglePlay(iv: Intervention) {
    if (!iv.audio_url) return;
    if (playingId === iv.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(iv.audio_url);
      audioRef.current.onended = () => setPlayingId(null);
      audioRef.current.play();
      setPlayingId(iv.id);
    }
  }

  const filtered = (interventions ?? []).filter((iv) => {
    if (filterErreur !== "all" && iv.type_erreur_id !== filterErreur) return false;
    if (filterComp !== "all" && iv.competence !== filterComp) return false;
    if (filterNiveau !== "all" && iv.niveau_cible !== filterNiveau) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <BookMarked className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-primary">
                Bibliothèque d'interventions
              </h1>
              <p className="text-sm text-muted-foreground">
                Textes et audios TTS à envoyer en 1 clic à un élève pendant l'atelier.
              </p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" /> Nouvelle intervention
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterErreur} onValueChange={setFilterErreur}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Type d'erreur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {(typesErreur ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {ERREUR_LABELS[t.id] ?? t.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterComp} onValueChange={setFilterComp}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Compétence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {COMPETENCES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterNiveau} onValueChange={setFilterNiveau}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Niveau" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {NIVEAUX.map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterErreur !== "all" || filterComp !== "all" || filterNiveau !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterErreur("all"); setFilterComp("all"); setFilterNiveau("all"); }}
          >
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <BookMarked className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {(interventions ?? []).length === 0
              ? "Aucune intervention. Créez-en une pour commencer."
              : "Aucun résultat pour ces filtres."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((iv) => (
            <Card key={iv.id} className="flex flex-col">
              <CardContent className="flex flex-col gap-3 p-4 flex-1">
                {/* Titre + actions */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight">{iv.titre}</p>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(iv)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(iv)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Texte preview */}
                <p className="text-[12px] text-muted-foreground line-clamp-3 flex-1">
                  {iv.contenu_texte}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {iv.type_erreur_id && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {ERREUR_LABELS[iv.type_erreur_id] ?? iv.type_erreur_id}
                    </Badge>
                  )}
                  {iv.competence && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/5">
                      {iv.competence}
                    </Badge>
                  )}
                  {iv.niveau_cible && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {iv.niveau_cible}
                    </Badge>
                  )}
                </div>

                {/* Audio controls */}
                <div className="flex items-center gap-2 pt-1 border-t">
                  {iv.audio_url ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-7 text-[11px]"
                      onClick={() => togglePlay(iv)}
                    >
                      {playingId === iv.id ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      {playingId === iv.id ? "Pause" : "Écouter"}
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                      <Music className="h-3 w-3" /> Pas d'audio
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-7 text-[11px] ml-auto"
                    disabled={generatingAudioId === iv.id}
                    onClick={() => generateAudio(iv)}
                  >
                    {generatingAudioId === iv.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Volume2 className="h-3 w-3" />
                    )}
                    {iv.audio_url ? "Regénérer" : "Générer audio"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog créer / éditer */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !saveMutation.isPending && setDialogOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Modifier l'intervention" : "Nouvelle intervention"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="titre">Titre</Label>
              <Input
                id="titre"
                value={form.titre}
                onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                placeholder="Ex : Encouragement LEX, Rappel vouvoiement…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contenu">Texte de l'intervention</Label>
              <Textarea
                id="contenu"
                value={form.contenu_texte}
                onChange={(e) => setForm((f) => ({ ...f, contenu_texte: e.target.value }))}
                rows={5}
                placeholder="Texte qui sera lu à l'élève via TTS…"
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                {form.contenu_texte.length} caractères — max 5 000
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type d'erreur ciblé</Label>
                <Select
                  value={form.type_erreur_id || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, type_erreur_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="(aucun)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">(aucun)</SelectItem>
                    {(typesErreur ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {ERREUR_LABELS[t.id] ?? t.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Compétence</Label>
                <Select
                  value={form.competence || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, competence: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="(toutes)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">(toutes)</SelectItem>
                    {COMPETENCES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Niveau cible</Label>
                <Select
                  value={form.niveau_cible || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, niveau_cible: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="(tous)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">(tous)</SelectItem>
                    {NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Voix TTS</Label>
                <Select
                  value={form.voix}
                  onValueChange={(v) => setForm((f) => ({ ...f, voix: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOIX_OPTIONS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saveMutation.isPending}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.titre.trim() || !form.contenu_texte.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editTarget ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'intervention ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteTarget?.titre} » sera définitivement supprimée, ainsi que son audio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
