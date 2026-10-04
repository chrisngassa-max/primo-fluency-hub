import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AudioLines, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createPedagogicalSource,
  fetchPedagogicalSources,
  type PedagogicalSource,
} from "@/lib/pedagogicalSources";
import { humanizeStudioError } from "@/lib/studioAudioWorkflow";

function AudioImportDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (source: PedagogicalSource) => void;
}) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [rights, setRights] = useState("source_interne");
  const [licenseNote, setLicenseNote] = useState("");
  const [reusableForStudents, setReusableForStudents] = useState(false);
  const [reusableForAi, setReusableForAi] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user || !file || !title.trim()) return;
    if (!file.type.startsWith("audio/") && !file.name.toLowerCase().endsWith(".mp3")) {
      toast.error("Choisissez un fichier audio (MP3).");
      return;
    }
    setSaving(true);
    try {
      const source = await createPedagogicalSource({
        file,
        title: title.trim(),
        sourceKind: "audio",
        sourceSubtype: "document_sonore",
        pedagogicalDomains: ["CO"],
        levelMin: "A1",
        levelMax: "B2",
        themes: [],
        rightsStatus: rights,
        licenseNote,
        reusableForStudents,
        reusableForAi,
        userId: user.id,
      });
      toast.success("Audio importé.", { description: "Passez aux métadonnées et à la transcription." });
      onOpenChange(false);
      onCreated(source);
    } catch (error: any) {
      toast.error("Import impossible", { description: humanizeStudioError(error?.message) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer un audio</DialogTitle>
          <DialogDescription>
            Fichier MP3 uniquement pour le Studio. Aucun traitement payant n’est lancé à l’import.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="studio-audio-file">Fichier audio</Label>
            <Input
              id="studio-audio-file"
              type="file"
              accept="audio/*,.mp3"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                if (next) setTitle((prev) => prev || next.name.replace(/\.[^.]+$/, ""));
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="studio-audio-title">Titre</Label>
            <Input id="studio-audio-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="studio-audio-rights">Droits</Label>
            <Input id="studio-audio-rights" value={rights} onChange={(event) => setRights(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="studio-audio-license">Note de licence</Label>
            <Textarea id="studio-audio-license" value={licenseNote} onChange={(event) => setLicenseNote(event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={reusableForStudents} onCheckedChange={(v) => setReusableForStudents(v === true)} />
            Réutilisable pour les élèves
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={reusableForAi} onCheckedChange={(v) => setReusableForAi(v === true)} />
            Réutilisable pour la génération IA
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={saving || !file || !title.trim()} onClick={submit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function StudioAudioPage() {
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);
  const { data: sources = [], isLoading, error } = useQuery({
    queryKey: ["pedagogical-sources", "audio-studio"],
    queryFn: () => fetchPedagogicalSources({ kind: "audio" }),
  });

  const audioSources = useMemo(
    () => sources.filter((source) => source.source_kind === "audio"),
    [sources],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <AudioLines className="h-6 w-6" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Studio audio</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Parcours guidé : importer un MP3, confirmer les faits, générer A1–B2, publier, puis ajouter les
          exercices à une séance — sans PowerShell ni commandes Supabase.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setImportOpen(true)} aria-label="Importer un nouvel audio">
          <Plus className="mr-2 h-4 w-4" />Importer un audio
        </Button>
        <Button variant="outline" asChild>
          <Link to="/formateur/sources-pedagogiques">Sources pédagogiques (hub)</Link>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {humanizeStudioError((error as Error).message)}
        </p>
      )}

      <section aria-label="Reprendre un travail existant" className="space-y-3">
        <h2 className="text-lg font-medium">Reprendre un travail existant</h2>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Chargement" />
        ) : audioSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune source audio. Importez un MP3 pour commencer.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {audioSources.map((source) => (
              <Card key={source.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{source.title}</CardTitle>
                  <CardDescription>
                    {source.status} · {source.review_status}
                    {source.rights_status ? ` · ${source.rights_status}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/formateur/studio-audio/${source.id}`)}
                    aria-label={`Reprendre ${source.title}`}
                  >
                    Reprendre
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <AudioImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onCreated={(source) => navigate(`/formateur/studio-audio/${source.id}`)}
      />
    </div>
  );
}
