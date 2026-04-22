import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  externalResourceId: string;
  sessionId: string;
  groupId: string;
  onImported: () => void;
}

interface PreviewRow {
  raw_name: string;
  score: number | null;
}

interface PreviewResult {
  rows: PreviewRow[];
  separator_detected: string;
  columns_detected: { name: string | null; score: string | null; all: string[] };
  total_rows: number;
}

interface MappingRow {
  raw_name: string;
  score: number | null;
  student_id: string | null;
  protected: boolean;
}

type Step = "upload" | "reconcile" | "done";

const SKIP = "__skip__";

function normalizeName(s: string) {
  return s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function ExternalCsvImportDialog({
  open,
  onOpenChange,
  externalResourceId,
  sessionId,
  groupId,
  onImported,
}: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [overrideName, setOverrideName] = useState<string | null>(null);
  const [overrideScore, setOverrideScore] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ inserted: number; updated: number; skipped: number; skipped_validated: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const memoryKey = `csv-mapping-${groupId}`;

  useEffect(() => {
    if (!open) {
      setStep("upload");
      setFile(null);
      setPreview(null);
      setMappings([]);
      setOverrideName(null);
      setOverrideScore(null);
      setSummary(null);
    }
  }, [open]);

  const { data: members } = useQuery({
    queryKey: ["csv-import-members", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("eleve_id, profile:profiles(id, prenom, nom, email)")
        .eq("group_id", groupId);
      if (error) throw error;
      return (data ?? [])
        .map((m: any) => m.profile)
        .filter(Boolean) as { id: string; prenom: string; nom: string; email: string }[];
    },
    enabled: open && !!groupId,
  });

  const { data: existingResults } = useQuery({
    queryKey: ["csv-import-existing", externalResourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_resource_results")
        .select("student_id, source")
        .eq("external_resource_id", externalResourceId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!externalResourceId,
  });

  const validatedSet = useMemo(
    () =>
      new Set(
        (existingResults ?? [])
          .filter((r: any) => r.source === "validated")
          .map((r: any) => r.student_id as string)
      ),
    [existingResults]
  );

  function loadMemoryMappings(): Record<string, string> {
    try {
      const raw = localStorage.getItem(memoryKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveMemoryMappings(map: Record<string, string>) {
    try {
      localStorage.setItem(memoryKey, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  function autoMap(rows: PreviewRow[]): MappingRow[] {
    const memory = loadMemoryMappings();
    const list = members ?? [];
    return rows.map((r) => {
      const norm = normalizeName(r.raw_name);
      let studentId: string | null = null;

      if (memory[norm]) {
        if (list.find((s) => s.id === memory[norm])) studentId = memory[norm];
      }

      if (!studentId) {
        const found = list.find((s) => {
          const full = normalizeName(`${s.prenom ?? ""} ${s.nom ?? ""}`);
          const reverse = normalizeName(`${s.nom ?? ""} ${s.prenom ?? ""}`);
          return full === norm || reverse === norm;
        });
        if (found) studentId = found.id;
      }

      if (!studentId) {
        const found = list.find((s) => normalizeName(s.email ?? "") === norm);
        if (found) studentId = found.id;
      }

      return {
        raw_name: r.raw_name,
        score: r.score,
        student_id: studentId,
        protected: studentId ? validatedSet.has(studentId) : false,
      };
    });
  }

  async function handlePreview(selectedFile: File) {
    setFile(selectedFile);
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("external_resource_id", externalResourceId);
      fd.append("action", "preview");

      const { data, error } = await supabase.functions.invoke("import-external-csv", {
        body: fd,
      });
      if (error) throw error;
      const result = data as PreviewResult;
      setPreview(result);
      setOverrideName(result.columns_detected.name);
      setOverrideScore(result.columns_detected.score);

      if (result.columns_detected.name && result.columns_detected.score) {
        setMappings(autoMap(result.rows));
        setStep("reconcile");
      } else {
        toast.warning("Colonnes non détectées — sélectionnez-les manuellement.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur d'analyse du CSV", { description: e.message });
    } finally {
      setPreviewing(false);
    }
  }

  async function handleManualColumnsConfirm() {
    if (!file || !overrideName || !overrideScore) return;
    await handlePreview(file);
  }

  function handleAutoMap() {
    if (!preview) return;
    setMappings(autoMap(preview.rows));
    toast.success("Mappage automatique appliqué");
  }

  function updateMapping(idx: number, studentId: string | null) {
    setMappings((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        student_id: studentId,
        protected: studentId ? validatedSet.has(studentId) : false,
      };
      return next;
    });
  }

  async function handleImport() {
    setImporting(true);
    try {
      const toSend = mappings
        .filter((m) => m.student_id && m.score != null && !m.protected)
        .map((m) => ({
          raw_name: m.raw_name,
          student_id: m.student_id!,
          score: m.score!,
        }));

      const { data, error } = await supabase.functions.invoke("import-external-csv", {
        body: {
          action: "confirm",
          external_resource_id: externalResourceId,
          mappings: toSend,
        },
      });
      if (error) throw error;

      const memory = loadMemoryMappings();
      mappings.forEach((m) => {
        if (m.student_id) memory[normalizeName(m.raw_name)] = m.student_id;
      });
      saveMemoryMappings(memory);

      const result = data as { inserted: number; updated: number; skipped: number; skipped_validated: number };
      setSummary(result);
      setStep("done");

      toast.success("Import terminé", {
        description: `${result.inserted} ajouté(s), ${result.updated} mis à jour`,
      });

      onImported();
      qc.invalidateQueries({ queryKey: ["session-bilan-external-results", sessionId] });
    } catch (e: any) {
      console.error(e);
      toast.error("Import échoué", { description: e.message });
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      if (!f.name.toLowerCase().endsWith(".csv")) {
        toast.error("Fichier .csv uniquement");
        return;
      }
      handlePreview(f);
    }
  }

  const ignoredCount = mappings.filter((m) => !m.student_id).length;
  const protectedCount = mappings.filter((m) => m.protected).length;
  const importableCount = mappings.filter((m) => m.student_id && m.score != null && !m.protected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importer des résultats CSV
          </DialogTitle>
          <DialogDescription>
            Export CSV disponible dans les résultats de votre activité Wordwall, LearningApps, Quizlet…
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              className={cn(
                "border-2 border-dashed rounded-lg p-10 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              )}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-sm font-medium mb-1">Glissez votre fichier .csv ici</p>
              <p className="text-xs text-muted-foreground mb-4">ou</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePreview(f);
                }}
              />
              <Button onClick={() => inputRef.current?.click()} disabled={previewing}>
                {previewing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyse…
                  </>
                ) : (
                  "Parcourir"
                )}
              </Button>
            </div>

            {preview && !preview.columns_detected.name && (
              <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 space-y-3">
                <p className="text-sm font-medium">
                  Colonnes non détectées automatiquement — choisissez-les :
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Colonne pseudo / nom</label>
                    <Select
                      value={overrideName ?? undefined}
                      onValueChange={(v) => setOverrideName(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir…" />
                      </SelectTrigger>
                      <SelectContent>
                        {preview.columns_detected.all.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Colonne score</label>
                    <Select
                      value={overrideScore ?? undefined}
                      onValueChange={(v) => setOverrideScore(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir…" />
                      </SelectTrigger>
                      <SelectContent>
                        {preview.columns_detected.all.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleManualColumnsConfirm}
                  disabled={!overrideName || !overrideScore || previewing}
                >
                  Continuer
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "reconcile" && preview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-muted-foreground">
                Séparateur : <strong>{preview.separator_detected}</strong> · Colonnes :{" "}
                <strong>{preview.columns_detected.name}</strong> /{" "}
                <strong>{preview.columns_detected.score}</strong> ·{" "}
                {mappings.length} ligne(s)
              </div>
              <Button size="sm" variant="outline" onClick={handleAutoMap} className="gap-1">
                <Wand2 className="h-3.5 w-3.5" /> Mapper automatiquement
              </Button>
            </div>

            <div className="border rounded-md max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Pseudo CSV</th>
                    <th className="text-left px-3 py-2 font-medium">Élève du groupe</th>
                    <th className="text-right px-3 py-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 truncate max-w-[200px]">{m.raw_name}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={m.student_id ?? SKIP}
                            onValueChange={(v) => updateMapping(idx, v === SKIP ? null : v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Choisir un élève" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SKIP}>— Ignorer —</SelectItem>
                              {(members ?? []).map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.prenom} {s.nom}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!m.student_id && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              Ignoré
                            </Badge>
                          )}
                          {m.protected && (
                            <Badge
                              variant="outline"
                              className="text-[10px] shrink-0 border-red-500/40 text-red-600"
                            >
                              <ShieldCheck className="h-3 w-3 mr-0.5" /> Protégé
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {m.score != null ? `${Math.round(m.score)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{importableCount}</strong> à importer
              </span>
              <span>·</span>
              <span>
                <strong className="text-foreground">{ignoredCount}</strong> ignoré(s)
              </span>
              <span>·</span>
              <span>
                <strong className="text-foreground">{protectedCount}</strong> protégé(s)
              </span>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              <Button onClick={handleImport} disabled={importing || importableCount === 0}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Import…
                  </>
                ) : (
                  <>
                    Importer <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && summary && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <p className="font-medium">Import terminé</p>
            </div>
            <div className="space-y-1 text-sm">
              <p>
                <strong>{summary.inserted}</strong> ajouté(s),{" "}
                <strong>{summary.updated}</strong> mis à jour,{" "}
                <strong>{summary.skipped}</strong> ignoré(s) (non mappés),{" "}
                <strong>{summary.skipped_validated}</strong> protégé(s).
              </p>
              {summary.skipped_validated > 0 && (
                <p className="text-xs text-muted-foreground border-l-2 border-orange-400 pl-2">
                  {summary.skipped_validated} résultat(s) non modifié(s) car déjà validé(s) par le formateur.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fermer</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
