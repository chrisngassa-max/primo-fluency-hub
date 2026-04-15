import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Plus, Database, Loader2 } from "lucide-react";

const COMPETENCES = ["CO", "CE", "EE", "EO", "Structures"] as const;
const LEVELS = ["A0", "A1", "A2", "B1", "B2"] as const;

export default function BanqueActivites() {
  const [filterCompetence, setFilterCompetence] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: activities = [], isLoading, refetch } = useQuery({
    queryKey: ["pedagogical-activities", filterCompetence, filterLevel, filterCategory, filterSource],
    queryFn: async () => {
      let q = supabase.from("pedagogical_activities").select("*").order("created_at", { ascending: false });
      if (filterCompetence !== "all") q = q.eq("competence", filterCompetence);
      if (filterLevel !== "all") q = q.eq("level_min", filterLevel);
      if (filterCategory) q = q.ilike("category", `%${filterCategory}%`);
      if (filterSource !== "all") q = q.eq("source", filterSource);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ["pedagogical-activities-count"],
    queryFn: async () => {
      const { count } = await supabase.from("pedagogical_activities").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV vide");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim());
        const row: Record<string, any> = {};
        headers.forEach((h, i) => {
          if (h === "tags") {
            row[h] = vals[i] ? vals[i].split(";").map((t: string) => t.trim()) : [];
          } else {
            row[h] = vals[i] || null;
          }
        });
        return row;
      });
      const { error } = await supabase.from("pedagogical_activities").insert(rows as any);
      if (error) throw error;
      toast.success(`${rows.length} activités importées`);
      refetch();
    } catch (err: any) {
      toast.error("Erreur import : " + err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleManualAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const row = {
      title: fd.get("title") as string,
      category: (fd.get("category") as string) || null,
      level_min: (fd.get("level_min") as string) || null,
      level_max: (fd.get("level_max") as string) || null,
      competence: (fd.get("competence") as string) || null,
      objective: (fd.get("objective") as string) || null,
      instructions: (fd.get("instructions") as string) || null,
      format: (fd.get("format") as string) || null,
      tags: (fd.get("tags") as string)?.split(",").map((t) => t.trim()).filter(Boolean) ?? [],
      source: "manual",
    };
    const { error } = await supabase.from("pedagogical_activities").insert([row]);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Activité ajoutée");
    setAddOpen(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Banque d'activités pédagogiques</h1>
          <p className="text-muted-foreground text-sm">Référentiel pour la génération RAG d'exercices</p>
        </div>
        <div className="flex items-center gap-2">
          {totalCount >= 10 ? (
            <Badge className="bg-primary text-primary-foreground">RAG actif · {totalCount} activités</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">RAG inactif · {totalCount}/10 min.</Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div className="w-40">
            <Label className="text-xs">Compétence</Label>
            <Select value={filterCompetence} onValueChange={setFilterCompetence}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {COMPETENCES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Label className="text-xs">Niveau</Label>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Label className="text-xs">Catégorie</Label>
            <Input placeholder="Filtrer..." value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} />
          </div>
          <div className="w-32">
            <Label className="text-xs">Source</Label>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="scan">Scan</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 ml-auto">
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Importer CSV
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Nouvelle activité</DialogTitle></DialogHeader>
                <form onSubmit={handleManualAdd} className="space-y-3">
                  <div>
                    <Label>Titre *</Label>
                    <Input name="title" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Compétence</Label>
                      <select name="competence" className="w-full border rounded px-2 py-1.5 text-sm">
                        <option value="">—</option>
                        {COMPETENCES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Catégorie</Label>
                      <Input name="category" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Niveau min</Label>
                      <select name="level_min" className="w-full border rounded px-2 py-1.5 text-sm">
                        <option value="">—</option>
                        {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Niveau max</Label>
                      <select name="level_max" className="w-full border rounded px-2 py-1.5 text-sm">
                        <option value="">—</option>
                        {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label>Objectif</Label>
                    <Input name="objective" />
                  </div>
                  <div>
                    <Label>Consignes</Label>
                    <Textarea name="instructions" rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Format</Label>
                      <Input name="format" placeholder="qcm, appariement..." />
                    </div>
                    <div>
                      <Label>Tags (séparés par ,)</Label>
                      <Input name="tags" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">Enregistrer</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Database className="h-10 w-10 mb-2" />
              <p>Aucune activité trouvée</p>
              <p className="text-xs">Importez un CSV ou ajoutez manuellement</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Comp.</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium max-w-[250px] truncate">{a.title}</TableCell>
                    <TableCell><Badge variant="outline">{a.competence ?? "—"}</Badge></TableCell>
                    <TableCell>{a.level_min}{a.level_max ? `→${a.level_max}` : ""}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.category ?? "—"}</TableCell>
                    <TableCell className="text-sm">{a.format ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{a.source}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
