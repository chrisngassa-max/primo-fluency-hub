import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Wand2 } from "lucide-react";
import type { WizardState } from "../types";

const THEMES_PREDEFINIS = [
  "Prendre un RDV à la préfecture",
  "Préparer les documents administratifs",
  "Faire une demande à la CAF",
  "Rédiger un CV simple",
  "Passer un entretien d'embauche",
  "Chercher un logement",
  "Comprendre un bail",
  "Acheter un titre de transport",
  "Prendre RDV chez le médecin",
  "Aller à la pharmacie",
  "Les valeurs de la République",
  "Faire ses courses au marché",
];

interface Props {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
  onGenerate: () => void;
}

const Step1_ChoixParametres = ({ state, onChange, onGenerate }: Props) => {
  const hasTheme = state.themePredefini !== "" || state.themePersonnalise.trim() !== "";

  return (
    <div className="space-y-6">
      {/* Thème pré-défini */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Thème pré-défini</Label>
        <Select
          value={state.themePredefini}
          onValueChange={(v) => onChange({ themePredefini: v, themePersonnalise: "" })}
          disabled={state.themePersonnalise.trim() !== ""}
        >
          <SelectTrigger className="text-base">
            <SelectValue placeholder="Choisir un thème…" />
          </SelectTrigger>
          <SelectContent>
            {THEMES_PREDEFINIS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Thème personnalisé */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Ou thème personnalisé</Label>
        <Input
          value={state.themePersonnalise}
          onChange={(e) => onChange({ themePersonnalise: e.target.value, themePredefini: "" })}
          placeholder="Ex: Appeler les pompiers, Inscrire son enfant à l'école…"
          className="text-base"
          disabled={state.themePredefini !== ""}
        />
        {state.themePredefini && (
          <Button variant="link" size="sm" onClick={() => onChange({ themePredefini: "" })} className="h-auto p-0 text-xs">
            Effacer le thème pré-défini pour écrire librement
          </Button>
        )}
      </div>

      {/* Compétence */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Compétence</Label>
        <RadioGroup
          value={state.competence}
          onValueChange={(v) => onChange({ competence: v as WizardState["competence"] })}
          className="flex flex-wrap gap-4"
        >
          {(["CO", "CE", "EE", "EO"] as const).map((c) => (
            <div key={c} className="flex items-center gap-2">
              <RadioGroupItem value={c} id={`comp-${c}`} />
              <Label htmlFor={`comp-${c}`} className="text-base cursor-pointer">{c}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Nombre d'exercices */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Nombre d'exercices : {state.count}</Label>
        <Slider
          value={[state.count]}
          onValueChange={([v]) => onChange({ count: v })}
          min={1}
          max={5}
          step={1}
        />
      </div>

      {/* Niveau */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Niveau</Label>
        <RadioGroup
          value={state.niveau}
          onValueChange={(v) => onChange({ niveau: v as WizardState["niveau"] })}
          className="flex flex-wrap gap-4"
        >
          {(["A0", "A1", "A2"] as const).map((n) => (
            <div key={n} className="flex items-center gap-2">
              <RadioGroupItem value={n} id={`niv-${n}`} />
              <Label htmlFor={`niv-${n}`} className="text-base cursor-pointer">{n}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Difficulté */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Difficulté : {state.difficulte}/10</Label>
        <Slider
          value={[state.difficulte]}
          onValueChange={([v]) => onChange({ difficulte: v })}
          min={1}
          max={10}
          step={1}
        />
      </div>

      {/* Bouton générer */}
      <Button
        size="xl"
        className="w-full gap-2"
        disabled={!hasTheme || state.loadingGenerate}
        onClick={onGenerate}
      >
        {state.loadingGenerate ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Wand2 className="h-5 w-5" />
        )}
        {state.loadingGenerate ? "Génération en cours…" : "Demander à l'IA"}
      </Button>
    </div>
  );
};

export default Step1_ChoixParametres;
