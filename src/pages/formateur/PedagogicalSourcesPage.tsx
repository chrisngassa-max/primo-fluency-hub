import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  createPedagogicalSource,
  fetchPedagogicalSources,
  formatFileSize,
  getPedagogicalSourceSignedUrl,
  PEDAGOGICAL_DOMAINS,
  SOURCE_KIND_LABELS,
  SOURCE_KINDS,
  SOURCE_SUBTYPES,
  sourceKindFromFile,
  splitTags,
  type PedagogicalSource,
  type PedagogicalSourceKind,
} from "@/lib/pedagogicalSources";
import { SourceAnalysisActions } from "@/components/pedagogical-sources/SourceAnalysisActions";
import { SourceDifferentiationFamilyActions } from "@/components/pedagogical-sources/SourceDifferentiationFamilyActions";
import { SourceTranscriptionActions } from "@/components/pedagogical-sources/SourceTranscriptionActions";
import { BookOpen, Eye, FileArchive, Filter, Image, Loader2, Search, Upload } from "lucide-react";

const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
const REVIEW_STATUSES = [
  { value: "brouillon", label: "Brouillon" },
  { value: "utilisable", label: "Utilisable" },
  { value: "valide", label: "Validé" },
  { value: "a_remplacer", label: "À remplacer" },
];

function SourceIcon({ source }: { source: PedagogicalSource }) {
  if (source.source_kind === "image") return <Image className="h-4 w-4 text-emerald-600" />;
  if (source.source_kind === "manuel" || source.source_kind === "lecon") return <BookOpen className="h-4 w-4 text-blue-600" />;
  return <FileArchive className="h-4 w-4 text-orange-600" />;
}

function ImportSourceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [kind, setKind] = useState<PedagogicalSourceKind>("document_authentique");
  const [subtype, setSubtype] = useState("formulaire");
  const [domains, setDomains] = useState<string[]>([]);
  const [levelMin, setLevelMin] = useState("A2");
  const [levelMax, setLevelMax] = useState("A2");
  const [themes, setThemes] = useState("");
  const [origin, setOrigin] = useState("");
  const [rights, setRights] = useState("source_interne");
  const [licenseNote, setLicenseNote] = useState("");
  const [reusableForStudents, setReusableForStudents] = useState(false);
  const [reusableForAi, setReusableForAi] = useState(true);
  const [saving, setSaving] = useState(false);

  function reset() {
    setFile(null);
    setTitle("");
    setAuthor("");
    setKind("document_authentique");
    setSubtype("formulaire");
    setDomains([]);
    setLevelMin("A2");
    setLevelMax("A2");
    setThemes("");
    setOrigin("");
    setRights("source_interne");
    setLicenseNote("");
    setReusableForStudents(false);
    setReusableForAi(true);
  }

  function handleFile(nextFile: File | null) {
    setFile(nextFile);
    if (!nextFile) return;
    setTitle((prev) => prev || nextFile.name.replace(/\.[^.]+$/, ""));
    setKind(sourceKindFromFile(nextFile));
    if (nextFile.type.startsWith("image/")) setSubtype("support_image");
  }

  function toggleDomain(domain: string) {
    setDomains((prev) => (prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]));
  }

  async function handleSubmit() {
    if (!user || !file || !title.trim()) return;
    setSaving(true);
    try {
      await createPedagogicalSource({
        file,
        title,
        author,
        sourceKind: kind,
        sourceSubtype: subtype,
        pedagogicalDomains: domains,
        levelMin,
        levelMax,
        themes: splitTags(themes),
        sourceOrigin: origin,
        rightsStatus: rights,
        licenseNote,
        reusableForStudents,
        reusableForAi,
        userId: user.id,
      });
      toast.success("Source pédagogique importée.");
      queryClient.invalidateQueries({ queryKey: ["pedagogical-sources"] });
      reset();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Import impossible", { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer une source pédagogique</DialogTitle>
          <DialogDescription>
            Importez la source, puis lancez son analyse pour creer les morceaux reutilisables par le moteur.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Fichier source</Label>
              <Input type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.mp3,.mp4" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              {file && <p className="text-xs text-muted-foreground">{file.name} · {formatFileSize(file.size)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Titre</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Auteur / éditeur</Label>
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Optionnel" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Grande famille</Label>
                <Select value={kind} onValueChange={(value) => setKind(value as PedagogicalSourceKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_KINDS.map((value) => (
                      <SelectItem key={value} value={value}>{SOURCE_KIND_LABELS[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type détaillé</Label>
                <Select value={subtype} onValueChange={setSubtype}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_SUBTYPES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Niveau min</Label>
                <Select value={levelMin} onValueChange={setLevelMin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Niveau max</Label>
                <Select value={levelMax} onValueChange={setLevelMax}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Domaines pédagogiques</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                {PEDAGOGICAL_DOMAINS.map((domain) => (
                  <label key={domain} className="flex items-center gap-2 text-xs">
                    <Checkbox checked={domains.includes(domain)} onCheckedChange={() => toggleDomain(domain)} />
                    {domain}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Thèmes</Label>
              <Input value={themes} onChange={(e) => setThemes(e.target.value)} placeholder="prefecture, santé, logement..." />
            </div>
            <div className="space-y-1.5">
              <Label>Provenance</Label>
              <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="manuel, site institutionnel, production interne..." />
            </div>
            <div className="space-y-1.5">
              <Label>Droits / licence</Label>
              <Input value={rights} onChange={(e) => setRights(e.target.value)} placeholder="source_interne, sous_droits, CC BY..." />
            </div>
            <div className="space-y-1.5">
              <Label>Note licence</Label>
              <Textarea value={licenseNote} onChange={(e) => setLicenseNote(e.target.value)} className="min-h-[72px]" />
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={reusableForAi} onCheckedChange={(checked) => setReusableForAi(Boolean(checked))} />
                Utilisable comme contexte IA
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={reusableForStudents} onCheckedChange={(checked) => setReusableForStudents(Boolean(checked))} />
                Réutilisable dans des documents élèves
              </label>
              <p className="text-[11px] text-muted-foreground">
                Par défaut, les sources importées ne sont pas publiables aux élèves tant que les droits ne sont pas confirmés.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={!file || !title.trim() || saving} onClick={handleSubmit} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PedagogicalSourcesPage() {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [domain, setDomain] = useState("all");
  const [level, setLevel] = useState("all");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [importOpen, setImportOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const filters = useMemo(() => ({ search, kind, domain, level, reviewStatus }), [search, kind, domain, level, reviewStatus]);
  const { data: sources = [], isLoading, error } = useQuery({
    queryKey: ["pedagogical-sources", filters],
    queryFn: () => fetchPedagogicalSources(filters),
  });

  async function handleOpen(source: PedagogicalSource) {
    setOpeningId(source.id);
    try {
      const url = await getPedagogicalSourceSignedUrl(source);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error("Ouverture impossible", { description: error.message });
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileArchive className="h-6 w-6 text-orange-600" />
            Sources pédagogiques
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manuels, leçons, images, documents authentiques et références utilisés pour cadrer les séances.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4" /> Importer une source
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtres
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher titre, auteur, provenance..." />
          </div>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {SOURCE_KINDS.map((value) => <SelectItem key={value} value={value}>{SOURCE_KIND_LABELS[value]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger><SelectValue placeholder="Domaine" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous domaines</SelectItem>
              {PEDAGOGICAL_DOMAINS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous niveaux</SelectItem>
              {LEVELS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={reviewStatus} onValueChange={setReviewStatus}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {REVIEW_STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-destructive">Impossible de charger les sources : {(error as Error).message}</p>
      ) : isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-44 w-full" />)}
        </div>
      ) : sources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucune source pour ces filtres. Importez un manuel, une image, une leçon ou un document authentique.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <Card key={source.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <SourceIcon source={source} />
                    <span className="line-clamp-2">{source.title}</span>
                  </CardTitle>
                  <Badge variant="outline" className="shrink-0">{source.review_status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{SOURCE_KIND_LABELS[source.source_kind] ?? source.source_kind}</Badge>
                  {source.source_subtype && <Badge variant="outline">{source.source_subtype}</Badge>}
                  {(source.level_min || source.level_max) && <Badge variant="outline">{source.level_min ?? "?"} → {source.level_max ?? "?"}</Badge>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {source.pedagogical_domains.slice(0, 4).map((item) => <Badge key={item} variant="secondary" className="text-[10px]">{item}</Badge>)}
                  {source.themes.slice(0, 4).map((item) => <Badge key={item} variant="secondary" className="text-[10px]">{item}</Badge>)}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {source.author && <p>Auteur / éditeur : {source.author}</p>}
                  {source.source_origin && <p>Provenance : {source.source_origin}</p>}
                  <p>{formatFileSize(source.file_size)} · {source.mime_type || "type inconnu"}</p>
                  <p>IA : {source.reusable_for_ai ? "oui" : "non"} · Élèves : {source.reusable_for_students ? "oui" : "non"}</p>
                </div>
                <Button variant="outline" size="sm" className="w-full gap-1.5" disabled={openingId === source.id} onClick={() => handleOpen(source)}>
                  {openingId === source.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Ouvrir
                </Button>
                <SourceTranscriptionActions source={source} />
                <SourceAnalysisActions source={source} />
                <SourceDifferentiationFamilyActions source={source} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ImportSourceDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
