import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  PlaneTakeoff, Sparkles, ShieldCheck, Send, RotateCw, Loader2,
  CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───
type PreflightStatus = "ready" | "to_fix" | "pending";

interface PreflightCheck {
  status: PreflightStatus;
  errors: string[];
  warnings: string[];
  mediaChecked: boolean;
}

interface PreflightExercisesProps {
  sessionId: string;
  session: any;
  exercises: any[]; // session_exercices joined with exercice
  formateurId: string;
  parcoursSeance?: any;
}

// ─── Validation logic ───
async function checkMediaUrl(url: string, kind: "image" | "audio"): Promise<boolean> {
  if (!url || typeof url !== "string") return false;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 6000);
    if (kind === "image") {
      const img = new Image();
      img.onload = () => { clearTimeout(timeout); resolve(true); };
      img.onerror = () => { clearTimeout(timeout); resolve(false); };
      img.src = url;
    } else {
      const audio = new Audio();
      audio.oncanplaythrough = () => { clearTimeout(timeout); resolve(true); };
      audio.onloadedmetadata = () => { clearTimeout(timeout); resolve(true); };
      audio.onerror = () => { clearTimeout(timeout); resolve(false); };
      audio.src = url;
      audio.load();
    }
  });
}

function validateStructure(ex: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!ex) { errors.push("Exercice manquant"); return { errors, warnings }; }
  if (!ex.titre || !String(ex.titre).trim()) errors.push("Titre vide");
  if (!ex.consigne || !String(ex.consigne).trim()) errors.push("Consigne vide");

  const contenu = ex.contenu;
  const items = Array.isArray(contenu?.items) ? contenu.items : [];
  if (items.length === 0) {
    errors.push("Aucun item dans contenu.items");
  } else {
    items.forEach((it: any, i: number) => {
      const idx = i + 1;
      if (!it?.question || !String(it.question).trim()) {
        errors.push(`Item ${idx} : question manquante`);
      }
      const opts = Array.isArray(it?.options) ? it.options : null;
      const bonne = it?.bonne_reponse;
      if (opts) {
        if (opts.length < 2) errors.push(`Item ${idx} : moins de 2 options`);
        if (opts.some((o: any) => !o || !String(o).trim()))
          errors.push(`Item ${idx} : option vide`);
        if (bonne === undefined || bonne === null || String(bonne).trim() === "") {
          errors.push(`Item ${idx} : bonne_reponse manquante`);
        } else {
          // Check coherence: bonne_reponse must match an option (string match or index)
          const bonneStr = String(bonne).trim();
          const matchByValue = opts.some((o: any) => String(o).trim() === bonneStr);
          const matchByIndex = /^\d+$/.test(bonneStr) && Number(bonneStr) >= 0 && Number(bonneStr) < opts.length;
          const matchByLetter = /^[A-Za-z]$/.test(bonneStr) && bonneStr.toUpperCase().charCodeAt(0) - 65 < opts.length;
          if (!matchByValue && !matchByIndex && !matchByLetter) {
            errors.push(`Item ${idx} : bonne_reponse "${bonneStr}" ne correspond à aucune option`);
          }
        }
      } else {
        // Free-form: at least bonne_reponse expected for auto-correction
        if (bonne === undefined || bonne === null || String(bonne).trim() === "") {
          warnings.push(`Item ${idx} : pas d'options ni de bonne_reponse (correction manuelle requise)`);
        }
      }
    });
  }
  return { errors, warnings };
}

function extractMediaUrls(ex: any): { audio: string[]; image: string[] } {
  const audio: string[] = [];
  const image: string[] = [];
  const c = ex?.contenu || {};
  if (typeof c.audio_url === "string") audio.push(c.audio_url);
  if (typeof c.audioUrl === "string") audio.push(c.audioUrl);
  if (typeof c.image_url === "string") image.push(c.image_url);
  if (typeof c.imageUrl === "string") image.push(c.imageUrl);
  const items = Array.isArray(c.items) ? c.items : [];
  items.forEach((it: any) => {
    if (typeof it?.audio_url === "string") audio.push(it.audio_url);
    if (typeof it?.image_url === "string") image.push(it.image_url);
  });
  return { audio: [...new Set(audio)], image: [...new Set(image)] };
}

const STATUS_CONFIG: Record<PreflightStatus, { label: string; classes: string; icon: any }> = {
  ready: { label: "Prêt", classes: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800", icon: CheckCircle2 },
  to_fix: { label: "À corriger", classes: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800", icon: AlertTriangle },
  pending: { label: "En attente", classes: "bg-muted text-muted-foreground border-border", icon: Clock },
};

const PreflightExercises = ({ sessionId, session, exercises, formateurId, parcoursSeance }: PreflightExercisesProps) => {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(true);
  const [batchSize, setBatchSize] = useState<5 | 10>(5);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [checks, setChecks] = useState<Record<string, PreflightCheck>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Initial status: not yet verified → pending
  const getStatus = useCallback((seId: string): PreflightStatus => {
    return checks[seId]?.status ?? "pending";
  }, [checks]);

  const counts = useMemo(() => {
    const c = { ready: 0, to_fix: 0, pending: 0 };
    exercises.forEach((se) => { c[getStatus(se.id)]++; });
    return c;
  }, [exercises, getStatus]);

  // ─── Generate batch ───
  const handleGenerateBatch = async () => {
    if (!session) return;
    setGenerating(true);
    try {
      const niveauVise = session.niveau_cible || parcoursSeance?.parcours?.niveau_cible || "A1";
      const sessionComps: string[] = (session as any)?.competences_cibles ?? [];
      const competences = sessionComps.length > 0 ? sessionComps : ["CE"];
      const objectif = parcoursSeance?.objectif_principal || session.objectifs || "Exercice de séance";

      const { data: defaultPoint } = await supabase
        .from("points_a_maitriser").select("id").limit(1).single();
      if (!defaultPoint) {
        toast.error("Aucun point à maîtriser trouvé. Importez d'abord un programme.");
        return;
      }

      const perComp = Math.max(1, Math.floor(batchSize / competences.length));
      const remainder = batchSize - perComp * competences.length;
      let allInserted: any[] = [];

      for (let ci = 0; ci < competences.length; ci++) {
        const comp = competences[ci];
        const compCount = perComp + (ci < remainder ? 1 : 0);
        if (compCount <= 0) continue;

        const { data, error } = await supabase.functions.invoke("generate-exercises", {
          body: {
            pointName: objectif,
            competence: comp,
            niveauVise,
            count: compCount,
            difficultyLevel: 5,
            type_demarche: (session as any)?.group?.type_demarche || "titre_sejour",
            groupId: (session as any)?.group_id,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const generated = data?.exercises ?? [];
        if (generated.length === 0) continue;

        const toInsert = generated.map((ex: any) => ({
          titre: ex.titre,
          consigne: ex.consigne,
          competence: comp as any,
          format: (ex.format || "qcm") as any,
          difficulte: ex.difficulte || 3,
          contenu: ex.contenu || {},
          animation_guide: ex.animation_guide || null,
          niveau_vise: niveauVise,
          formateur_id: formateurId,
          point_a_maitriser_id: defaultPoint.id,
          is_ai_generated: true,
          is_template: false,
          is_devoir: false,
        }));

        const { data: inserted, error: insertErr } = await supabase
          .from("exercices").insert(toInsert).select("id");
        if (insertErr) throw insertErr;
        allInserted.push(...(inserted ?? []));
      }

      if (allInserted.length === 0) {
        toast.warning("Aucun exercice généré.");
        return;
      }

      const currentMax = exercises.length;
      const links = allInserted.map((ex, i) => ({
        session_id: sessionId,
        exercice_id: ex.id,
        ordre: currentMax + i + 1,
        statut: "planifie" as any,
      }));
      const { error: linkErr } = await supabase.from("session_exercices").insert(links);
      if (linkErr) throw linkErr;

      qc.invalidateQueries({ queryKey: ["session-exercices", sessionId] });
      toast.success(`Lot de ${allInserted.length} exercice(s) généré.`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  // ─── Verify batch ───
  const handleVerifyBatch = async () => {
    if (exercises.length === 0) {
      toast.warning("Aucun exercice à vérifier.");
      return;
    }
    setVerifying(true);
    try {
      const newChecks: Record<string, PreflightCheck> = {};
      for (const se of exercises) {
        const ex = se.exercice;
        const errors: string[] = [];
        const warnings: string[] = [];

        const struct = validateStructure(ex);
        errors.push(...struct.errors);
        warnings.push(...struct.warnings);

        // Media checks
        const { audio, image } = extractMediaUrls(ex);
        const isCO = ex?.competence === "CO";
        if (isCO && audio.length === 0) {
          errors.push("Compétence CO : audio obligatoire manquant");
        }

        // Verify reachable
        for (const url of audio) {
          const ok = await checkMediaUrl(url, "audio");
          if (!ok) errors.push(`Audio inaccessible : ${url.slice(0, 60)}…`);
        }
        for (const url of image) {
          const ok = await checkMediaUrl(url, "image");
          if (!ok) errors.push(`Image inaccessible : ${url.slice(0, 60)}…`);
        }

        newChecks[se.id] = {
          status: errors.length === 0 ? "ready" : "to_fix",
          errors,
          warnings,
          mediaChecked: true,
        };
      }
      setChecks(newChecks);
      const ready = Object.values(newChecks).filter((c) => c.status === "ready").length;
      const toFix = Object.values(newChecks).filter((c) => c.status === "to_fix").length;
      toast.success(`Vérification terminée : ${ready} prêt(s), ${toFix} à corriger.`);
    } catch (e: any) {
      toast.error("Erreur de vérification", { description: e.message });
    } finally {
      setVerifying(false);
    }
  };

  // ─── Send single exercise ───
  const handleSendOne = async (se: any) => {
    setSendingId(se.id);
    try {
      const { error } = await supabase
        .from("session_exercices")
        .update({ statut: "traite_en_classe" as any, is_sent: true, updated_at: new Date().toISOString() } as any)
        .eq("id", se.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["session-exercices", sessionId] });
      toast.success(`« ${se.exercice?.titre || "Exercice"} » envoyé.`);
    } catch (e: any) {
      toast.error("Erreur d'envoi", { description: e.message });
    } finally {
      setSendingId(null);
    }
  };

  // ─── Regenerate single exercise ───
  const handleRegenerate = async (se: any) => {
    const ex = se.exercice;
    if (!ex) return;
    setRegeneratingId(se.id);
    try {
      const niveauVise = ex.niveau_vise || session?.niveau_cible || "A1";
      const { data, error } = await supabase.functions.invoke("generate-exercises", {
        body: {
          pointName: ex.titre || "Régénération",
          competence: ex.competence,
          niveauVise,
          count: 1,
          difficultyLevel: ex.difficulte ?? 5,
          type_demarche: (session as any)?.group?.type_demarche || "titre_sejour",
          groupId: (session as any)?.group_id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const fresh = data?.exercises?.[0];
      if (!fresh) throw new Error("Aucun exercice régénéré");

      const { error: updErr } = await supabase
        .from("exercices")
        .update({
          titre: fresh.titre || ex.titre,
          consigne: fresh.consigne || ex.consigne,
          contenu: fresh.contenu || {},
          animation_guide: fresh.animation_guide || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ex.id);
      if (updErr) throw updErr;

      // Reset its status to pending so user re-verifies
      setChecks((prev) => {
        const copy = { ...prev };
        delete copy[se.id];
        return copy;
      });
      qc.invalidateQueries({ queryKey: ["session-exercices", sessionId] });
      toast.success("Exercice régénéré. Relancez la vérification.");
    } catch (e: any) {
      toast.error("Erreur de régénération", { description: e.message });
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5 print:hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PlaneTakeoff className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Pré-vol exercices</CardTitle>
                <Badge variant="outline" className="text-[11px]">
                  {exercises.length} exercice(s)
                </Badge>
                {Object.keys(checks).length > 0 && (
                  <>
                    <Badge className={cn("text-[11px]", STATUS_CONFIG.ready.classes)}>
                      ✓ {counts.ready} prêt
                    </Badge>
                    {counts.to_fix > 0 && (
                      <Badge className={cn("text-[11px]", STATUS_CONFIG.to_fix.classes)}>
                        ⚠ {counts.to_fix} à corriger
                      </Badge>
                    )}
                  </>
                )}
              </div>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            <CardDescription className="text-xs">
              Générez un lot, vérifiez la conformité, puis envoyez les exercices au fur et à mesure pendant la séance.
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* ── Action bar ── */}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Taille du lot :</Label>
                <Select value={String(batchSize)} onValueChange={(v) => setBatchSize(Number(v) as 5 | 10)}>
                  <SelectTrigger className="w-[80px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerateBatch} disabled={generating} variant="default" size="sm" className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Générer un lot
              </Button>
              <Button onClick={handleVerifyBatch} disabled={verifying || exercises.length === 0} variant="secondary" size="sm" className="gap-2">
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Vérifier le lot
              </Button>
              <div className="ml-auto text-xs text-muted-foreground">
                {Object.keys(checks).length === 0
                  ? "Vérifiez le lot pour activer l'envoi"
                  : `${counts.ready} prêt(s) · ${counts.to_fix} à corriger · ${counts.pending} en attente`}
              </div>
            </div>

            {/* ── Exercise list ── */}
            {exercises.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md">
                Aucun exercice. Cliquez sur « Générer un lot » pour commencer.
              </div>
            ) : (
              <div className="space-y-2">
                {exercises.map((se: any, idx: number) => {
                  const status = getStatus(se.id);
                  const cfg = STATUS_CONFIG[status];
                  const StatusIcon = cfg.icon;
                  const check = checks[se.id];
                  const ex = se.exercice;
                  const isSent = se.is_sent === true || se.statut === "traite_en_classe";
                  return (
                    <div
                      key={se.id}
                      className={cn(
                        "border rounded-md p-3 bg-background transition-colors",
                        status === "to_fix" && "border-orange-300 dark:border-orange-800",
                        status === "ready" && "border-green-300 dark:border-green-800",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {ex?.competence || "?"}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {ex?.format || "?"}
                            </Badge>
                            <Badge className={cn("text-[10px]", cfg.classes)}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {cfg.label}
                            </Badge>
                            {isSent && (
                              <Badge variant="secondary" className="text-[10px]">Envoyé</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium mt-1 truncate">
                            {ex?.titre || "Sans titre"}
                          </p>
                          {check && (check.errors.length > 0 || check.warnings.length > 0) && (
                            <ul className="mt-2 text-xs space-y-0.5">
                              {check.errors.map((err, i) => (
                                <li key={`e${i}`} className="text-orange-700 dark:text-orange-400">• {err}</li>
                              ))}
                              {check.warnings.map((w, i) => (
                                <li key={`w${i}`} className="text-muted-foreground">• {w}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {status === "to_fix" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-8"
                              disabled={regeneratingId === se.id}
                              onClick={() => handleRegenerate(se)}
                            >
                              {regeneratingId === se.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <RotateCw className="h-3.5 w-3.5" />}
                              Régénérer
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="default"
                            className="gap-1 h-8"
                            disabled={status !== "ready" || isSent || sendingId === se.id}
                            onClick={() => handleSendOne(se)}
                          >
                            {sendingId === se.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Send className="h-3.5 w-3.5" />}
                            {isSent ? "Envoyé" : "Envoyer"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default PreflightExercises;
