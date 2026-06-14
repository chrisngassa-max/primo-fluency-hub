import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, FileText, Link2, Loader2, Save, Upload, Wand2 } from "lucide-react";

interface ImportFromUrlDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId?: string;
  defaultSourceMode?: SourceMode;
  onExerciseCreated?: (exercise: any) => void;
}

type SourceMode = "url" | "pdf";
type Destination = "bank" | "session" | "diagnostic" | "homework";
type Step = "form" | "analyzing" | "generating" | "preview" | "saving";

const COMPETENCES = [
  { value: "auto", label: "Detection automatique" },
  { value: "CO", label: "CO - Comprehension orale" },
  { value: "CE", label: "CE - Comprehension ecrite" },
  { value: "EE", label: "EE - Expression ecrite" },
  { value: "EO", label: "EO - Expression orale" },
  { value: "Structures", label: "Structures - Grammaire et vocabulaire" },
];

const NIVEAUX = ["A0", "A1", "A2", "B1", "B2"];
const FORMATS = [
  { value: "qcm", label: "QCM" },
  { value: "vrai_faux", label: "Vrai / Faux" },
  { value: "texte_lacunaire", label: "Texte a trous" },
  { value: "appariement", label: "Appariement" },
  { value: "transformation", label: "Transformation" },
  { value: "production_ecrite", label: "Production ecrite" },
];

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du PDF impossible."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });

export default function ImportFromUrlDialog({
  open,
  onClose,
  sessionId,
  defaultSourceMode = "pdf",
  onExerciseCreated,
}: ImportFromUrlDialogProps) {
  const { user } = useAuth();
  const [sourceMode, setSourceMode] = useState<SourceMode>(defaultSourceMode);
  const [url, setUrl] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [competence, setCompetence] = useState("auto");
  const [niveau, setNiveau] = useState("A1");
  const [format, setFormat] = useState("qcm");
  const [count, setCount] = useState(1);
  const [destination, setDestination] = useState<Destination>(sessionId ? "session" : "bank");
  const [step, setStep] = useState<Step>("form");
  const [analysis, setAnalysis] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      setSourceMode(defaultSourceMode);
    }
  }, [open, defaultSourceMode]);

  const busy = step === "analyzing" || step === "generating" || step === "saving";
  const canGenerate = sourceMode === "pdf" ? !!pdf : /^https?:\/\//i.test(url.trim());
  const sourceLabel = useMemo(
    () => sourceMode === "pdf" ? pdf?.name : url.trim(),
    [pdf, sourceMode, url],
  );

  const reset = () => {
    setSourceMode(defaultSourceMode);
    setUrl("");
    setPdf(null);
    setCompetence("auto");
    setNiveau("A1");
    setFormat("qcm");
    setCount(1);
    setDestination(sessionId ? "session" : "bank");
    setStep("form");
    setAnalysis(null);
    setExercises([]);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const buildSourceText = (pdfAnalysis: any) => [
    `Titre du support : ${pdfAnalysis.title || pdf?.name || "Document PDF"}`,
    `Theme : ${pdfAnalysis.theme || "Non detecte"}`,
    `Niveau estime : ${pdfAnalysis.detected_level || "Non detecte"}`,
    `Synthese fidele : ${pdfAnalysis.summary || ""}`,
    `Vocabulaire a conserver : ${(pdfAnalysis.vocabulary || []).join(", ")}`,
    `Points de langue : ${(pdfAnalysis.grammar_points || []).join(", ")}`,
    `Objectifs : ${(pdfAnalysis.learning_objectives || []).join(", ")}`,
  ].join("\n");

  const generate = async () => {
    if (!canGenerate) return;
    try {
      let sourceText: string | undefined;
      let sourceUrl: string | undefined;
      let pdfAnalysis = null;

      if (sourceMode === "pdf") {
        if (!pdf) return;
        if (pdf.size > 10 * 1024 * 1024) throw new Error("Le PDF ne doit pas depasser 10 Mo.");
        setStep("analyzing");
        const pdfBase64 = await readAsBase64(pdf);
        const { data, error } = await supabase.functions.invoke("analyze-pdf-support", {
          body: { pdfBase64, fileName: pdf.name, targetLevel: niveau },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        pdfAnalysis = data.analysis;
        setAnalysis(pdfAnalysis);
        sourceText = buildSourceText(pdfAnalysis);
      } else {
        sourceUrl = url.trim();
      }

      setStep("generating");
      const generated: any[] = [];
      for (let index = 0; index < count; index += 1) {
        const variantInstruction = `\nVariante ${index + 1} sur ${count}. Cree un exercice distinct des autres, tout en conservant strictement le theme et le vocabulaire source.`;
        const { data, error } = await supabase.functions.invoke("smart-exercise-generator", {
          body: {
            mode: "import",
            sourceText: sourceText ? `${sourceText}${variantInstruction}` : undefined,
            sourceUrl,
            treatment: "reconfigure",
            targetFormat: format,
            competence: competence === "auto" ? undefined : competence,
            niveau,
            niveau_depart: niveau,
            niveau_arrivee: niveau,
          },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        generated.push(data.exercise);
      }
      setExercises(generated);
      setStep("preview");
    } catch (error: any) {
      toast.error("Generation impossible", { description: error.message });
      setStep("form");
    }
  };

  const save = async () => {
    if (!user || exercises.length === 0) return;
    setStep("saving");
    try {
      const { data: defaultPoint, error: pointError } = await supabase
        .from("points_a_maitriser")
        .select("id")
        .limit(1)
        .single();
      if (pointError || !defaultPoint) throw new Error("Importez d'abord un programme de formation.");

      const payload = exercises.map((exercise) => ({
        titre: exercise.titre,
        consigne: exercise.consigne,
        competence: exercise.competence,
        format: exercise.format,
        niveau_vise: exercise.niveau_vise || niveau,
        difficulte: exercise.difficulte ?? 2,
        contenu: {
          ...exercise.contenu,
          source_support: {
            type: sourceMode,
            label: sourceLabel,
            theme: analysis?.theme || null,
            vocabulary: analysis?.vocabulary || [],
          },
        },
        formateur_id: user.id,
        animation_guide: exercise.metadata ?? null,
        point_a_maitriser_id: defaultPoint.id,
        is_ai_generated: true,
      }));

      const { data: created, error } = await supabase
        .from("exercices")
        .insert(payload as any)
        .select();
      if (error) throw error;

      if (sessionId && destination !== "bank") {
        const { data: existing } = await supabase
          .from("session_exercices")
          .select("ordre")
          .eq("session_id", sessionId)
          .order("ordre", { ascending: false })
          .limit(1);
        const startOrder = (existing?.[0]?.ordre ?? 0) + 1;
        const sessionStatus = destination === "diagnostic" ? "devoir_anticipation" : "planifie";

        const { error: linkError } = await supabase.from("session_exercices").insert(
          (created || []).map((exercise, index) => ({
            session_id: sessionId,
            exercice_id: exercise.id,
            ordre: startOrder + index,
            statut: sessionStatus,
          })) as any,
        );
        if (linkError) throw linkError;

        if (destination === "homework") {
          const { data: session } = await supabase
            .from("sessions")
            .select("group_id")
            .eq("id", sessionId)
            .single();
          const { data: members } = await supabase
            .from("group_members")
            .select("eleve_id")
            .eq("group_id", session?.group_id || "");
          const deadline = new Date(Date.now() + 7 * 86400000).toISOString();
          const devoirs = (members || []).flatMap((member) =>
            (created || []).map((exercise) => ({
              eleve_id: member.eleve_id,
              exercice_id: exercise.id,
              formateur_id: user.id,
              session_id: sessionId,
              date_echeance: deadline,
              statut: "en_attente",
              raison: "entrainement",
            })),
          );
          if (devoirs.length) {
            const { error: homeworkError } = await supabase.from("devoirs").insert(devoirs as any);
            if (homeworkError) throw homeworkError;
          }
        }
      }

      (created || []).forEach(onExerciseCreated);
      toast.success(`${created?.length || 0} exercice(s) cree(s)`, {
        description: destination === "homework"
          ? "Les exercices ont aussi ete envoyes aux eleves."
          : destination === "diagnostic"
            ? "Ils sont places en diagnostic de debut de seance."
            : destination === "session"
              ? "Ils sont ajoutes a la seance."
              : "Ils sont disponibles dans la banque.",
      });
      reset();
      onClose();
    } catch (error: any) {
      toast.error("Sauvegarde impossible", { description: error.message });
      setStep("preview");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importer un support pedagogique
          </DialogTitle>
          <DialogDescription>
            Genere des exercices sur le meme theme, avec le vocabulaire du support et le niveau choisi.
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-5">
            <Tabs value={sourceMode} onValueChange={(value) => setSourceMode(value as SourceMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pdf"><FileText className="mr-2 h-4 w-4" />PDF</TabsTrigger>
                <TabsTrigger value="url"><Link2 className="mr-2 h-4 w-4" />Lien web</TabsTrigger>
              </TabsList>
              <TabsContent value="pdf" className="mt-4">
                <Label htmlFor="support-pdf">Document PDF</Label>
                <label className="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-4 text-center hover:bg-muted/40">
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">{pdf?.name || "Choisir un PDF"}</span>
                  <span className="text-xs text-muted-foreground">10 Mo maximum</span>
                  <input
                    id="support-pdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(event) => setPdf(event.target.files?.[0] || null)}
                  />
                </label>
              </TabsContent>
              <TabsContent value="url" className="mt-4">
                <Label htmlFor="support-url">Adresse de la page</Label>
                <Input
                  id="support-url"
                  className="mt-2"
                  placeholder="https://exemple.com/ressource-fle"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
              </TabsContent>
            </Tabs>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Niveau de l'exercice</Label>
                <Select value={niveau} onValueChange={setNiveau}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>{NIVEAUX.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Competence cible</Label>
                <Select value={competence} onValueChange={setCompetence}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>{COMPETENCES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMATS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nombre d'exercices</Label>
                <Input
                  className="mt-2"
                  type="number"
                  min={1}
                  max={30}
                  value={count}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setCount(Number.isFinite(value) ? Math.min(30, Math.max(1, value)) : 1);
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">Choisissez entre 1 et 30 exercices.</p>
              </div>
            </div>

            <div>
              <Label>Destination</Label>
              <Select value={destination} onValueChange={(value) => setDestination(value as Destination)}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Banque d'exercices</SelectItem>
                  {sessionId && <SelectItem value="session">Exercices de la seance</SelectItem>}
                  {sessionId && <SelectItem value="diagnostic">Prediagnostic de la seance</SelectItem>}
                  {sessionId && <SelectItem value="homework">Devoirs des eleves</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full gap-2" size="lg" disabled={!canGenerate} onClick={generate}>
              <Wand2 className="h-4 w-4" />
              Analyser et generer {count} exercice{count > 1 ? "s" : ""}
            </Button>
          </div>
        )}

        {(step === "analyzing" || step === "generating" || step === "saving") && (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="h-9 w-9 animate-spin text-primary" />
            <div>
              <p className="font-medium">
                {step === "analyzing" ? "Analyse du PDF et de son vocabulaire..." : step === "generating" ? "Generation des exercices..." : "Ajout des exercices..."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Le contenu reste ancre dans le support choisi.</p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">{exercises.length} exercice(s) pret(s)</span>
            </div>
            {analysis && (
              <div className="border bg-muted/30 p-4">
                <p className="font-semibold">{analysis.title || pdf?.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{analysis.theme}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(analysis.vocabulary || []).slice(0, 12).map((word: string) => <Badge key={word} variant="outline">{word}</Badge>)}
                </div>
              </div>
            )}
            <div className="space-y-2">
              {exercises.map((exercise, index) => (
                <div key={`${exercise.titre}-${index}`} className="flex items-start justify-between gap-3 border p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{exercise.titre}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{exercise.consigne}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Badge>{exercise.competence}</Badge>
                    <Badge variant="outline">{exercise.niveau_vise}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("form")}>Modifier</Button>
              <Button className="gap-2" onClick={save}>
                <Save className="h-4 w-4" />
                Valider et ajouter
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
