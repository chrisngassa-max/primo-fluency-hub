import React, { useState, useEffect } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, FileText, RotateCcw, Image, Loader2, Save, Printer, Eye, Check, ExternalLink, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

type ResourceType = "lecon" | "vocabulaire" | "rappel_methodo" | "rappel_visuel";

interface ResourceSection {
  titre: string;
  contenu: string;
  type: string;
  items?: { terme?: string; definition?: string; exemple?: string }[];
}

interface GeneratedResource {
  titre: string;
  sections: ResourceSection[];
  resume: string;
}

interface GenerateResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise?: {
    id: string;
    titre: string;
    consigne: string;
    competence: string;
    format: string;
    niveau_vise: string;
    contenu: any;
  };
  session?: {
    id: string;
    titre: string;
    objectifs: string | null;
    niveau_cible: string;
  };
}

const resourceTypes: { value: ResourceType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "lecon", label: "Leçon", icon: BookOpen, description: "Explication structurée de la notion" },
  { value: "vocabulaire", label: "Vocabulaire", icon: FileText, description: "Liste de mots clés avec définitions" },
  { value: "rappel_methodo", label: "Rappel méthodologique", icon: RotateCcw, description: "Étapes pour réussir ce type d'exercice" },
  { value: "rappel_visuel", label: "Rappel visuel", icon: Image, description: "Explication illustrée et schématique" },
];

export default function GenerateResourceDialog({
  open,
  onOpenChange,
  exercise,
  session,
}: GenerateResourceDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<ResourceType>("lecon");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedResourceId, setSavedResourceId] = useState<string | null>(null);
  const [generatedResource, setGeneratedResource] = useState<GeneratedResource | null>(null);
  const [step, setStep] = useState<"select" | "preview" | "assign">("select");

  // Assignment state
  const [assignMode, setAssignMode] = useState<"individuel" | "groupe">("individuel");
  const [assignEleveId, setAssignEleveId] = useState<string>("");
  const [assignGroupId, setAssignGroupId] = useState<string>("");
  const [assignDueDate, setAssignDueDate] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [eleves, setEleves] = useState<any[]>([]);
  const [groupes, setGroupes] = useState<any[]>([]);

  // Load eleves and groupes when needed
  useEffect(() => {
    if (!user || step !== "assign") return;
    (async () => {
      const [{ data: g }, { data: gm }] = await Promise.all([
        supabase.from("groups").select("id, nom, niveau").eq("formateur_id", user.id),
        supabase
          .from("group_members")
          .select("eleve_id, group_id, eleve:profiles(id, nom, prenom)")
          .in(
            "group_id",
            (await supabase.from("groups").select("id").eq("formateur_id", user.id)).data?.map((x: any) => x.id) || []
          ),
      ]);
      setGroupes(g || []);
      const uniqueEleves = new Map<string, any>();
      (gm || []).forEach((m: any) => {
        if (m.eleve) uniqueEleves.set(m.eleve.id, m.eleve);
      });
      setEleves([...uniqueEleves.values()]);
    })();
  }, [user, step]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-resource", {
        body: {
          type: selectedType,
          competence: exercise?.competence || "CE",
          niveau: exercise?.niveau_vise || session?.niveau_cible || "A1",
          mode: "manual",
          exerciseContext: exercise
            ? { titre: exercise.titre, consigne: exercise.consigne, competence: exercise.competence, format: exercise.format }
            : undefined,
          sessionContext: session
            ? { titre: session.titre, objectifs: session.objectifs, niveau_cible: session.niveau_cible }
            : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGeneratedResource(data.resource);
      setStep("preview");
      toast.success("Ressource générée !");
    } catch (e: any) {
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (statut: "draft" | "published" = "draft") => {
    if (!generatedResource || !user) return;
    setSaving(true);
    try {
      const { data: savedRow, error } = await supabase.from("ressources_pedagogiques" as any).insert({
        formateur_id: user.id,
        session_id: session?.id || null,
        exercice_id: exercise?.id || null,
        type: selectedType,
        competence: exercise?.competence || "CE",
        niveau: exercise?.niveau_vise || session?.niveau_cible || "A1",
        titre: generatedResource.titre,
        contenu: generatedResource as any,
        source: "manuel",
        statut,
      }).select("id").single();
      if (error) throw error;
      setSaved(true);
      setSavedResourceId((savedRow as any)?.id || null);
      toast.success(
        statut === "published" ? "Ressource publiée !" : "Ressource sauvegardée !",
        { description: "Vous pouvez l'imprimer ou la retrouver dans la banque de ressources." }
      );
    } catch (e: any) {
      toast.error("Erreur de sauvegarde", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!savedResourceId || !user) return;
    setAssigning(true);
    try {
      if (assignMode === "individuel" && !assignEleveId) {
        toast.error("Sélectionnez un élève");
        setAssigning(false);
        return;
      }
      if (assignMode === "groupe" && !assignGroupId) {
        toast.error("Sélectionnez un groupe");
        setAssigning(false);
        return;
      }

      if (assignMode === "groupe") {
        // Get all members of the group and create one assignment per learner
        const { data: members } = await supabase
          .from("group_members")
          .select("eleve_id")
          .eq("group_id", assignGroupId);
        const rows = (members || []).map((m: any) => ({
          resource_id: savedResourceId,
          learner_id: m.eleve_id,
          group_id: assignGroupId,
          assigned_by: user.id,
          due_date: assignDueDate || null,
        }));
        if (rows.length === 0) {
          toast.error("Ce groupe n'a aucun élève");
          setAssigning(false);
          return;
        }
        const { error } = await supabase.from("resource_assignments" as any).insert(rows);
        if (error) throw error;
        toast.success(`Leçon assignée à ${rows.length} élève(s) du groupe`);
      } else {
        const { error } = await supabase.from("resource_assignments" as any).insert({
          resource_id: savedResourceId,
          learner_id: assignEleveId,
          assigned_by: user.id,
          due_date: assignDueDate || null,
        });
        if (error) throw error;
        toast.success("Leçon assignée à l'élève");
      }
      setStep("preview");
    } catch (e: any) {
      toast.error("Erreur d'assignation", { description: e.message });
    } finally {
      setAssigning(false);
    }
  };

  const resetState = () => {
    setStep("select");
    setGeneratedResource(null);
    setSelectedType("lecon");
    setSaved(false);
    setSavedResourceId(null);
    setAssignMode("individuel");
    setAssignEleveId("");
    setAssignGroupId("");
    setAssignDueDate("");
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !generatedResource) return;
    
    const competenceLabel = exercise?.competence || "CE";
    const niveau = exercise?.niveau_vise || session?.niveau_cible || "A1";
    
    printWindow.document.write(`
      <html><head><title>${generatedResource.titre}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; margin: 40px; color: #1a1a1a; }
        h1 { font-size: 22px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 4px; }
        .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
        .meta span { background: #f3f4f6; padding: 2px 8px; border-radius: 4px; margin-right: 8px; }
        h2 { font-size: 16px; margin-top: 20px; color: #1e40af; }
        .encadre, .astuce, .attention { border-left: 4px solid; padding: 12px 16px; margin: 12px 0; border-radius: 4px; }
        .encadre { border-color: #2563eb; background: #eff6ff; }
        .astuce { border-color: #16a34a; background: #f0fdf4; }
        .attention { border-color: #ea580c; background: #fff7ed; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        td, th { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
        .footer { margin-top: 40px; border-top: 1px solid #d1d5db; padding-top: 8px; font-size: 11px; color: #9ca3af; text-align: center; }
        @media print { body { margin: 20mm; } }
      </style></head><body>
      <h1>${generatedResource.titre}</h1>
      <div class="meta"><span>${competenceLabel}</span><span>Niveau ${niveau}</span><span>${resourceTypes.find(r => r.value === selectedType)?.label}</span></div>
      ${generatedResource.sections.map(s => {
        const cls = s.type === "encadre" ? "encadre" : s.type === "astuce" ? "astuce" : s.type === "attention" ? "attention" : "";
        let html = `<h2>${s.titre}</h2>`;
        if (cls) html = `<div class="${cls}"><h2 style="margin-top:0">${s.titre}</h2>`;
        html += `<p>${s.contenu.replace(/\n/g, "<br/>")}</p>`;
        if (s.items?.length) {
          html += `<table><tr><th>Terme</th><th>Définition</th><th>Exemple</th></tr>`;
          s.items.forEach(i => { html += `<tr><td>${i.terme || ""}</td><td>${i.definition || ""}</td><td>${i.exemple || ""}</td></tr>`; });
          html += `</table>`;
        }
        if (cls) html += `</div>`;
        return html;
      }).join("")}
      <div class="footer">CAP TCF — Séance ${session?.titre || ""}</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {step === "assign" ? "Assigner la ressource" : "Générer une ressource pédagogique"}
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Choisissez le type de ressource à générer pour cet exercice."
              : step === "assign"
              ? `La leçon « ${generatedResource?.titre} » sera visible dans l'espace élève.`
              : "Prévisualisez la ressource avant de la sauvegarder."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="space-y-4">
            {exercise && (
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <p className="text-sm font-medium">{exercise.titre}</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">{exercise.competence}</Badge>
                    <Badge variant="outline" className="text-xs">{exercise.niveau_vise}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            <RadioGroup value={selectedType} onValueChange={(v) => setSelectedType(v as ResourceType)} className="space-y-2">
              {resourceTypes.map((rt) => (
                <Label
                  key={rt.value}
                  htmlFor={`rt-${rt.value}`}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedType === rt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value={rt.value} id={`rt-${rt.value}`} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <rt.icon className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{rt.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{rt.description}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>

            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Génération en cours…
                </>
              ) : (
                "Générer la ressource"
              )}
            </Button>
          </div>
        ) : step === "assign" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mode d'assignation</Label>
              <RadioGroup value={assignMode} onValueChange={(v) => setAssignMode(v as any)} className="flex gap-4">
                <Label htmlFor="assign-ind" className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="individuel" id="assign-ind" />
                  Individuel
                </Label>
                <Label htmlFor="assign-grp" className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="groupe" id="assign-grp" />
                  Groupe entier
                </Label>
              </RadioGroup>
            </div>

            {assignMode === "individuel" ? (
              <div className="space-y-1">
                <Label>Élève</Label>
                <Select value={assignEleveId} onValueChange={setAssignEleveId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un élève" /></SelectTrigger>
                  <SelectContent>
                    {eleves.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Groupe</Label>
                <Select value={assignGroupId} onValueChange={setAssignGroupId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un groupe" /></SelectTrigger>
                  <SelectContent>
                    {groupes.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.nom} ({g.niveau})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Date limite (optionnel)</Label>
              <Input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("preview")}>Retour</Button>
              <Button onClick={handleAssign} disabled={assigning}>
                {assigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                Assigner
              </Button>
            </div>
          </div>
        ) : generatedResource ? (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <ScrollArea className="flex-1 border rounded-lg p-4">
              <h2 className="text-lg font-bold mb-1">{generatedResource.titre}</h2>
              <p className="text-sm text-muted-foreground mb-4">{generatedResource.resume}</p>
              <Separator className="mb-4" />
              {generatedResource.sections.map((section, i) => (
                <div key={i} className={`mb-4 ${
                  section.type === "encadre" ? "border-l-4 border-primary bg-primary/5 p-3 rounded-r-md" :
                  section.type === "astuce" ? "border-l-4 border-green-500 bg-green-50 dark:bg-green-950/30 p-3 rounded-r-md" :
                  section.type === "attention" ? "border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/30 p-3 rounded-r-md" :
                  section.type === "exemple" ? "bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-md" :
                  ""
                }`}>
                  <h3 className="font-semibold text-sm mb-1">
                    {section.type === "astuce" ? "💡 " : section.type === "attention" ? "⚠️ " : section.type === "exemple" ? "Exemple : " : ""}
                    {section.titre}
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{section.contenu}</p>
                  {section.items && section.items.length > 0 && (
                    section.type === "tableau" ? (
                      <table className="mt-2 w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-semibold">Terme</th>
                            <th className="text-left p-2 font-semibold">Définition</th>
                            <th className="text-left p-2 font-semibold">Exemple</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.items.map((item, j) => (
                            <tr key={j} className="border-b border-border/50">
                              <td className="p-2 font-medium">{item.terme || ""}</td>
                              <td className="p-2 text-muted-foreground">{item.definition || ""}</td>
                              <td className="p-2 italic text-muted-foreground">{item.exemple || ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
                        {section.items.map((item, j) => (
                          <li key={j}>
                            {item.terme && <span className="font-medium">{item.terme}</span>}
                            {item.definition && <span className="text-muted-foreground"> — {item.definition}</span>}
                            {item.exemple && <span className="italic text-xs text-muted-foreground ml-1">(Ex: {item.exemple})</span>}
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              ))}
            </ScrollArea>

            <div className="flex gap-2 flex-wrap">
              {!saved && (
                <Button variant="outline" size="sm" onClick={() => setStep("select")}>
                  ← Modifier le type
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-1 h-3.5 w-3.5" /> Imprimer
              </Button>
              {saved && savedResourceId && (
                <Button variant="outline" size="sm" onClick={() => setStep("assign")}>
                  <Users className="mr-1 h-3.5 w-3.5" /> Assigner aux élèves
                </Button>
              )}
              <div className="flex-1" />
              {saved ? (
                <>
                  <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
                    <Check className="h-3 w-3" /> Sauvegardée
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); resetState(); navigate("/formateur/ressources"); }}>
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Banque de ressources
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); resetState(); }}>
                    Fermer
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleSave("draft")} disabled={saving}>
                    <Save className="mr-1 h-3.5 w-3.5" /> Brouillon
                  </Button>
                  <Button size="sm" onClick={() => handleSave("published")} disabled={saving}>
                    {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
                    Publier
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
