import { useState } from "react";
import { Lock, Unlock, User } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type NiveauCECRL = "A0" | "A1" | "A2" | "B1" | "B2";
export type ProfilLitteratie = "standard" | "faible_litteratie";

export type ProfilNiveaux = {
  id: string;
  niveau_co: NiveauCECRL;
  niveau_ce: NiveauCECRL;
  niveau_ee: NiveauCECRL;
  niveau_eo: NiveauCECRL;
  niveau_locked: boolean;
  profil_litteratie: ProfilLitteratie;
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

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="space-y-0.5">
          <Label className="text-sm">Faible littératie</Label>
          <p className="text-[11px] text-gray-500 leading-tight">
            Consigne audio uniquement, appui visuel synchronisé, sans saisie clavier.
          </p>
        </div>
        <Switch
          disabled={locked}
          checked={data.profil_litteratie === "faible_litteratie"}
          onCheckedChange={(checked) =>
            apply("profil_litteratie", checked ? "faible_litteratie" : "standard")
          }
        />
      </div>
    </div>
  );
}
