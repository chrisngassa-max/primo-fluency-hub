import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, Loader2, Settings, Sparkles, ShieldCheck, BookOpen } from "lucide-react";

const Parametres = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [seuilAcquis, setSeuilAcquis] = useState(80);
  const [seuilConsolidation, setSeuilConsolidation] = useState(60);
  const [maxDevoirs, setMaxDevoirs] = useState(3);
  const [nbReussites, setNbReussites] = useState(2);
  const [delaiDevoirs, setDelaiDevoirs] = useState(7);
  const [alerteAbsence, setAlerteAbsence] = useState(48);
  const [seuilRisque, setSeuilRisque] = useState(60);
  const [autoAdapt, setAutoAdapt] = useState(false);

  const { data: params, isLoading } = useQuery({
    queryKey: ["formateur-parametres", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parametres")
        .select("*")
        .eq("formateur_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (params) {
      setSeuilAcquis(Number(params.seuil_acquis));
      setSeuilConsolidation(Number(params.seuil_consolidation));
      setMaxDevoirs(params.max_devoirs_actifs);
      setNbReussites(params.nb_reussites_consecutives);
      setDelaiDevoirs(params.delai_devoirs_jours);
      setAlerteAbsence(params.alerte_absence_heures);
      setSeuilRisque(Number(params.seuil_score_risque));
      setAutoAdapt((params as any).auto_adapt ?? false);
    }
  }, [params]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = {
        formateur_id: user!.id,
        seuil_acquis: seuilAcquis,
        seuil_consolidation: seuilConsolidation,
        max_devoirs_actifs: maxDevoirs,
        nb_reussites_consecutives: nbReussites,
        delai_devoirs_jours: delaiDevoirs,
        alerte_absence_heures: alerteAbsence,
        seuil_score_risque: seuilRisque,
        auto_adapt: autoAdapt,
        updated_at: new Date().toISOString(),
      };

      if (params) {
        const { error } = await supabase
          .from("parametres")
          .update(values as any)
          .eq("id", params.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("parametres")
          .insert(values as any);
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ["formateur-parametres"] });
      toast.success("Paramètres sauvegardés !");
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const fields = [
    { label: "Seuil acquis (%)", value: seuilAcquis, set: setSeuilAcquis, min: 50, max: 100, desc: "Score minimum pour considérer une compétence acquise" },
    { label: "Seuil consolidation (%)", value: seuilConsolidation, set: setSeuilConsolidation, min: 30, max: 90, desc: "En dessous → devoir de consolidation créé" },
    { label: "Max devoirs actifs", value: maxDevoirs, set: setMaxDevoirs, min: 1, max: 10, desc: "Nombre maximum de devoirs simultanés par élève" },
    { label: "Réussites consécutives", value: nbReussites, set: setNbReussites, min: 1, max: 5, desc: "Nombre de réussites pour arrêter un devoir" },
    { label: "Délai devoirs (jours)", value: delaiDevoirs, set: setDelaiDevoirs, min: 1, max: 30, desc: "Jours avant expiration automatique" },
    { label: "Alerte absence (heures)", value: alerteAbsence, set: setAlerteAbsence, min: 12, max: 168, desc: "Heures sans connexion avant alerte" },
    { label: "Seuil score risque (/100)", value: seuilRisque, set: setSeuilRisque, min: 30, max: 100, desc: "Score de risque déclenchant une alerte" },
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Paramètres
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez les seuils pédagogiques et les automatisations
        </p>
      </div>

      {/* Auto-adaptation toggle */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Pilote automatique IA
          </CardTitle>
          <CardDescription>
            Quand activé, l'IA adapte automatiquement la séance N+1 après chaque bilan validé, sans demander votre validation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Auto-adapter les séances</Label>
              <p className="text-xs text-muted-foreground">
                {autoAdapt
                  ? "L'IA modifie directement la séance suivante"
                  : "L'IA propose des suggestions à valider"}
              </p>
            </div>
            <Switch checked={autoAdapt} onCheckedChange={setAutoAdapt} />
          </div>
        </CardContent>
      </Card>

      {/* Seuils pédagogiques */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Seuils pédagogiques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((f, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-medium">{f.label}</Label>
                <span className="text-sm font-mono text-muted-foreground">{f.value}</span>
              </div>
              <Input
                type="number"
                value={f.value}
                onChange={(e) => f.set(Number(e.target.value))}
                min={f.min}
                max={f.max}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              {i < fields.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Sauvegarder les paramètres
      </Button>
    </div>
  );
};

export default Parametres;
