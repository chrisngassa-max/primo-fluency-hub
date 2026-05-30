import { useState } from "react";
import { Lock, Unlock, User } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type NiveauCECRL = "A0" | "A1" | "A2" | "B1" | "B2";

export type ProfilLitteratie =
  | "FLE"        // anciennement "standard"
  | "Post-Alpha"
  | "Alpha"      // anciennement "faible_litteratie"
  | "NSA"
  | "inconnu";

export type AlphabetL1 = "Latin" | "Arabe" | "Cyrillique" | "Autre";

export type ProfilNiveaux = {
  id: string;
  niveau_co: NiveauCECRL;
  niveau_ce: NiveauCECRL;
  niveau_ee: NiveauCECRL;
  niveau_eo: NiveauCECRL;
  niveau_locked: boolean;
  profil_litteratie: ProfilLitteratie;
  alphabet_l1: AlphabetL1 | null;
};

type Props = {
  profil: ProfilNiveaux;
  onUpdate: (patch: Partial<ProfilNiveaux>) => void;
};

const COMPETENCES: Array<{ key: "co" | "ce" | "ee" | "eo"; label: string }> = [
  { key: "co", label: "Comp. Orale" },
  { key: "ce", label: "Comp. Écrite" },
  { key: "ee", label: "Expr. Écrite" },
  { key: "eo", label: "Expr. Orale" },
];

const NIVEAUX: NiveauCECRL[] = ["A0", "A1", "A2", "B1", "B2"];

const PROFILS_LITTERATIE: Array<{ value: ProfilLitteratie; label: string }> = [
  { value: "FLE", label: "FLE scolarisé" },
  { value: "Post-Alpha", label: "Post-Alpha" },
  { value: "Alpha", label: "Alpha (en cours)" },
  { value: "NSA", label: "NSA (non scripteur adulte)" },
  { value: "inconnu", label: "Inconnu" },
];

const ALPHABETS_L1: Array<{ value: AlphabetL1; label: string }> = [
  { value: "Latin", label: "Latin" },
  { value: "Arabe", label: "Arabe" },
  { value: "Cyrillique", label: "Cyrillique" },
  { value: "Autre", label: "Autre / Inconnu" },
];

// Rétrocompatibilité lecture : les anciens profils binaires sont remappés.
// La valeur est réécrite vers la nouvelle nomenclature au prochain save.
export function normalizeProfilLitteratie(raw: unknown): ProfilLitteratie {
  if (raw === "standard") return "FLE";
  if (raw === "faible_litteratie") return "Alpha";
  if (
    raw === "FLE" || raw === "Post-Alpha" || raw === "Alpha" ||
    raw === "NSA" || raw === "inconnu"
  ) {
    return raw;
  }
  return "inconnu";
}

export function NiveauEleveEditor({ profil, onUpdate }: Props) {
  const [data, setData] = useState<ProfilNiveaux>(profil);

  const apply = <K extends keyof ProfilNiveaux>(field: K, value: ProfilNiveaux[K]) => {
    const next = { ...data, [field]: value };
    setData(next);
    onUpdate({ [field]: value });
  };

  const locked = data.niveau_locked;

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm space-y-4">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="font-medium text-base flex items-center gap-2">
          <User className="w-4 h-4" /> Niveaux par compétence
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => apply("niveau_locked", !locked)}
          className={locked ? "text-amber-600 hover:text-amber-700" : "text-gray-400 hover:text-gray-600"}
        >
          {locked ? <Lock className="w-4 h-4 mr-1" /> : <Unlock className="w-4 h-4 mr-1" />}
          {locked ? "Verrouillé" : "Déverrouillé"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {COMPETENCES.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label className="uppercase text-[10px] font-semibold tracking-wider text-gray-500">
              {label}
            </Label>
            <Select
              disabled={locked}
              value={data[`niveau_${key}`]}
              onValueChange={(val) =>
                apply(`niveau_${key}` as keyof ProfilNiveaux, val as NiveauCECRL)
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NIVEAUX.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t space-y-1">
        <Label className="text-sm">Profil de littératie</Label>
        <p className="text-[11px] text-gray-500 leading-tight">
          Pilote l'étayage, les formats interdits et les supports obligatoires côté génération.
        </p>
        <Select
          disabled={locked}
          value={data.profil_litteratie}
          onValueChange={(val) => apply("profil_litteratie", val as ProfilLitteratie)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROFILS_LITTERATIE.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="pt-2 border-t space-y-2">
        <Label className="text-sm">Alphabet de la langue première (L1)</Label>
        <p className="text-[11px] text-gray-500 leading-tight">
          Système d'écriture d'origine, utile pour adapter le transfert graphique.
        </p>
        <RadioGroup
          disabled={locked}
          value={data.alphabet_l1 ?? ""}
          onValueChange={(val) => apply("alphabet_l1", val as AlphabetL1)}
          className="flex flex-wrap gap-x-4 gap-y-2"
        >
          {ALPHABETS_L1.map((a) => (
            <div key={a.value} className="flex items-center gap-1.5">
              <RadioGroupItem value={a.value} id={`alphabet-${a.value}`} />
              <Label htmlFor={`alphabet-${a.value}`} className="text-sm font-normal cursor-pointer">
                {a.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
