import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Wand2, CheckCircle2, Copy, Volume2, Image, Video, ChevronDown, ChevronUp, Minus, Plus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface ImportFromUrlDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId?: string;
  onExerciseCreated?: (exercise: any) => void;
}

const COMPETENCES = [
  { value: "CO", label: "CO — Compréhension Orale" },
  { value: "CE", label: "CE — Compréhension Écrite" },
  { value: "EE", label: "EE — Expression Écrite" },
  { value: "EO", label: "EO — Expression Orale" },
];

const NIVEAUX = ["A0", "A1", "A2", "B1", "B2"];

const FORMATS = [
  { value: "qcm", label: "QCM" },
  { value: "vrai_faux", label: "Vrai / Faux" },
  { value: "texte_lacunaire", label: "Texte lacunaire" },
  { value: "appariement", label: "Appariement" },
  { value: "production_ecrite", label: "Production écrite" },
];

type Step = "form" | "loading" | "preview" | "duplicate_loading";
type DifficultyAdjust = "easier" | "harder" | null;
type LengthAdjust = "shorter" | "longer" | null;

export default function ImportFromUrlDialog({ open, onClose, sessionId, onExerciseCreated }: ImportFromUrlDialogProps) {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [competence, setCompetence] = useState("");
  const [niveau, setNiveau] = useState("A1");
  const [targetFormat, setTargetFormat] = useState("qcm");
  const [treatment, setTreatment] = useState<"extract" | "reconfigure">("reconfigure");
  const [step, setStep] = useState<Step>("form");
  const [preview, setPreview] = useState<any>(null);
  const [detectedMedia, setDetectedMedia] = useState<{ type: "image" | "audio" | "video"; url: string; alt?: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [difficultyAdjust, setDifficultyAdjust] = useState<DifficultyAdjust>(null);
  const [lengthAdjust, setLengthAdjust] = useState<LengthAdjust>(null);
  const [showMediaDetails, setShowMediaDetails] = useState(false);

  const isValidUrl = (str: string) => {
    try { new URL(str); return true; } catch { return false; }
  };

  const handleGenerate = async () => {
    if (!isValidUrl(url)) { toast.error("L'URL n'est pas valide"); return; }
    setStep("loading");

    const { data, error } = await supabase.functions.invoke("smart-exercise-generator", {
      body: {
        mode: "import",
        sourceUrl: url,
        treatment,
        targetFormat: treatment === "reconfigure" ? targetFormat : undefined,
        competence: competence || undefined,
        niveau,
        niveau_depart: niveau,
        niveau_arrivee: "B1",
      },
    });

    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Erreur lors de l'analyse");
      setStep("form");
      return;
    }

    setPreview(data.exercise);
    setDetectedMedia(data.detectedMedia ?? []);
    setStep("preview");
  };

  const handleDuplicate = async () => {
    if (!preview) return;
    setStep("duplicate_loading");

    const { data, error } = await supabase.functions.invoke("smart-exercise-generator", {
      body: {
        mode: "import",
        duplicateFrom: preview,
        difficultyAdjust,
        lengthAdjust,
        niveau,
        niveau_depart: niveau,
        niveau_arrivee: "B1",
      },
    });

    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Erreur lors de la duplication");
      setStep("preview");
      return;
    }

    setPreview(data.exercise);
    setDifficultyAdjust(null);
    setLengthAdjust(null);
    setStep("preview");
    toast.success("Variante générée");
  };

  const handleSave = async () => {
    if (!preview || !user) return;
    setSaving(true);

    // Find a default point_a_maitriser
    const { data: defaultPoint } = await supabase
      .from("points_a_maitriser")
      .select("id")
      .limit(1)
      .single();

    if (!defaultPoint) {
      toast.error("Aucun point à maîtriser trouvé. Importez d'abord un programme.");
      setSaving(false);
      return;
    }

    const { data: ex, error } = await supabase
      .from("exercices")
      .insert({
        titre: preview.titre,
        consigne: preview.consigne,
        competence: preview.competence,
        format: preview.format,
        niveau_vise: preview.niveau_vise,
        difficulte: preview.difficulte ?? 2,
        contenu: preview.contenu,
        formateur_id: user.id,
        animation_guide: preview.metadata ?? null,
        point_a_maitriser_id: defaultPoint.id,
        is_ai_generated: true,
      } as any)
      .select()
      .single();

    setSaving(false);
    if (error) { toast.error("Erreur lors de la sauvegarde"); console.error(error); return; }

    if (sessionId && ex) {
      const { data: existing } = await supabase
        .from("session_exercices")
        .select("ordre")
        .eq("session_id", sessionId)
        .order("ordre", { ascending: false })
        .limit(1);

      await supabase.from("session_exercices").insert({
        session_id: sessionId,
        exercice_id: ex.id,
        ordre: (existing?.[0]?.ordre ?? 0) + 1,
        statut: "planifie",
      });
      toast.success("Exercice importé et ajouté à la séance");
    } else {
      toast.success("Exercice importé dans la banque");
    }

    onExerciseCreated?.(ex);
    handleClose();
  };

  const handleClose = () => {
    setUrl(""); setCompetence(""); setNiveau("A1"); setTargetFormat("qcm");
    setTreatment("reconfigure"); setStep("form"); setPreview(null);
    setDetectedMedia([]); setDifficultyAdjust(null); setLengthAdjust(null);
    onClose();
  };

  const mediaIcons: Record<string, typeof Image> = { image: Image, audio: Volume2, video: Video };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Importer depuis un lien
          </DialogTitle>
          <DialogDescription>
            Colle le lien d'un exercice en ligne — l'IA détecte le texte, les images et les audios, puis génère un exercice TCF calibré.
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — Form */}
        {step === "form" && (
          <div className="space-y-4">
            <div>
              <Label>Lien de la page</Label>
              <Input placeholder="https://exemple.com/exercice-fle" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Compétence</Label>
                <Select value={competence} onValueChange={setCompetence}>
                  <SelectTrigger><SelectValue placeholder="Auto-détection" /></SelectTrigger>
                  <SelectContent>
                    {COMPETENCES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Niveau visé</Label>
                <Select value={niveau} onValueChange={setNiveau}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NIVEAUX.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Traitement IA</Label>
              <Select value={treatment} onValueChange={(v) => setTreatment(v as "extract" | "reconfigure")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reconfigure">Reconfigurer en exercice TCF IRN (recommandé)</SelectItem>
                  <SelectItem value="extract">Extraire l'exercice tel quel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {treatment === "reconfigure" && (
              <div>
                <Label>Format souhaité</Label>
                <Select value={targetFormat} onValueChange={setTargetFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={handleGenerate} className="w-full gap-2" disabled={!url.trim()}>
              <Wand2 className="h-4 w-4" /> Analyser et transformer
            </Button>
          </div>
        )}

        {/* STEP 2 — Loading */}
        {(step === "loading" || step === "duplicate_loading") && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">
                {step === "duplicate_loading"
                  ? "Génération de la variante en cours…"
                  : "L'IA analyse la page, détecte les médias et génère l'exercice…"
                }
              </p>
              <p className="text-sm text-muted-foreground mt-1">Cela peut prendre 10-15 secondes</p>
            </div>
          </div>
        )}

        {/* STEP 3 — Preview */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Exercice généré</span>
            </div>

            {/* Exercise preview */}
            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <div className="flex flex-wrap gap-2">
                <Badge>{preview.competence}</Badge>
                <Badge variant="outline">{preview.niveau_vise}</Badge>
                <Badge variant="secondary">{preview.format}</Badge>
                {preview.difficulte && <Badge variant="outline">Difficulté {preview.difficulte}/5</Badge>}
              </div>
              <h3 className="font-semibold text-lg">{preview.titre}</h3>
              <p className="text-sm text-muted-foreground">{preview.consigne}</p>
              {preview.contenu?.items?.length > 0 && (
                <p className="text-xs text-muted-foreground">{preview.contenu.items.length} question(s)</p>
              )}
              {preview.metadata?.code && (
                <p className="text-xs font-mono text-muted-foreground">Code TCF : {preview.metadata.code}</p>
              )}
              {(preview.contenu?.image_url || preview.contenu?.script_audio_url) && (
                <div className="flex gap-2 pt-1">
                  {preview.contenu.image_url && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Image className="h-3 w-3" /> Image incluse
                    </Badge>
                  )}
                  {preview.contenu.script_audio_url && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Volume2 className="h-3 w-3" /> Audio inclus
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Detected media */}
            {detectedMedia.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2">
                <button
                  onClick={() => setShowMediaDetails(!showMediaDetails)}
                  className="flex items-center justify-between w-full text-sm font-medium"
                >
                  <span className="flex items-center gap-2">
                    {detectedMedia.some(m => m.type === "image") && <Image className="h-4 w-4" />}
                    {detectedMedia.some(m => m.type === "audio") && <Volume2 className="h-4 w-4" />}
                    {detectedMedia.some(m => m.type === "video") && <Video className="h-4 w-4" />}
                    {detectedMedia.length} média(s) détecté(s) sur la page
                  </span>
                  {showMediaDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showMediaDetails && (
                  <div className="space-y-1 pt-1">
                    {detectedMedia.slice(0, 5).map((m, i) => {
                      const Icon = mediaIcons[m.type] ?? Image;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                          <Icon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{m.alt || m.url.split("/").pop() || m.url}</span>
                        </div>
                      );
                    })}
                    {detectedMedia.length > 5 && (
                      <p className="text-xs text-muted-foreground">…et {detectedMedia.length - 5} autre(s)</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Duplication controls */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Copy className="h-4 w-4" /> Générer une variante
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Difficulté</Label>
                  <div className="flex gap-1 mt-1">
                    <Button
                      size="sm" variant={difficultyAdjust === "easier" ? "default" : "outline"}
                      onClick={() => setDifficultyAdjust(difficultyAdjust === "easier" ? null : "easier")}
                      className="flex-1 gap-1 text-xs"
                    >
                      <Minus className="h-3 w-3" /> Plus facile
                    </Button>
                    <Button
                      size="sm" variant={difficultyAdjust === "harder" ? "default" : "outline"}
                      onClick={() => setDifficultyAdjust(difficultyAdjust === "harder" ? null : "harder")}
                      className="flex-1 gap-1 text-xs"
                    >
                      <Plus className="h-3 w-3" /> Plus dur
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Longueur</Label>
                  <div className="flex gap-1 mt-1">
                    <Button
                      size="sm" variant={lengthAdjust === "shorter" ? "default" : "outline"}
                      onClick={() => setLengthAdjust(lengthAdjust === "shorter" ? null : "shorter")}
                      className="flex-1 gap-1 text-xs"
                    >
                      <Minus className="h-3 w-3" /> Court
                    </Button>
                    <Button
                      size="sm" variant={lengthAdjust === "longer" ? "default" : "outline"}
                      onClick={() => setLengthAdjust(lengthAdjust === "longer" ? null : "longer")}
                      className="flex-1 gap-1 text-xs"
                    >
                      <Plus className="h-3 w-3" /> Long
                    </Button>
                  </div>
                </div>
              </div>
              <Button onClick={handleDuplicate} variant="secondary" className="w-full gap-2">
                <Wand2 className="h-4 w-4" /> Générer cette variante
              </Button>
            </div>

            {/* Final actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("form")} className="flex-1">
                Modifier
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {sessionId ? "Ajouter à la séance" : "Sauvegarder"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
