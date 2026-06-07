import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LEARNING_PREFERENCES = [
  ["audio", "Écouter"],
  ["visuel", "Voir des images"],
  ["lecture", "Lire"],
  ["ecriture", "Écrire"],
  ["oral", "Parler"],
  ["exemples", "Voir un exemple"],
] as const;

const ACCESSIBILITY_NEEDS = [
  ["dyslexie", "Dyslexie ou lecture difficile"],
  ["vision", "Difficulté visuelle"],
  ["audition", "Difficulté auditive"],
  ["motricite", "Difficulté motrice"],
  ["attention", "Attention ou mémorisation"],
] as const;

export interface AndragogicalProfile {
  eleve_id: string;
  langue_maternelle: string | null;
  autres_langues: string[];
  niveau_scolarisation: string | null;
  aisance_numerique: string | null;
  projet_personnel: string | null;
  objectif_tcf: string | null;
  date_cible_tcf: string | null;
  preferences_apprentissage: string[];
  besoins_accessibilite: string[];
  disponibilite_hors_seance: string | null;
}

interface Props {
  profile: AndragogicalProfile;
  onSaved?: () => void;
  compact?: boolean;
}

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export default function AndragogicalProfileForm({ profile, onSaved, compact = false }: Props) {
  const [form, setForm] = useState<AndragogicalProfile>(profile);
  const [otherLanguages, setOtherLanguages] = useState(profile.autres_langues.join(", "));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(profile);
    setOtherLanguages(profile.autres_langues.join(", "));
  }, [profile]);

  const update = <K extends keyof AndragogicalProfile>(key: K, value: AndragogicalProfile[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const autresLangues = otherLanguages
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const { error } = await supabase.rpc("update_andragogical_profile", {
        p_eleve_id: form.eleve_id,
        p_profile: {
          langue_maternelle: form.langue_maternelle || null,
          autres_langues: autresLangues,
          niveau_scolarisation: form.niveau_scolarisation || null,
          aisance_numerique: form.aisance_numerique || null,
          projet_personnel: form.projet_personnel || null,
          objectif_tcf: form.objectif_tcf || null,
          date_cible_tcf: form.date_cible_tcf || null,
          preferences_apprentissage: form.preferences_apprentissage,
          besoins_accessibilite: form.besoins_accessibilite,
          disponibilite_hors_seance: form.disponibilite_hors_seance || null,
        },
      });
      if (error) throw error;
      toast.success("Profil d'apprentissage enregistré.");
      onSaved?.();
    } catch (error: any) {
      toast.error("Enregistrement impossible", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="langue-maternelle">Langue maternelle</Label>
          <Input
            id="langue-maternelle"
            value={form.langue_maternelle ?? ""}
            onChange={(event) => update("langue_maternelle", event.target.value)}
            placeholder="Ex. arabe, dari, bambara"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="autres-langues">Autres langues</Label>
          <Input
            id="autres-langues"
            value={otherLanguages}
            onChange={(event) => setOtherLanguages(event.target.value)}
            placeholder="Séparées par des virgules"
          />
        </div>
        <div className="space-y-2">
          <Label>Niveau de scolarisation</Label>
          <Select value={form.niveau_scolarisation ?? "non_renseigne"} onValueChange={(value) => update("niveau_scolarisation", value === "non_renseigne" ? null : value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="non_renseigne">Non renseigné</SelectItem>
              <SelectItem value="non_scolarise">Non scolarisé</SelectItem>
              <SelectItem value="primaire">Primaire</SelectItem>
              <SelectItem value="college">Collège</SelectItem>
              <SelectItem value="lycee">Lycée</SelectItem>
              <SelectItem value="superieur">Études supérieures</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Aisance numérique</Label>
          <Select value={form.aisance_numerique ?? "non_renseigne"} onValueChange={(value) => update("aisance_numerique", value === "non_renseigne" ? null : value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="non_renseigne">Non renseignée</SelectItem>
              <SelectItem value="faible">Faible</SelectItem>
              <SelectItem value="moyenne">Moyenne</SelectItem>
              <SelectItem value="bonne">Bonne</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Objectif TCF</Label>
          <Select value={form.objectif_tcf ?? "non_renseigne"} onValueChange={(value) => update("objectif_tcf", value === "non_renseigne" ? null : value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="non_renseigne">Non renseigné</SelectItem>
              <SelectItem value="irn">TCF IRN</SelectItem>
              <SelectItem value="quebec">TCF Québec</SelectItem>
              <SelectItem value="canada">TCF Canada</SelectItem>
              <SelectItem value="tout_public">TCF Tout public</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-tcf">Date cible</Label>
          <Input id="date-tcf" type="date" value={form.date_cible_tcf ?? ""} onChange={(event) => update("date_cible_tcf", event.target.value || null)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="projet-personnel">Projet personnel ou professionnel</Label>
        <Textarea
          id="projet-personnel"
          value={form.projet_personnel ?? ""}
          onChange={(event) => update("projet_personnel", event.target.value)}
          placeholder="Ex. trouver un emploi en restauration, accompagner les enfants à l'école..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Préférences d'apprentissage</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {LEARNING_PREFERENCES.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.preferences_apprentissage.includes(value)} onCheckedChange={() => update("preferences_apprentissage", toggleValue(form.preferences_apprentissage, value))} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Besoins d'accessibilité</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACCESSIBILITY_NEEDS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.besoins_accessibilite.includes(value)} onCheckedChange={() => update("besoins_accessibilite", toggleValue(form.besoins_accessibilite, value))} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="disponibilite">Disponibilité hors séance</Label>
        <Input
          id="disponibilite"
          value={form.disponibilite_hors_seance ?? ""}
          onChange={(event) => update("disponibilite_hors_seance", event.target.value)}
          placeholder="Ex. 20 minutes le soir, trois fois par semaine"
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Enregistrer le profil d'apprentissage
      </Button>
    </div>
  );
}
